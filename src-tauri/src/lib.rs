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

/// Checks whether a directory looks like a valid SC channel install
/// (contains Game.log or launcherData.json or Data directory).
fn is_valid_sc_channel(path: &Path) -> bool {
    path.is_dir()
        && (path.join("Game.log").exists()
            || path.join("launcherData.json").exists()
            || path.join("Data").is_dir())
}

/// Tries to locate SC install roots (parent of LIVE/PTU) from common locations.
fn find_sc_install_roots() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    // %APPDATA%\rsilauncher\app-*.* — RSI launcher writes lastInstallPath in its config
    // We probe common install parents instead of parsing LevelDB.
    let drives = ["C", "D", "E", "F", "G"];
    let common_subdirs = [
        "Program Files\\Roberts Space Industries\\StarCitizen",
        "Roberts Space Industries\\StarCitizen",
        "Games\\Roberts Space Industries\\StarCitizen",
        "Games\\StarCitizen",
        "SC\\StarCitizen",
        "StarCitizen",
    ];

    for drive in &drives {
        for sub in &common_subdirs {
            candidates.push(PathBuf::from(format!("{drive}:\\{sub}")));
        }
    }

    candidates
}

#[tauri::command]
fn detect_sc_install_paths() -> ScInstallPaths {
    let roots = find_sc_install_roots();

    let mut live: Option<String> = None;
    let mut ptu: Option<String> = None;

    for root in &roots {
        if live.is_none() {
            let candidate = root.join("LIVE");
            if is_valid_sc_channel(&candidate) {
                live = Some(candidate.to_string_lossy().into_owned());
            }
        }
        if ptu.is_none() {
            let candidate = root.join("PTU");
            if is_valid_sc_channel(&candidate) {
                ptu = Some(candidate.to_string_lossy().into_owned());
            }
        }
        if live.is_some() && ptu.is_some() {
            break;
        }
    }

    ScInstallPaths { live, ptu }
}

/// Reads all log lines from Game.log and logbackups/*.log in the given channel directory.
fn collect_log_lines(channel_path: &Path) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    // Main log
    let game_log = channel_path.join("Game.log");
    if game_log.is_file() {
        if let Ok(content) = std::fs::read_to_string(&game_log) {
            lines.extend(content.lines().map(String::from));
        }
    }

    // All logbackup files
    let logbackups_dir = channel_path.join("logbackups");
    if logbackups_dir.is_dir() {
        for entry in WalkDir::new(&logbackups_dir)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "log" {
                        if let Ok(content) = std::fs::read_to_string(path) {
                            lines.extend(content.lines().map(String::from));
                        }
                    }
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

    let re = Regex::new(r#"Received Blueprint: ([^:]+):"#)
        .map_err(|e| e.to_string())?;

    let lines = collect_log_lines(&path);
    let mut seen: HashSet<String> = HashSet::new();
    let mut blueprints: Vec<String> = Vec::new();

    for line in &lines {
        if let Some(caps) = re.captures(line) {
            let name = caps[1].trim().to_string();
            if seen.insert(name.clone()) {
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
