use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const API_BASE_URL: &str = "https://itemfab.space";

#[tauri::command]
async fn fetch_api_json(path: String) -> Result<serde_json::Value, String> {
    let url = if path.starts_with("/api/") {
        format!("{API_BASE_URL}{path}")
    } else if path.starts_with("https://itemfab.space/api/") {
        path
    } else {
        return Err("Unsupported API path".to_string());
    };

    let response = reqwest::Client::new()
        .get(&url)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("Non-JSON response - HTTP {status}: {error}"))?;

    if !status.is_success() {
        let message = payload
            .get("message")
            .and_then(|value| value.as_str())
            .map(ToString::to_string)
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(message);
    }

    Ok(payload)
}

#[derive(Serialize)]
pub struct ScInstallPaths {
    live: Option<String>,
    ptu: Option<String>,
}

/// Reads the RSI Launcher log to extract actual SC install paths.
/// MultitoolV2 approach: parse %APPDATA%\rsilauncher\logs\log.log with a regex
/// that matches Windows paths containing "StarCitizen\<CHANNEL>".
fn find_paths_from_launcher_log() -> Vec<PathBuf> {
    let appdata = match std::env::var("APPDATA") {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let launcher_log = PathBuf::from(&appdata)
        .join("rsilauncher")
        .join("logs")
        .join("log.log");

    if !launcher_log.is_file() {
        return vec![];
    }

    let bytes = match std::fs::read(&launcher_log) {
        Ok(b) => b,
        Err(_) => return vec![],
    };
    let content = String::from_utf8_lossy(&bytes);

    // Matches any Windows path ending with StarCitizen\<CHANNEL>
    let re = match Regex::new(
        r#"([a-zA-Z]:\\(?:[^\\:*?"<>|\r\n]+\\)*StarCitizen\\[A-Za-z0-9_.@-]+)"#,
    ) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    let mut seen: HashSet<String> = HashSet::new();
    let mut paths: Vec<PathBuf> = Vec::new();

    for caps in re.captures_iter(&content) {
        let raw = caps[1].trim().to_string();
        let p = PathBuf::from(&raw);
        // Validate: must have StarCitizen.exe or Data.p4k
        if seen.insert(raw)
            && (p.join("Bin64").join("StarCitizen.exe").exists() || p.join("Data.p4k").exists())
        {
            paths.push(p);
        }
    }

    paths
}

/// Checks whether a directory looks like a valid SC channel install.
fn is_valid_sc_channel(path: &Path) -> bool {
    path.is_dir()
        && (path.join("Bin64").join("StarCitizen.exe").exists()
            || path.join("Data.p4k").exists()
            || path.join("Game.log").exists()
            || path.join("launcherData.json").exists())
}

/// Fallback: probe common install locations across drives.
fn find_paths_from_common_locations() -> Vec<PathBuf> {
    let drives = ["C", "D", "E", "F", "G", "H"];
    let common_subdirs = [
        "Program Files\\Roberts Space Industries\\StarCitizen",
        "Roberts Space Industries\\StarCitizen",
        "Games\\Roberts Space Industries\\StarCitizen",
        "Games\\StarCitizen",
        "SC\\StarCitizen",
        "StarCitizen",
    ];
    let channels = ["LIVE", "PTU", "WAVE", "TECH-PREVIEW"];

    let mut found: Vec<PathBuf> = Vec::new();
    for drive in &drives {
        for sub in &common_subdirs {
            for ch in &channels {
                let p = PathBuf::from(format!("{drive}:\\{sub}\\{ch}"));
                if is_valid_sc_channel(&p) {
                    found.push(p);
                }
            }
        }
    }
    found
}

#[tauri::command]
fn detect_sc_install_paths() -> ScInstallPaths {
    // Primary: read actual paths from RSI Launcher log (most reliable)
    let mut channel_paths = find_paths_from_launcher_log();

    // Fallback: probe common locations if launcher log gave nothing
    if channel_paths.is_empty() {
        channel_paths = find_paths_from_common_locations();
    }

    let mut live: Option<String> = None;
    let mut ptu: Option<String> = None;

    for path in &channel_paths {
        // Determine channel from path component
        let channel = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_uppercase();

        if channel == "LIVE" && live.is_none() {
            live = Some(path.to_string_lossy().into_owned());
        } else if (channel == "PTU" || channel == "WAVE" || channel == "TECH-PREVIEW")
            && ptu.is_none()
        {
            ptu = Some(path.to_string_lossy().into_owned());
        }
    }

    ScInstallPaths { live, ptu }
}

/// Reads a file robustly using UTF-8 lossy decoding (handles corrupted log bytes).
fn read_log_file_lossy(path: &Path) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// Collects all lines from Game.log and logbackups/*.log in the channel directory.
fn collect_log_lines(channel_path: &Path) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    let game_log = channel_path.join("Game.log");
    if game_log.is_file() {
        if let Some(content) = read_log_file_lossy(&game_log) {
            lines.extend(content.lines().map(String::from));
        }
    }

    let logbackups_dir = channel_path.join("logbackups");
    if logbackups_dir.is_dir() {
        for entry in WalkDir::new(&logbackups_dir)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |e| e == "log") {
                if let Some(content) = read_log_file_lossy(path) {
                    lines.extend(content.lines().map(String::from));
                }
            }
        }
    }

    lines
}

#[tauri::command]
fn scan_blueprints_from_logs(channel_path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&channel_path);
    if !path.is_dir() {
        return Err(format!("Path not found: {channel_path}"));
    }

    // Handles English and French game client notifications
    let re = Regex::new(r"(?:Received Blueprint: (.+?):|Sch[eé]mas? re[cç]us? : (.+?):)")
        .map_err(|e| e.to_string())?;

    let lines = collect_log_lines(&path);
    let mut seen: HashSet<String> = HashSet::new();
    let mut blueprints: Vec<String> = Vec::new();

    for line in &lines {
        if let Some(caps) = re.captures(line) {
            // Group 1 = English, group 2 = French
            let name = caps
                .get(1)
                .or_else(|| caps.get(2))
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_default();
            if !name.is_empty() && seen.insert(name.clone()) {
                blueprints.push(name);
            }
        }
    }

    Ok(blueprints)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_api_json,
            detect_sc_install_paths,
            scan_blueprints_from_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Item Fabricator");
}
