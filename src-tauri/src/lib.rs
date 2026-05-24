use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use walkdir::WalkDir;

const API_BASE_URL: &str = "https://itemfab.space";
const TAIL_POLL_MS: u64 = 200;
const APP_REGISTRY_NAME: &str = "ItemFabricator";

// ─── Watcher state ────────────────────────────────────────────────────────────

pub struct WatcherState {
    stop_flag: Mutex<Option<Arc<AtomicBool>>>,
    channel_path: Mutex<Option<String>>,
}

impl WatcherState {
    fn new() -> Self {
        Self {
            stop_flag: Mutex::new(None),
            channel_path: Mutex::new(None),
        }
    }

    fn is_running(&self) -> bool {
        self.stop_flag
            .lock()
            .unwrap()
            .as_ref()
            .map(|f| !f.load(Ordering::Relaxed))
            .unwrap_or(false)
    }

    fn stop(&self) {
        if let Some(flag) = self.stop_flag.lock().unwrap().take() {
            flag.store(true, Ordering::Relaxed);
        }
        *self.channel_path.lock().unwrap() = None;
    }
}

// ─── API proxy ────────────────────────────────────────────────────────────────

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
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Non-JSON response - HTTP {status}: {e}"))?;

    if !status.is_success() {
        let message = payload
            .get("message")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(message);
    }

    Ok(payload)
}

// ─── SC install path detection ────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ScInstallPaths {
    live: Option<String>,
    ptu: Option<String>,
}

/// Primary detection: parse the RSI Launcher log for actual installed paths.
/// Approach from MultitoolV2: %APPDATA%\rsilauncher\logs\log.log contains
/// lines with full Windows paths to each SC channel installation.
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
        if seen.insert(raw)
            && (p.join("Bin64").join("StarCitizen.exe").exists()
                || p.join("Data.p4k").exists())
        {
            paths.push(p);
        }
    }

    paths
}

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
    let mut channel_paths = find_paths_from_launcher_log();
    if channel_paths.is_empty() {
        channel_paths = find_paths_from_common_locations();
    }

    let mut live: Option<String> = None;
    let mut ptu: Option<String> = None;

    for path in &channel_paths {
        let channel = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_uppercase();

        if channel == "LIVE" && live.is_none() {
            live = Some(path.to_string_lossy().into_owned());
        } else if matches!(channel.as_str(), "PTU" | "WAVE" | "TECH-PREVIEW") && ptu.is_none() {
            ptu = Some(path.to_string_lossy().into_owned());
        }
    }

    ScInstallPaths { live, ptu }
}

// ─── Log reading helpers ──────────────────────────────────────────────────────

fn read_log_file_lossy(path: &Path) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

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

fn build_blueprint_regex() -> Regex {
    // Handles English and French game client notifications
    Regex::new(r"(?:Received Blueprint: (.+?):|Sch[eé]mas? re[cç]us? : (.+?):)")
        .expect("invalid blueprint regex")
}

fn extract_blueprints_from_lines<'a>(
    lines: impl Iterator<Item = &'a str>,
    re: &Regex,
    seen: &mut HashSet<String>,
) -> Vec<String> {
    let mut new_names = Vec::new();
    for line in lines {
        if let Some(caps) = re.captures(line) {
            let name = caps
                .get(1)
                .or_else(|| caps.get(2))
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_default();
            if !name.is_empty() && seen.insert(name.clone()) {
                new_names.push(name);
            }
        }
    }
    new_names
}

// ─── One-shot historical scan ─────────────────────────────────────────────────

#[tauri::command]
fn scan_blueprints_from_logs(channel_path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&channel_path);
    if !path.is_dir() {
        return Err(format!("Path not found: {channel_path}"));
    }

    let re = build_blueprint_regex();
    let lines = collect_log_lines(&path);
    let mut seen = HashSet::new();
    let blueprints =
        extract_blueprints_from_lines(lines.iter().map(String::as_str), &re, &mut seen);

    Ok(blueprints)
}

// ─── Real-time watcher ────────────────────────────────────────────────────────

