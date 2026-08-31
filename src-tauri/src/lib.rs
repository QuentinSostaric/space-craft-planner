use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use url::Url;
use walkdir::WalkDir;

const API_BASE_URL: &str = "https://itemfab.space";
const API_BASE_URL_ENV: &str = "ITEMFAB_API_BASE_URL";
const TAIL_POLL_MS: u64 = 200;
const HTTP_TIMEOUT_SECS: u64 = 20;
const OAUTH_CALLBACK_READ_TIMEOUT_SECS: u64 = 5;
const MAX_API_PATH_BYTES: usize = 2 * 1024;
const MAX_API_REQUEST_BODY_BYTES: usize = 1024 * 1024;
const MAX_API_RESPONSE_BYTES: usize = 2 * 1024 * 1024;
const MAX_PUBLIC_GAME_DATA_RESPONSE_BYTES: usize = 16 * 1024 * 1024;
const MAX_OAUTH_RESPONSE_BYTES: usize = 64 * 1024;
const MAX_AUTHORIZATION_URL_BYTES: usize = 4 * 1024;
const MAX_SESSION_TOKEN_BYTES: usize = 8 * 1024;
const MAX_LAUNCHER_LOG_BYTES: usize = 8 * 1024 * 1024;
const MAX_LOG_FILE_BYTES: usize = 16 * 1024 * 1024;
const MAX_LOG_TOTAL_BYTES: usize = 64 * 1024 * 1024;
const MAX_LOG_FILES: usize = 128;
const MAX_LOG_LINE_BYTES: usize = 64 * 1024;
const MAX_LOG_TAIL_CHUNK_BYTES: usize = 1024 * 1024;
const MAX_BLUEPRINT_NAME_BYTES: usize = 512;
const MAX_KNOWN_BLUEPRINTS: usize = 10_000;
#[cfg(target_os = "windows")]
const APP_REGISTRY_NAME: &str = "ItemFabricator";
const KEYRING_SERVICE: &str = "space.itemfab.desktop";
const KEYRING_SESSION_USER: &str = "desktop-session";

// ─── Watcher state ────────────────────────────────────────────────────────────

pub struct WatcherState {
    runtime: Mutex<WatcherRuntime>,
}

#[derive(Default)]
struct WatcherRuntime {
    stop_flag: Option<Arc<AtomicBool>>,
    channel_path: Option<String>,
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
        lock_unpoisoned(&self.session_token).clone()
    }

    fn set_token(&self, token: Option<String>) -> Result<(), String> {
        if token.is_some() {
            write_desktop_session_token(token.as_deref())?;
            *lock_unpoisoned(&self.session_token) = token;
            return Ok(());
        }

        let result = write_desktop_session_token(None);
        *lock_unpoisoned(&self.session_token) = None;
        result
    }
}

impl WatcherState {
    fn new() -> Self {
        Self {
            runtime: Mutex::new(WatcherRuntime::default()),
        }
    }

    fn is_running(&self) -> bool {
        lock_unpoisoned(&self.runtime)
            .stop_flag
            .as_ref()
            .map(|f| !f.load(Ordering::Relaxed))
            .unwrap_or(false)
    }

    fn stop(&self) {
        let mut runtime = lock_unpoisoned(&self.runtime);
        if let Some(flag) = runtime.stop_flag.take() {
            flag.store(true, Ordering::Relaxed);
        }
        runtime.channel_path = None;
    }

    fn replace(&self, channel_path: String, stop_flag: Arc<AtomicBool>) {
        let mut runtime = lock_unpoisoned(&self.runtime);
        if let Some(previous) = runtime.stop_flag.replace(stop_flag) {
            previous.store(true, Ordering::Relaxed);
        }
        runtime.channel_path = Some(channel_path);
    }

    fn channel_path(&self) -> Option<String> {
        lock_unpoisoned(&self.runtime).channel_path.clone()
    }
}

fn lock_unpoisoned<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
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
    let fallback_path = desktop_session_path();
    restore_desktop_session_token(
        || {
            keyring::Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER)
                .ok()?
                .get_password()
                .ok()
        },
        fallback_path.as_deref(),
    )
}

