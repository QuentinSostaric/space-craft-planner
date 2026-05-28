use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;
use walkdir::WalkDir;

const API_BASE_URL: &str = "https://itemfab.space";
const API_BASE_URL_ENV: &str = "ITEMFAB_API_BASE_URL";
const TAIL_POLL_MS: u64 = 200;
const APP_REGISTRY_NAME: &str = "ItemFabricator";
const KEYRING_SERVICE: &str = "space.itemfab.desktop";
const KEYRING_SESSION_USER: &str = "desktop-session";

// ─── Watcher state ────────────────────────────────────────────────────────────

pub struct WatcherState {
    stop_flag: Mutex<Option<Arc<AtomicBool>>>,
    channel_path: Mutex<Option<String>>,
}

pub struct DesktopAuthState {
    session_token: Mutex<Option<String>>,
}

impl DesktopAuthState {
    fn new() -> Self {
        Self {
            session_token: Mutex::new(read_desktop_session_token()),
        }
    }

    fn get_token(&self) -> Option<String> {
        self.session_token.lock().unwrap().clone()
    }

    fn set_token(&self, token: Option<String>) -> Result<(), String> {
        *self.session_token.lock().unwrap() = token.clone();
        write_desktop_session_token(token.as_deref())
    }
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

fn desktop_session_path() -> Option<PathBuf> {
    let base = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join("Library").join("Application Support"))
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
    }?;

    Some(base.join("ItemFabricator").join("desktop-session.token"))
}

fn read_desktop_session_token() -> Option<String> {
    // Try OS keyring first (Windows Credential Manager, macOS Keychain, etc.)
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER) {
        if let Ok(token) = entry.get_password() {
            let trimmed = token.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }
    // File fallback for environments without a keyring daemon (some Linux setups)
    let path = desktop_session_path()?;
    let content = std::fs::read_to_string(path).ok()?;
    let trimmed = content.trim().to_string();
    if trimmed.is_empty() { None } else { Some(trimmed) }
}

fn write_desktop_session_token(token: Option<&str>) -> Result<(), String> {
    match token {
        Some(value) if !value.trim().is_empty() => {
            let value = value.trim();

            // Always write the file first — it is the guaranteed fallback.
            // Some keyring backends (e.g. unstable Linux daemons) return Ok(()) without
            // actually persisting the credential, so relying on keyring alone risks losing
            // the session on the next restart.
            let path = desktop_session_path()
                .ok_or_else(|| "Unable to resolve session file path.".to_string())?;
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Unable to create session directory: {e}"))?;
            }
            std::fs::write(&path, value)
                .map_err(|e| format!("Unable to save desktop session: {e}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(
                    &path,
                    std::fs::Permissions::from_mode(0o600),
                );
            }

            // Additionally store in the OS keyring when available (belt-and-suspenders).
            // Failures are silently tolerated — the file write above is sufficient.
            if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER) {
                let _ = entry.set_password(value);
            }

            Ok(())
        }
        _ => {
            if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER) {
                match entry.delete_credential() {
                    Ok(()) | Err(keyring::Error::NoEntry) => {}
                    Err(e) => return Err(format!("Unable to clear desktop session from keyring: {e}")),
                }
            }
            if let Some(path) = desktop_session_path() {
                let _ = std::fs::remove_file(path);
            }
            Ok(())
        }
    }
}

fn api_base_url() -> String {
    std::env::var(API_BASE_URL_ENV)
        .ok()
        .or_else(|| option_env!("ITEMFAB_API_BASE_URL").map(ToString::to_string))
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| {
            value.starts_with("https://")
                || value.starts_with("http://localhost:")
                || value.starts_with("http://127.0.0.1:")
        })
        .unwrap_or_else(|| API_BASE_URL.to_string())
}

fn generate_url_secret(bytes_length: usize) -> Result<String, String> {
    let mut bytes = vec![0_u8; bytes_length];
    getrandom::getrandom(&mut bytes).map_err(|e| e.to_string())?;
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    Ok(bytes
        .iter()
        .map(|byte| ALPHABET[usize::from(*byte) % ALPHABET.len()] as char)
        .collect())
}