/// Polls Game.log every TAIL_POLL_MS, reads only new bytes, emits
/// `sc-log-new-blueprints` events when new blueprint names are found.
async fn run_log_watcher(
    log_path: PathBuf,
    stop: Arc<AtomicBool>,
    app: tauri::AppHandle,
    re: Regex,
    mut known: HashSet<String>,
) {
    // Start from current end of file — don't re-emit already-known blueprints
    let mut position: u64 = std::fs::metadata(&log_path)
        .map(|m| m.len())
        .unwrap_or(0);
    let mut last_size: u64 = position;

    loop {
        tokio::time::sleep(tokio::time::Duration::from_millis(TAIL_POLL_MS)).await;

        if stop.load(Ordering::Relaxed) {
            break;
        }

        let current_size = match std::fs::metadata(&log_path) {
            Ok(m) => m.len(),
            Err(_) => continue,
        };

        // Log rotated (new game session) — restart from beginning
        if current_size < last_size {
            position = 0;
        }
        last_size = current_size;

        if current_size <= position {
            continue;
        }

        // Read only new bytes since last position
        let new_bytes = {
            let mut f = match std::fs::File::open(&log_path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            if f.seek(SeekFrom::Start(position)).is_err() {
                continue;
            }
            let mut buf = Vec::new();
            if f.read_to_end(&mut buf).is_err() {
                continue;
            }
            position += buf.len() as u64;
            buf
        };

        let text = String::from_utf8_lossy(&new_bytes);
        let new_names =
            extract_blueprints_from_lines(text.lines(), &re, &mut known);

        if !new_names.is_empty() {
            let _ = app.emit("sc-log-new-blueprints", &new_names);
        }
    }
}

#[derive(Serialize)]
pub struct WatcherStatus {
    running: bool,
    #[serde(rename = "channelPath")]
    channel_path: Option<String>,
}

#[tauri::command]
async fn start_log_watcher(
    channel_path: String,
    state: tauri::State<'_, WatcherState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Stop any existing watcher first
    state.stop();

    let path = PathBuf::from(&channel_path);
    if !path.is_dir() {
        return Err(format!("Path not found: {channel_path}"));
    }

    let log_path = path.join("Game.log");
    let re = build_blueprint_regex();

    // Pre-seed known blueprints from history so we only emit truly new ones
    let lines = collect_log_lines(&path);
    let mut known = HashSet::new();
    extract_blueprints_from_lines(lines.iter().map(String::as_str), &re, &mut known);

    let stop = Arc::new(AtomicBool::new(false));
    *state.stop_flag.lock().unwrap() = Some(Arc::clone(&stop));
    *state.channel_path.lock().unwrap() = Some(channel_path);

    tauri::async_runtime::spawn(run_log_watcher(
        log_path,
        stop,
        app,
        re,
        known,
    ));

    Ok(())
}

#[tauri::command]
fn stop_log_watcher(state: tauri::State<'_, WatcherState>) {
    state.stop();
}

#[tauri::command]
fn get_watcher_status(state: tauri::State<'_, WatcherState>) -> WatcherStatus {
    WatcherStatus {
        running: state.is_running(),
        channel_path: state.channel_path.lock().unwrap().clone(),
    }
}

// ─── Auto-startup (Windows only) ─────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_run_key() -> Result<winreg::RegKey, String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_ALL_ACCESS};
    winreg::RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            KEY_ALL_ACCESS,
        )
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn enable_auto_startup() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let key = get_run_key()?;
        key.set_value(APP_REGISTRY_NAME, &exe.to_string_lossy().as_ref())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn disable_auto_startup() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let key = get_run_key()?;
        key.delete_value(APP_REGISTRY_NAME).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn is_auto_startup_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(key) = get_run_key() {
            let val: Result<String, _> = key.get_value(APP_REGISTRY_NAME);
            return val.is_ok();
        }
    }
    false
}

// ─── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState::new())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_api_json,
            detect_sc_install_paths,
            scan_blueprints_from_logs,
            start_log_watcher,
            stop_log_watcher,
            get_watcher_status,
            enable_auto_startup,
            disable_auto_startup,
            is_auto_startup_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Item Fabricator");
}