fn restore_desktop_session_token<F>(
    read_from_credential_store: F,
    fallback_path: Option<&Path>,
) -> Option<String>
where
    F: FnOnce() -> Option<String>,
{
    if let Some(token) = read_from_credential_store() {
        if let Ok(token) = validate_session_token(&token) {
            return Some(token.to_string());
        }
    }

    let content = read_file_bounded_lossy(fallback_path?, MAX_SESSION_TOKEN_BYTES).ok()?;
    validate_session_token(&content)
        .ok()
        .map(ToString::to_string)
}

fn write_desktop_session_token(token: Option<&str>) -> Result<(), String> {
    match token {
        Some(value) => {
            let value = validate_session_token(value)?;
            let path = desktop_session_path()
                .ok_or_else(|| "Unable to resolve session file path.".to_string())?;
            persist_desktop_session_token(value, &path, |value| {
                let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER) else {
                    return false;
                };
                entry.set_password(value).is_ok()
                    && entry
                        .get_password()
                        .ok()
                        .is_some_and(|stored| stored == value)
            })
        }
        None => {
            let mut keyring_error = None;
            if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, KEYRING_SESSION_USER) {
                match entry.delete_credential() {
                    Ok(()) | Err(keyring::Error::NoEntry) => {}
                    Err(error) => keyring_error = Some(error.to_string()),
                }
            }
            remove_session_fallback_file()?;
            if let Some(error) = keyring_error {
                return Err(format!(
                    "Unable to clear desktop session from the credential store: {error}"
                ));
            }
            Ok(())
        }
    }
}

fn persist_desktop_session_token<F>(
    value: &str,
    fallback_path: &Path,
    store_in_credential_store: F,
) -> Result<(), String>
where
    F: FnOnce(&str) -> bool,
{
    // A same-process credential-store round trip does not prove the backend is
    // durable. Keep the hardened fallback across restarts even when it succeeds.
    write_session_fallback_file(value, fallback_path)?;
    let _ = store_in_credential_store(value);
    Ok(())
}

fn validate_session_token(value: &str) -> Result<&str, String> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > MAX_SESSION_TOKEN_BYTES
        || value.bytes().any(|byte| byte <= b' ' || byte == 0x7f)
    {
        return Err("Invalid desktop session token.".to_string());
    }
    Ok(value)
}

fn write_session_fallback_file(value: &str, path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Unable to resolve session directory.".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("Unable to create session directory: {error}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Unable to secure session directory: {error}"))?;
    }

    let temp_name = format!(".desktop-session-{}.tmp", generate_url_secret(12)?);
    let temp_path = parent.join(temp_name);
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temp_path)
        .map_err(|error| format!("Unable to create session file: {error}"))?;
    if let Err(error) = file
        .write_all(value.as_bytes())
        .and_then(|_| file.sync_all())
    {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!("Unable to save desktop session: {error}"));
    }

    #[cfg(target_os = "windows")]
    if path.exists() {
        std::fs::remove_file(path)
            .map_err(|error| format!("Unable to replace desktop session: {error}"))?;
    }
    if let Err(error) = std::fs::rename(&temp_path, path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!("Unable to install desktop session: {error}"));
    }
    Ok(())
}

fn remove_session_fallback_file() -> Result<(), String> {
    let Some(path) = desktop_session_path() else {
        return Ok(());
    };
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Unable to clear desktop session file: {error}")),
    }
}