// ─── API proxy ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn fetch_api_json(
    path: String,
    method: Option<String>,
    body: Option<serde_json::Value>,
    auth_state: tauri::State<'_, DesktopAuthState>,
) -> Result<serde_json::Value, String> {
    let base_url = api_base_url();
    let url = if path.starts_with("/api/") {
        format!("{base_url}{path}")
    } else if path.starts_with(&format!("{base_url}/api/"))
        || path.starts_with("https://itemfab.space/api/")
    {
        path
    } else {
        return Err("Unsupported API path".to_string());
    };

    let method = method.unwrap_or_else(|| "GET".to_string()).to_uppercase();
    let client = reqwest::Client::new();
    let mut request = match method.as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported API method: {method}")),
    }
    .header(reqwest::header::ACCEPT, "application/json");

    if let Some(token) = auth_state.get_token() {
        request = request.bearer_auth(token);
    }

    if let Some(payload) = body {
        request = request.json(&payload);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    let status = response.status();
    let payload = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Non-JSON response - HTTP {status}: {e}"))?;

    if !status.is_success() {
        // Clear a stale/expired token when the server rejects it, but only if a
        // token was actually sent — avoids wiping a valid session on transient
        // gateway/proxy 401s that are unrelated to the application session.
        if status == reqwest::StatusCode::UNAUTHORIZED && auth_state.get_token().is_some() {
            auth_state.set_token(None).ok();
        }
        let message = payload
            .get("message")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(message);
    }

    Ok(payload)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopOauthPayload {
    flow: String,
}

#[derive(Deserialize)]
struct DesktopExchangeResponse {
    #[serde(rename = "sessionToken")]
    session_token: String,
    #[serde(flatten)]
    payload: serde_json::Value,
}

fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Opening the system browser is not supported on this platform.".to_string())
}

async fn receive_desktop_oauth_callback(
    listener: TcpListener,
    expected_path: String,
) -> Result<(String, String), String> {
    let accept = async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut buffer = vec![0_u8; 8192];
            let bytes_read = stream.read(&mut buffer).await.map_err(|e| e.to_string())?;
            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
            let request_line = match request.lines().next() {
                Some(value) => value,
                None => {
                    continue;
                }
            };
            let target = match request_line.split_whitespace().nth(1) {
                Some(value) => value,
                None => {
                    continue;
                }
            };
            let url = match Url::parse(&format!("http://127.0.0.1{target}")) {
                Ok(value) => value,
                Err(_) => {
                    continue;
                }
            };
            if url.path() != expected_path {
                let html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Item Fabricator</title></head><body>Invalid callback.</body></html>";
                let response = format!(
                    "HTTP/1.1 404 Not Found\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html.len(),
                    html,
                );
                stream
                    .write_all(response.as_bytes())
                    .await
                    .map_err(|e| e.to_string())?;
                continue;
            }
            let code = url
                .query_pairs()
                .find(|(key, _)| key == "code")
                .map(|(_, value)| value.to_string());
            let flow = url
                .query_pairs()
                .find(|(key, _)| key == "flow")
                .map(|(_, value)| value.to_string())
                .unwrap_or_else(|| "discord".to_string());
            let error = url
                .query_pairs()
                .find(|(key, _)| key == "error")
                .map(|(_, value)| value.to_string());

            let html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Item Fabricator</title></head><body style=\"font-family:system-ui;background:#0b1220;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0\"><main><h1>Authentication complete</h1><p>You can return to Item Fabricator.</p></main></body></html>";
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(),
                html,
            );
            stream
                .write_all(response.as_bytes())
                .await
                .map_err(|e| e.to_string())?;

            if let Some(error) = error {
                return Err(error);
            }

            return Ok((
                flow,
                code.ok_or_else(|| "Desktop OAuth callback did not return a code.".to_string())?,
            ));
        }
    };

    tokio::time::timeout(tokio::time::Duration::from_secs(300), accept)
        .await
        .map_err(|_| "Desktop OAuth timed out.".to_string())?
}

#[tauri::command]
async fn start_desktop_oauth(
    payload: DesktopOauthPayload,
    auth_state: tauri::State<'_, DesktopAuthState>,
) -> Result<serde_json::Value, String> {
    let flow = payload.flow.trim().to_lowercase();
    if flow != "discord" && flow != "citizenid" {
        return Err("Unsupported desktop OAuth flow.".to_string());
    }

    let base_url = api_base_url();
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let callback_nonce = generate_url_secret(24)?;
    let callback_path = format!("/auth/desktop-callback/{callback_nonce}");
    let callback = format!("http://127.0.0.1:{port}{callback_path}");
    let login_path = if flow == "discord" {
        "/api/auth/discord/login"
    } else {
        "/api/auth/citizenid/login"
    };
    let encoded_callback =
        url::form_urlencoded::byte_serialize(callback.as_bytes()).collect::<String>();
    let login_url = format!("{base_url}{login_path}?desktop=1&desktopCallback={encoded_callback}");

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let mut login_request = client
        .get(&login_url)
        .header(reqwest::header::ACCEPT, "application/json");
    if let Some(token) = auth_state.get_token() {
        login_request = login_request.bearer_auth(token);
    }
    let login_response = login_request.send().await.map_err(|e| e.to_string())?;
    if !login_response.status().is_redirection() {
        let status = login_response.status();
        let message = login_response
            .text()
            .await
            .unwrap_or_else(|_| format!("HTTP {status}"));
        return Err(format!("Failed to start desktop OAuth: {message}"));
    }
    let authorization_url = login_response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Desktop OAuth login did not return a redirect URL.".to_string())?
        .to_string();

    open_system_browser(&authorization_url)?;
    let (_callback_flow, exchange_code) =
        receive_desktop_oauth_callback(listener, callback_path).await?;
    let exchange_response = reqwest::Client::new()
        .post(format!("{base_url}/api/auth/desktop/exchange"))
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&serde_json::json!({ "code": exchange_code }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = exchange_response.status();
    if !status.is_success() {
        let message = exchange_response
            .text()
            .await
            .unwrap_or_else(|_| format!("HTTP {status}"));
        return Err(format!("Desktop auth exchange failed: {message}"));
    }
    let payload = exchange_response
        .json::<DesktopExchangeResponse>()
        .await
        .map_err(|e| format!("Non-JSON desktop exchange response - HTTP {status}: {e}"))?;

    auth_state.set_token(Some(payload.session_token.clone()))?;
    Ok(payload.payload)
}

#[tauri::command]
fn clear_desktop_auth_session(
    auth_state: tauri::State<'_, DesktopAuthState>,
) -> Result<(), String> {
    auth_state.set_token(None)
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
    let raw_content = String::from_utf8_lossy(&bytes);
    // The RSI Launcher writes paths as JSON-encoded strings with escaped backslashes (e.g. E:\\SC\\...).
    // Normalize double backslashes to single before applying the path regex.
    let content = raw_content.replace(r"\\", r"\");

    let re =
        match Regex::new(r#"([a-zA-Z]:\\(?:[^\\:*?"<>|\r\n]+\\)*StarCitizen\\[A-Za-z0-9_.@-]+)"#) {
            Ok(r) => r,
            Err(_) => return vec![],
        };

    let mut seen: HashSet<String> = HashSet::new();
    let mut paths: Vec<PathBuf> = Vec::new();

    for caps in re.captures_iter(&content) {
        let raw = caps[1].trim().to_string();
        let p = PathBuf::from(&raw);
        if seen.insert(raw)
            && (p.join("Bin64").join("StarCitizen.exe").exists() || p.join("Data.p4k").exists())
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

fn collect_log_file_paths(channel_path: &Path) -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();

    let game_log = channel_path.join("Game.log");
    if game_log.is_file() {
        paths.push(game_log);
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
                paths.push(path.to_path_buf());
            }
        }
    }

    paths
}

fn collect_log_lines(channel_path: &Path) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();

    for path in collect_log_file_paths(channel_path) {
        if let Some(content) = read_log_file_lossy(&path) {
            lines.extend(content.lines().map(String::from));
        }
    }

    lines
}