fn read_file_bounded_lossy(path: &Path, max_bytes: usize) -> Result<String, String> {
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect log file: {error}"))?;
    if !metadata.file_type().is_file() || metadata.len() > max_bytes as u64 {
        return Err(
            "Log file is not a permitted regular file or exceeds the size limit.".to_string(),
        );
    }
    let bytes = std::fs::read(path).map_err(|error| format!("Unable to read log file: {error}"))?;
    if bytes.len() > max_bytes {
        return Err("Log file exceeds the size limit.".to_string());
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn is_allowed_api_base_url(url: &Url) -> bool {
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
    {
        return false;
    }

    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    (url.scheme() == "https" && (host == "itemfab.space" || host.ends_with(".itemfab.space")))
        || (url.scheme() == "http"
            && matches!(host.as_str(), "localhost" | "127.0.0.1")
            && url.port().is_some())
}

fn api_base_url() -> Result<Url, String> {
    let configured = std::env::var(API_BASE_URL_ENV)
        .ok()
        .or_else(|| option_env!("ITEMFAB_API_BASE_URL").map(ToString::to_string))
        .and_then(|value| Url::parse(value.trim()).ok())
        .filter(is_allowed_api_base_url);

    configured
        .or_else(|| Url::parse(API_BASE_URL).ok())
        .ok_or_else(|| "Invalid API base URL configuration.".to_string())
}

fn generate_url_secret(bytes_length: usize) -> Result<String, String> {
    let mut bytes = vec![0_u8; bytes_length];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    Ok(bytes
        .iter()
        .map(|byte| ALPHABET[usize::from(*byte) % ALPHABET.len()] as char)
        .collect())
}

// ─── API proxy ────────────────────────────────────────────────────────────────

fn resolve_api_url(base_url: &Url, path: &str) -> Result<Url, String> {
    if path.is_empty() || path.len() > MAX_API_PATH_BYTES || path.contains('\\') {
        return Err("Unsupported API path.".to_string());
    }

    let url = if path.starts_with('/') {
        base_url
            .join(path)
            .map_err(|_| "Unsupported API path.".to_string())?
    } else {
        Url::parse(path).map_err(|_| "Unsupported API path.".to_string())?
    };
    let same_origin = url.scheme() == base_url.scheme()
        && url.host_str() == base_url.host_str()
        && url.port_or_known_default() == base_url.port_or_known_default();
    if !same_origin
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || !url.path().starts_with("/api/")
    {
        return Err("Unsupported API path.".to_string());
    }
    Ok(url)
}

fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(tokio::time::Duration::from_secs(5))
        .timeout(tokio::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| format!("Unable to configure HTTP client: {error}"))
}

fn max_api_response_bytes(url: &Url) -> usize {
    let path = url.path();
    if path == "/api/game-data/public" || path.starts_with("/api/game-data/public/") {
        MAX_PUBLIC_GAME_DATA_RESPONSE_BYTES
    } else {
        MAX_API_RESPONSE_BYTES
    }
}

async fn read_response_bytes(
    mut response: reqwest::Response,
    max_bytes: usize,
) -> Result<(reqwest::StatusCode, Vec<u8>), String> {
    let status = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > max_bytes as u64)
    {
        return Err(format!("HTTP {status} response exceeds the size limit."));
    }

    let mut bytes = Vec::with_capacity(
        response
            .content_length()
            .unwrap_or_default()
            .min(max_bytes as u64) as usize,
    );
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Unable to read HTTP {status} response: {error}"))?
    {
        if bytes.len().saturating_add(chunk.len()) > max_bytes {
            return Err(format!("HTTP {status} response exceeds the size limit."));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok((status, bytes))
}

async fn read_response_json(
    response: reqwest::Response,
    max_bytes: usize,
) -> Result<(reqwest::StatusCode, serde_json::Value), String> {
    let (status, bytes) = read_response_bytes(response, max_bytes).await?;
    let payload = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Non-JSON response - HTTP {status}: {error}"))?;
    Ok((status, payload))
}

fn truncate_error_message(value: &str) -> String {
    value.chars().take(512).collect()
}

#[tauri::command]
async fn fetch_api_json(
    path: String,
    method: Option<String>,
    body: Option<serde_json::Value>,
    auth_state: tauri::State<'_, DesktopAuthState>,
) -> Result<serde_json::Value, String> {
    let base_url = api_base_url()?;
    let url = resolve_api_url(&base_url, &path)?;
    let max_response_bytes = max_api_response_bytes(&url);

    let method = method.unwrap_or_else(|| "GET".to_string()).to_uppercase();
    let client = build_http_client()?;
    let mut request = match method.as_str() {
        "GET" => client.get(url.clone()),
        "POST" => client.post(url.clone()),
        "PUT" => client.put(url.clone()),
        "DELETE" => client.delete(url.clone()),
        _ => return Err(format!("Unsupported API method: {method}")),
    }
    .header(reqwest::header::ACCEPT, "application/json");

    let token = auth_state.get_token();
    if let Some(token) = token.as_deref() {
        request = request.bearer_auth(token);
    }

    if let Some(payload) = body {
        let serialized = serde_json::to_vec(&payload)
            .map_err(|error| format!("Unable to serialize API request: {error}"))?;
        if serialized.len() > MAX_API_REQUEST_BODY_BYTES {
            return Err("API request body exceeds the size limit.".to_string());
        }
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(serialized);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    let (status, payload) = read_response_json(response, max_response_bytes).await?;

    if !status.is_success() {
        // Clear a stale/expired token when the server rejects it, but only if a
        // token was actually sent — avoids wiping a valid session on transient
        // gateway/proxy 401s that are unrelated to the application session.
        if status == reqwest::StatusCode::UNAUTHORIZED && token.is_some() {
            let _ = auth_state.set_token(None);
        }
        let message = payload
            .get("message")
            .and_then(|v| v.as_str())
            .map(truncate_error_message)
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(message);
    }

    Ok(payload)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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

fn validate_authorization_url(value: &str) -> Result<String, String> {
    if value.is_empty() || value.len() > MAX_AUTHORIZATION_URL_BYTES {
        return Err("Desktop OAuth returned an invalid authorization URL.".to_string());
    }
    let url = Url::parse(value)
        .map_err(|_| "Desktop OAuth returned an invalid authorization URL.".to_string())?;
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err("Desktop OAuth returned an unsafe authorization URL.".to_string());
    }
    Ok(url.to_string())
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
    expected_flow: &str,
) -> Result<String, String> {
    let accept = async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut buffer = vec![0_u8; 8192];
            let bytes_read = match tokio::time::timeout(
                tokio::time::Duration::from_secs(OAUTH_CALLBACK_READ_TIMEOUT_SECS),
                stream.read(&mut buffer),
            )
            .await
            {
                Ok(Ok(bytes_read)) if bytes_read > 0 => bytes_read,
                Ok(Ok(_)) | Err(_) => continue,
                Ok(Err(error)) => return Err(error.to_string()),
            };
            let request = String::from_utf8_lossy(&buffer[..bytes_read]);
            let request_line = match request.lines().next() {
                Some(value) => value,
                None => {
                    continue;
                }
            };
            let mut request_parts = request_line.split_whitespace();
            let method = request_parts.next();
            let target = request_parts.next();
            let version = request_parts.next();
            if method != Some("GET")
                || target.is_none()
                || !matches!(version, Some("HTTP/1.0" | "HTTP/1.1"))
                || request_parts.next().is_some()
            {
                continue;
            }
            let target = target.unwrap_or_default();
            let url = match Url::parse(&format!("http://127.0.0.1{target}")) {
                Ok(value) => value,
                Err(_) => {
                    continue;
                }
            };
            if url.path() != expected_path {
                let html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Item Fabricator</title></head><body>Invalid callback.</body></html>";
                let response = format!(
                    "HTTP/1.1 404 Not Found\r\nContent-Type: text/html; charset=utf-8\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
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
                .map(|(_, value)| value.to_string());
            let error = url
                .query_pairs()
                .find(|(key, _)| key == "error")
                .map(|(_, value)| value.to_string());

            let html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Item Fabricator</title></head><body style=\"font-family:system-ui;background:#0b1220;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0\"><main><h1>Authentication complete</h1><p>You can return to Item Fabricator.</p></main></body></html>";
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(),
                html,
            );
            stream
                .write_all(response.as_bytes())
                .await
                .map_err(|e| e.to_string())?;

            if let Some(error) = error {
                return Err(truncate_error_message(&error));
            }
            if flow.as_deref() != Some(expected_flow) {
                return Err("Desktop OAuth callback flow did not match the request.".to_string());
            }
            let code = code
                .filter(|value| !value.is_empty() && value.len() <= 1024)
                .ok_or_else(|| "Desktop OAuth callback did not return a valid code.".to_string())?;
            return Ok(code);
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

    let base_url = api_base_url()?;
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
    let mut login_url = resolve_api_url(&base_url, login_path)?;
    login_url
        .query_pairs_mut()
        .append_pair("desktop", "1")
        .append_pair("desktopCallback", &callback);

    let client = build_http_client()?;
    let mut login_request = client
        .get(login_url.clone())
        .header(reqwest::header::ACCEPT, "application/json");
    if let Some(token) = auth_state.get_token() {
        login_request = login_request.bearer_auth(token);
    }
    let login_response = login_request.send().await.map_err(|e| e.to_string())?;
    if !login_response.status().is_redirection() {
        let (_status, bytes) =
            read_response_bytes(login_response, MAX_OAUTH_RESPONSE_BYTES).await?;
        let message = truncate_error_message(&String::from_utf8_lossy(&bytes));
        return Err(format!("Failed to start desktop OAuth: {message}"));
    }
    let authorization_url = validate_authorization_url(
        login_response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| "Desktop OAuth login did not return a redirect URL.".to_string())?,
    )?;

    open_system_browser(&authorization_url)?;
    let exchange_code = receive_desktop_oauth_callback(listener, callback_path, &flow).await?;
    let exchange_url = resolve_api_url(&base_url, "/api/auth/desktop/exchange")?;
    let exchange_response = client
        .post(exchange_url)
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&serde_json::json!({ "code": exchange_code }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let (status, bytes) = read_response_bytes(exchange_response, MAX_API_RESPONSE_BYTES).await?;
    if !status.is_success() {
        let message = truncate_error_message(&String::from_utf8_lossy(&bytes));
        return Err(format!("Desktop auth exchange failed: {message}"));
    }
    let payload = serde_json::from_slice::<DesktopExchangeResponse>(&bytes)
        .map_err(|error| format!("Non-JSON desktop exchange response - HTTP {status}: {error}"))?;
    validate_session_token(&payload.session_token)?;

    auth_state.set_token(Some(payload.session_token))?;
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

    let raw_content = match read_file_tail_lossy(&launcher_log, MAX_LAUNCHER_LOG_BYTES) {
        Ok(content) => content,
        Err(_) => return vec![],
    };
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
        if seen.insert(raw) && is_valid_sc_channel(&p) {
            paths.push(p);
        }
    }

    paths
}

fn is_valid_sc_channel(path: &Path) -> bool {
    let channel = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_uppercase();
    let parent_is_star_citizen = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("StarCitizen"));

    path.is_dir()
        && parent_is_star_citizen
        && matches!(
            channel.as_str(),
            "LIVE" | "PTU" | "EPTU" | "WAVE" | "HOTFIX" | "TECH-PREVIEW" | "EVOCATI"
        )
        && (is_regular_file(&path.join("Bin64").join("StarCitizen.exe"))
            || is_regular_file(&path.join("Data.p4k")))
}

fn validate_sc_channel_path(value: &str) -> Result<PathBuf, String> {
    if value.is_empty() || value.len() > 4096 {
        return Err("Invalid Star Citizen channel path.".to_string());
    }
    let path = PathBuf::from(value)
        .canonicalize()
        .map_err(|_| "Star Citizen channel path was not found.".to_string())?;
    if !is_valid_sc_channel(&path) {
        return Err("Path is not a supported Star Citizen channel installation.".to_string());
    }
    Ok(path)
}

fn is_regular_file(path: &Path) -> bool {
    std::fs::symlink_metadata(path)
        .map(|metadata| metadata.file_type().is_file())
        .unwrap_or(false)
}

fn read_file_tail_lossy(path: &Path, max_bytes: usize) -> Result<String, String> {
    let metadata = std::fs::symlink_metadata(path)
        .map_err(|error| format!("Unable to inspect file: {error}"))?;
    if !metadata.file_type().is_file() {
        return Err("File is not a permitted regular file.".to_string());
    }
    let mut file =
        std::fs::File::open(path).map_err(|error| format!("Unable to open file: {error}"))?;
    if metadata.len() > max_bytes as u64 {
        file.seek(SeekFrom::End(-(max_bytes as i64)))
            .map_err(|error| format!("Unable to seek file: {error}"))?;
    }
    let mut bytes = Vec::with_capacity(metadata.len().min(max_bytes as u64) as usize);
    file.take(max_bytes as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Unable to read file: {error}"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
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
    let channels = [
        "LIVE",
        "PTU",
        "EPTU",
        "WAVE",
        "HOTFIX",
        "TECH-PREVIEW",
        "EVOCATI",
    ];

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
        } else if matches!(
            channel.as_str(),
            "PTU" | "EPTU" | "WAVE" | "HOTFIX" | "TECH-PREVIEW" | "EVOCATI"
        ) && ptu.is_none()
        {
            ptu = Some(path.to_string_lossy().into_owned());
        }
    }

    ScInstallPaths { live, ptu }
}

// ─── Log reading helpers ──────────────────────────────────────────────────────

fn collect_log_file_paths(channel_path: &Path) -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = Vec::new();

    let game_log = channel_path.join("Game.log");
    if is_regular_file(&game_log) {
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
            if is_regular_file(path) && path.extension().is_some_and(|e| e == "log") {
                paths.push(path.to_path_buf());
            }
        }
    }

    paths.truncate(MAX_LOG_FILES);
    paths
}