fn build_blueprint_regex() -> Regex {
    // (?i) — case-insensitive in case game client varies capitalisation.
    // Flexible \s*:\s* handles both English ("Blueprint: Name:") and French
    // ("reçus : Nom:") colon spacing in one capture group.
    Regex::new(r"(?i)(?:Received Blueprint|Sch[eé]mas? re[cç]us?)\s*:\s*(.+?)\s*:")
        .expect("invalid blueprint regex")
}

fn extract_blueprints_from_lines<'a>(
    lines: impl Iterator<Item = &'a str>,
    re: &Regex,
    seen: &mut HashSet<String>,
) -> Vec<String> {
    let mut new_names = Vec::new();
    for line in lines {
        // Skip HUD notification queue-dump lines: these look like
        //   <timestamp>    "Schémas reçu : Name: " [N]
        // and repeat every time the notification queue is rendered (30–60×
        // per blueprint per session). Real log events always have the form
        //   <timestamp> [Notice/Error/Warning/Trace] ...
        // so we skip any line whose content after the timestamp opener is not
        // a log-level bracket.
        if let Some(after_ts) = line.split_once("> ") {
            if !after_ts.1.starts_with('[') {
                continue;
            }
        }
        if let Some(caps) = re.captures(line) {
            let name = caps
                .get(1)
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

/// Debug command: returns every raw log line that matched the blueprint regex,
/// paired with the extracted name, so UI can surface unmatched names for diagnosis.
#[tauri::command]
fn scan_raw_blueprint_lines(
    channel_path: String,
) -> Result<Vec<(String, String)>, String> {
    let path = PathBuf::from(&channel_path);
    if !path.is_dir() {
        return Err(format!("Path not found: {channel_path}"));
    }
    let re = build_blueprint_regex();
    let lines = collect_log_lines(&path);
    let matches = lines
        .into_iter()
        .filter_map(|line| {
            re.captures(&line).and_then(|caps| {
                let name = caps.get(1)?.as_str().trim().to_string();
                if name.is_empty() { None } else { Some((line, name)) }
            })
        })
        .collect();
    Ok(matches)
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
    let mut position: u64 = std::fs::metadata(&log_path).map(|m| m.len()).unwrap_or(0);
    let mut last_size: u64 = position;
    let mut last_modified: Option<std::time::SystemTime> =
        std::fs::metadata(&log_path).and_then(|m| m.modified()).ok();

    loop {
        tokio::time::sleep(tokio::time::Duration::from_millis(TAIL_POLL_MS)).await;

        if stop.load(Ordering::Relaxed) {
            break;
        }

        let metadata = match std::fs::metadata(&log_path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let current_size = metadata.len();
        let current_modified = metadata.modified().ok();

        // Log rotated (new game session) — restart from beginning
        if current_size < last_size
            || (current_modified != last_modified && current_size <= position)
        {
            position = 0;
        }
        last_size = current_size;
        last_modified = current_modified;

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
        let new_names = extract_blueprints_from_lines(text.lines(), &re, &mut known);

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

    tauri::async_runtime::spawn(run_log_watcher(log_path, stop, app, re, known));

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
        key.delete_value(APP_REGISTRY_NAME)
            .map_err(|e| e.to_string())?;
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
        .manage(DesktopAuthState::new())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_api_json,
            start_desktop_oauth,
            clear_desktop_auth_session,
            detect_sc_install_paths,
            scan_blueprints_from_logs,
            scan_raw_blueprint_lines,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_test_channel_dir(test_name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "item_fabricator_{test_name}_{}_{}",
            std::process::id(),
            nanos
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn scans_game_log_and_direct_logbackups_with_unique_blueprints() {
        let channel_dir = create_test_channel_dir("scan_logs");
        let backup_dir = channel_dir.join("logbackups");
        fs::create_dir_all(&backup_dir).unwrap();

        fs::write(
            channel_dir.join("Game.log"),
            "<2026-05-25T12:00:00.000Z> Received Blueprint: Current One: acquired\n",
        )
        .unwrap();
        fs::write(
            backup_dir.join("Game Build(1) 24 May 26.log"),
            "<2026-05-24T12:00:00.000Z> Received Blueprint: Backup One: acquired\n",
        )
        .unwrap();
        fs::write(
            backup_dir.join("Game Build(1) 23 May 26.log"),
            "<2026-05-23T12:00:00.000Z> Received Blueprint: Backup Two: acquired\n\
             <2026-05-23T12:01:00.000Z> Received Blueprint: Current One: duplicate\n",
        )
        .unwrap();
        fs::create_dir_all(backup_dir.join("nested")).unwrap();
        fs::write(
            backup_dir.join("nested").join("ignored.log"),
            "<2026-05-22T12:00:00.000Z> Received Blueprint: Nested Ignored: acquired\n",
        )
        .unwrap();

        let re = build_blueprint_regex();
        let lines = collect_log_lines(&channel_dir);
        let mut seen = HashSet::new();
        let blueprints = extract_blueprints_from_lines(lines.iter().map(String::as_str), &re, &mut seen);

        assert_eq!(blueprints.len(), 3);
        assert!(blueprints.contains(&"Current One".to_string()));
        assert!(blueprints.contains(&"Backup One".to_string()));
        assert!(blueprints.contains(&"Backup Two".to_string()));
        assert!(!blueprints.contains(&"Nested Ignored".to_string()));

        let _ = fs::remove_dir_all(channel_dir);
    }

    #[test]
    fn blueprint_regex_handles_english_and_french_notifications() {
        let re = build_blueprint_regex();
        let lines = [
            "<2026-05-25T12:00:00.000Z> Received Blueprint: English Name: acquired",
            "<2026-05-25T12:01:00.000Z> Schéma reçu : Nom Francais: acquis",
            "<2026-05-25T12:02:00.000Z> Schémas reçus : Nom Pluriel: acquis",
        ];
        let mut seen = HashSet::new();
        let blueprints = extract_blueprints_from_lines(lines.iter().copied(), &re, &mut seen);

        assert_eq!(
            blueprints,
            vec![
                "English Name".to_string(),
                "Nom Francais".to_string(),
                "Nom Pluriel".to_string(),
            ]
        );
    }

    #[test]
    fn blueprint_regex_is_case_insensitive() {
        let re = build_blueprint_regex();
        let lines = [
            // Lower-case prefix variant
            "<2026-05-25T12:00:00.000Z> received blueprint: Lower Case Name: acquired",
            // Mixed-case French variant
            "<2026-05-25T12:01:00.000Z> SCHÉMA REÇU : NOM MAJUSCULE: acquis",
            // Schema/Schemas unaccented ASCII (some regions)
            "<2026-05-25T12:02:00.000Z> Schemas recus : Unaccented: acquis",
        ];
        let mut seen = HashSet::new();
        let blueprints = extract_blueprints_from_lines(lines.iter().copied(), &re, &mut seen);

        assert_eq!(blueprints.len(), 3);
        assert!(blueprints.contains(&"Lower Case Name".to_string()));
        assert!(blueprints.contains(&"NOM MAJUSCULE".to_string()));
        assert!(blueprints.contains(&"Unaccented".to_string()));
    }

    #[test]
    fn blueprint_regex_handles_flexible_colon_spacing() {
        let re = build_blueprint_regex();
        // Extra spaces around the separator colon
        let lines = [
            "<2026-05-25T12:00:00.000Z> Received Blueprint : Spaced Colon: acquired",
            "<2026-05-25T12:01:00.000Z> Schéma reçu:No Space French: acquis",
        ];
        let mut seen = HashSet::new();
        let blueprints = extract_blueprints_from_lines(lines.iter().copied(), &re, &mut seen);

        assert_eq!(blueprints.len(), 2);
        assert!(blueprints.contains(&"Spaced Colon".to_string()));
        assert!(blueprints.contains(&"No Space French".to_string()));
    }
}