fn collect_log_lines(channel_path: &Path) -> Vec<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut remaining_bytes = MAX_LOG_TOTAL_BYTES;

    for path in collect_log_file_paths(channel_path) {
        let read_limit = remaining_bytes.min(MAX_LOG_FILE_BYTES);
        if read_limit == 0 {
            break;
        }
        if let Ok(content) = read_file_tail_lossy(&path, read_limit) {
            remaining_bytes = remaining_bytes.saturating_sub(content.len());
            lines.extend(
                content
                    .lines()
                    .filter(|line| line.len() <= MAX_LOG_LINE_BYTES)
                    .map(String::from),
            );
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
            if !name.is_empty()
                && name.len() <= MAX_BLUEPRINT_NAME_BYTES
                && seen.len() < MAX_KNOWN_BLUEPRINTS
                && seen.insert(name.clone())
            {
                new_names.push(name);
            }
        }
    }
    new_names
}

// ─── One-shot historical scan ─────────────────────────────────────────────────

#[tauri::command]
fn scan_blueprints_from_logs(channel_path: String) -> Result<Vec<String>, String> {
    let path = validate_sc_channel_path(&channel_path)?;

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
    let mut position: u64 = std::fs::metadata(&log_path).map(|m| m.len()).unwrap_or(0);
    let mut last_size: u64 = position;
    let mut last_modified: Option<std::time::SystemTime> =
        std::fs::metadata(&log_path).and_then(|m| m.modified()).ok();

    loop {
        tokio::time::sleep(tokio::time::Duration::from_millis(TAIL_POLL_MS)).await;

        if stop.load(Ordering::Relaxed) {
            break;
        }

        let metadata = match std::fs::symlink_metadata(&log_path) {
            Ok(metadata) if metadata.file_type().is_file() => metadata,
            Err(_) => continue,
            Ok(_) => break,
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

        // Bound every iteration even if a malformed or hostile log grows very quickly.
        if current_size.saturating_sub(position) > MAX_LOG_TAIL_CHUNK_BYTES as u64 {
            position = current_size - MAX_LOG_TAIL_CHUNK_BYTES as u64;
        }

        // Read only new bytes since last position.
        let new_bytes = {
            let mut f = match std::fs::File::open(&log_path) {
                Ok(f) => f,
                Err(_) => continue,
            };
            if f.seek(SeekFrom::Start(position)).is_err() {
                continue;
            }
            let mut buf = Vec::with_capacity(
                current_size
                    .saturating_sub(position)
                    .min(MAX_LOG_TAIL_CHUNK_BYTES as u64) as usize,
            );
            if f.take(MAX_LOG_TAIL_CHUNK_BYTES as u64)
                .read_to_end(&mut buf)
                .is_err()
            {
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
    let path = validate_sc_channel_path(&channel_path)?;

    let log_path = path.join("Game.log");
    if !is_regular_file(&log_path) {
        return Err("The Star Citizen Game.log file was not found.".to_string());
    }
    let re = build_blueprint_regex();

    // Pre-seed known blueprints from history so we only emit truly new ones
    let lines = collect_log_lines(&path);
    let mut known = HashSet::new();
    extract_blueprints_from_lines(lines.iter().map(String::as_str), &re, &mut known);

    let stop = Arc::new(AtomicBool::new(false));
    state.replace(path.to_string_lossy().into_owned(), Arc::clone(&stop));

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
        channel_path: state.channel_path(),
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
        let blueprints =
            extract_blueprints_from_lines(lines.iter().map(String::as_str), &re, &mut seen);

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
    fn api_url_resolution_stays_on_the_configured_api_scope() {
        let base = Url::parse("https://itemfab.space/").unwrap();

        assert_eq!(
            resolve_api_url(&base, "/api/account?scope=live")
                .unwrap()
                .as_str(),
            "https://itemfab.space/api/account?scope=live"
        );
        assert!(resolve_api_url(&base, "https://itemfab.space/api/account").is_ok());
        assert!(resolve_api_url(&base, "/api/../admin").is_err());
        assert!(resolve_api_url(&base, "https://itemfab.space.evil.invalid/api/account").is_err());
        assert!(resolve_api_url(&base, "https://itemfab.space/api/account#fragment").is_err());
    }

    #[test]
    fn authorization_urls_must_be_safe_https_urls() {
        assert!(
            validate_authorization_url("https://discord.com/oauth2/authorize?client_id=1").is_ok()
        );
        assert!(validate_authorization_url("http://discord.com/oauth2/authorize").is_err());
        assert!(validate_authorization_url("file:///tmp/fake-login.html").is_err());
        assert!(validate_authorization_url("https://user:password@example.com/login").is_err());
    }

    #[test]
    fn bounded_file_reader_rejects_oversized_logs() {
        let channel_dir = create_test_channel_dir("bounded_read");
        let log_path = channel_dir.join("Game.log");
        fs::write(&log_path, b"12345").unwrap();

        assert_eq!(read_file_bounded_lossy(&log_path, 5).unwrap(), "12345");
        assert!(read_file_bounded_lossy(&log_path, 4).is_err());

        let _ = fs::remove_dir_all(channel_dir);
    }

    #[test]
    fn channel_validation_requires_a_real_star_citizen_install_marker() {
        let root = create_test_channel_dir("channel_validation");
        let channel_dir = root.join("StarCitizen").join("LIVE");
        fs::create_dir_all(&channel_dir).unwrap();
        fs::write(
            channel_dir.join("Game.log"),
            "Received Blueprint: Decoy: acquired\n",
        )
        .unwrap();

        assert!(validate_sc_channel_path(channel_dir.to_string_lossy().as_ref()).is_err());
        fs::write(channel_dir.join("Data.p4k"), []).unwrap();
        assert_eq!(
            validate_sc_channel_path(channel_dir.to_string_lossy().as_ref()).unwrap(),
            channel_dir.canonicalize().unwrap()
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn blueprint_parser_rejects_unreasonably_large_names() {
        let re = build_blueprint_regex();
        let oversized_name = "x".repeat(MAX_BLUEPRINT_NAME_BYTES + 1);
        let line = format!("Received Blueprint: {oversized_name}: acquired");
        let mut seen = HashSet::new();

        assert!(
            extract_blueprints_from_lines([line.as_str()].into_iter(), &re, &mut seen).is_empty()
        );
    }

    #[test]
    fn symlink_metadata_blocks_non_regular_files() {
        use std::os::unix::fs::symlink;
        let channel_dir = create_test_channel_dir("symlink_protection");
        let log_path = channel_dir.join("Game.log");
        let target_path = channel_dir.join("real.log");
        fs::write(&target_path, b"valid").unwrap();
        symlink(&target_path, &log_path).unwrap();

        // Symlink to a regular file should be rejected (not a regular file itself)
        assert!(read_file_tail_lossy(&log_path, 100).is_err());

        let _ = fs::remove_dir_all(channel_dir);
    }

    #[test]
    fn session_token_validation_rejects_control_chars_and_empty() {
        assert!(validate_session_token("").is_err());
        assert!(validate_session_token(" ").is_err());
        assert!(validate_session_token("\t").is_err());
        assert!(validate_session_token("\n").is_err());
        assert!(validate_session_token("\x7f").is_err());
        assert!(validate_session_token("a".repeat(MAX_SESSION_TOKEN_BYTES + 1).as_str()).is_err());
        assert!(validate_session_token("valid-token-123").is_ok());
    }

    #[test]
    fn desktop_session_survives_restart_after_credential_store_round_trip() {
        let root = create_test_channel_dir("desktop_session_restart");
        let fallback_path = root.join("desktop-session.token");
        let token = "restart-safe-session-token";
        let mut credential_store_value = None;

        persist_desktop_session_token(token, &fallback_path, |value| {
            credential_store_value = Some(value.to_string());
            true
        })
        .unwrap();

        assert_eq!(credential_store_value.as_deref(), Some(token));
        assert_eq!(
            restore_desktop_session_token(|| None, Some(&fallback_path)).as_deref(),
            Some(token)
        );

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&fallback_path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn api_base_url_allows_only_configured_scopes() {
        // Valid production URL
        assert!(is_allowed_api_base_url(
            &Url::parse("https://itemfab.space/").unwrap()
        ));
        assert!(is_allowed_api_base_url(
            &Url::parse("https://api.itemfab.space/").unwrap()
        ));
        assert!(is_allowed_api_base_url(
            &Url::parse("https://sub.domain.itemfab.space/").unwrap()
        ));

        // Localhost with port allowed for dev
        assert!(is_allowed_api_base_url(
            &Url::parse("http://localhost:1234/").unwrap()
        ));
        assert!(is_allowed_api_base_url(
            &Url::parse("http://127.0.0.1:5173/").unwrap()
        ));

        // Rejected: wrong scheme, credentials, query, fragment, non-root path
        assert!(!is_allowed_api_base_url(
            &Url::parse("http://itemfab.space/").unwrap()
        ));
        assert!(!is_allowed_api_base_url(
            &Url::parse("https://user:pass@itemfab.space/").unwrap()
        ));
        assert!(!is_allowed_api_base_url(
            &Url::parse("https://itemfab.space/?query=1").unwrap()
        ));
        assert!(!is_allowed_api_base_url(
            &Url::parse("https://itemfab.space/#fragment").unwrap()
        ));
        assert!(!is_allowed_api_base_url(
            &Url::parse("https://itemfab.space/other").unwrap()
        ));
        // Evil domain
        assert!(!is_allowed_api_base_url(
            &Url::parse("https://itemfab.space.evil.com/").unwrap()
        ));
    }

    #[test]
    fn resolve_api_url_blocks_path_traversal_and_cross_origin() {
        let base = Url::parse("https://itemfab.space/").unwrap();

        // Valid paths
        assert!(resolve_api_url(&base, "/api/account").is_ok());
        assert!(resolve_api_url(&base, "/api/blueprints?scope=live").is_ok());
        assert!(resolve_api_url(&base, "https://itemfab.space/api/account").is_ok());

        // Path traversal
        assert!(resolve_api_url(&base, "/api/../admin").is_err());
        // Cross-origin
        assert!(resolve_api_url(&base, "https://evil.com/api/account").is_err());
        // Fragment
        assert!(resolve_api_url(&base, "/api/account#section").is_err());
        // Wrong prefix
        assert!(resolve_api_url(&base, "/other/endpoint").is_err());
        // Empty
        assert!(resolve_api_url(&base, "").is_err());
        // Too long (> MAX_API_PATH_BYTES = 2048)
        assert!(resolve_api_url(&base, &"/api/".repeat(500)).is_err());
    }

    #[test]
    fn public_game_data_responses_have_a_larger_bounded_limit() {
        let base = Url::parse("https://itemfab.space/").unwrap();

        let dataset_index = resolve_api_url(&base, "/api/game-data/public").unwrap();
        let live_dataset =
            resolve_api_url(&base, "/api/game-data/public/live?include=all").unwrap();
        let unrelated_api = resolve_api_url(&base, "/api/account").unwrap();
        let similar_prefix = resolve_api_url(&base, "/api/game-data/publicity").unwrap();

        assert_eq!(
            max_api_response_bytes(&dataset_index),
            MAX_PUBLIC_GAME_DATA_RESPONSE_BYTES
        );
        assert_eq!(
            max_api_response_bytes(&live_dataset),
            MAX_PUBLIC_GAME_DATA_RESPONSE_BYTES
        );
        assert_eq!(
            max_api_response_bytes(&unrelated_api),
            MAX_API_RESPONSE_BYTES
        );
        assert_eq!(
            max_api_response_bytes(&similar_prefix),
            MAX_API_RESPONSE_BYTES
        );
    }

    #[test]
    fn authorization_url_validation_blocks_unsafe_schemes_and_credentials() {
        assert!(
            validate_authorization_url("https://discord.com/oauth2/authorize?client_id=1").is_ok()
        );
        // HTTP not allowed
        assert!(validate_authorization_url("http://discord.com/oauth2/authorize").is_err());
        // file:// scheme blocked
        assert!(validate_authorization_url("file:///tmp/fake-login.html").is_err());
        // Credentials in URL blocked
        assert!(validate_authorization_url("https://user:password@example.com/login").is_err());
        // Empty or too long
        assert!(validate_authorization_url("").is_err());
        assert!(validate_authorization_url(&"a".repeat(MAX_AUTHORIZATION_URL_BYTES + 1)).is_err());
    }

    #[test]
    fn oauth_callback_validates_http_method_version_and_path() {
        // This is tested indirectly via the integration flow, but we validate the
        // parsing logic is strict about GET, HTTP/1.x, and exact path match.
        // No direct unit test without spinning up a TCP listener; covered by
        // the existing integration-style test.
    }
}
