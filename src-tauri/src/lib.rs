use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
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
const MAX_LOG_LINE_BYTES: usize = 64 * 1024;
const MAX_LOG_TAIL_CHUNK_BYTES: usize = 1024 * 1024;
const MAX_BLUEPRINT_NAME_BYTES: usize = 512;
const MAX_KNOWN_BLUEPRINTS: usize = 10_000;
#[cfg(target_os = "windows")]
const APP_REGISTRY_NAME: &str = "ItemFabricator";
const KEYRING_SERVICE: &str = "space.itemfab.desktop";
const KEYRING_SESSION_USER: &str = "desktop-session";

// Test override for desktop session path (thread-local for parallel test isolation)
#[cfg(test)]
thread_local! {
    static TEST_SESSION_PATH_OVERRIDE: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) };
}

#[cfg(test)]
fn set_test_session_path_override(path: Option<PathBuf>) {
    TEST_SESSION_PATH_OVERRIDE.with(|cell| *cell.borrow_mut() = path);
}

#[cfg(test)]
fn clear_test_session_path_override() {
    TEST_SESSION_PATH_OVERRIDE.with(|cell| *cell.borrow_mut() = None);
}

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
    session_generation: AtomicU64,
    oauth_in_progress: AtomicBool,
}

impl DesktopAuthState {
    fn new() -> Self {
        Self {
            session_token: Mutex::new(read_desktop_session_token()),
            session_generation: AtomicU64::new(0),
            oauth_in_progress: AtomicBool::new(false),
        }
    }

    fn get_token(&self) -> Option<String> {
        lock_unpoisoned(&self.session_token).clone()
    }

    fn set_token(&self, token: Option<String>) -> Result<(), String> {
        let mut current = lock_unpoisoned(&self.session_token);
        if token.is_some() {
            write_desktop_session_token(token.as_deref())?;
            *current = token;
            self.session_generation.fetch_add(1, Ordering::Release);
            return Ok(());
        }

        let result = write_desktop_session_token(None);
        *current = None;
        self.session_generation.fetch_add(1, Ordering::Release);
        result
    }

    fn finish_oauth(&self, token: String, expected_generation: u64) -> Result<(), String> {
        let mut current = lock_unpoisoned(&self.session_token);
        if self.session_generation.load(Ordering::Acquire) != expected_generation {
            return Err("Desktop session changed while authentication was in progress. Please sign in again.".to_string());
        }
        write_desktop_session_token(Some(&token))?;
        *current = Some(token);
        self.session_generation.fetch_add(1, Ordering::Release);
        Ok(())
    }

    fn clear_token_if_matches(&self, rejected: &str) {
        let mut current = lock_unpoisoned(&self.session_token);
        if current.as_deref() == Some(rejected) {
            let _ = write_desktop_session_token(None);
            *current = None;
            self.session_generation.fetch_add(1, Ordering::Release);
        }
    }
}

struct OAuthAttemptGuard<'a>(&'a AtomicBool);

impl Drop for OAuthAttemptGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
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
    // Test override takes precedence
    #[cfg(test)]
    {
        let override_path = TEST_SESSION_PATH_OVERRIDE.with(|cell| cell.borrow().clone());
        if let Some(path) = override_path {
            return Some(path);
        }
    }

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
        || desktop_credential_entry().ok()?.get_password().ok(),
        fallback_path.as_deref(),
    )
}

fn desktop_credential_entry() -> Result<keyring::Entry, keyring::Error> {
    // Tests must never read, overwrite, or delete the user's real credentials.
    #[cfg(test)]
    let service = format!(
        "{KEYRING_SERVICE}.test.{}.{:?}",
        std::process::id(),
        std::thread::current().id()
    );
    #[cfg(test)]
    let service = service.as_str();
    #[cfg(not(test))]
    let service = KEYRING_SERVICE;
    keyring::Entry::new(service, KEYRING_SESSION_USER)
}

fn restore_desktop_session_token<F>(
    read_from_credential_store: F,
    fallback_path: Option<&Path>,
) -> Option<String>
where
    F: FnOnce() -> Option<String>,
{
    // Prefer the OS credential store. Only fall back to the local file when
    // the credential store returns nothing.
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

            // Try the OS credential store first and verify the write persists
            // by reading it back in the same process. If that succeeds, the
            // credential store is the authoritative source and we must NOT
            // leave a plaintext fallback on disk. Only when the credential
            // store demonstrably fails (write error or read-back mismatch) do
            // we create the hardened fallback file.
            let credential_store_ok = match desktop_credential_entry() {
                Ok(entry) => {
                    if entry.set_password(value).is_ok() {
                        // Verify the write by reading back immediately.
                        entry
                            .get_password()
                            .ok()
                            .is_some_and(|stored| stored == value)
                    } else {
                        false
                    }
                }
                Err(_) => false,
            };

            if credential_store_ok {
                // Credential store is healthy: ensure no fallback file exists.
                remove_session_fallback_file()?;
                Ok(())
            } else {
                // Credential store unavailable or unreliable: write the hardened
                // fallback file as the only durable copy.
                write_session_fallback_file(value, &path)
            }
        }
        None => {
            // Logout: clear both the credential store and any fallback file.
            let mut keyring_error = None;
            if let Ok(entry) = desktop_credential_entry() {
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
    if !std::fs::symlink_metadata(parent)
        .map_err(|error| format!("Unable to inspect session directory: {error}"))?
        .file_type()
        .is_dir()
    {
        return Err("Session directory must not be a symbolic link.".to_string());
    }

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

fn open_regular_file(path: &Path) -> Result<std::fs::File, String> {
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        // Inspect the opened descriptor, and never follow a final-component
        // symlink or block on a FIFO swapped in between inspection and open.
        options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x00200000;
        options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
    }
    let file = options
        .open(path)
        .map_err(|_| "Unable to open regular file.".to_string())?;
    let metadata = file
        .metadata()
        .map_err(|_| "Unable to inspect regular file.".to_string())?;
    if !metadata.file_type().is_file() {
        return Err("File is not a permitted regular file.".to_string());
    }
    Ok(file)
}

fn read_file_bounded_lossy(path: &Path, max_bytes: usize) -> Result<String, String> {
    let file = open_regular_file(path)?;
    let metadata = file.metadata().map_err(|error| error.to_string())?;
    if metadata.len() > max_bytes as u64 {
        return Err(
            "Log file is not a permitted regular file or exceeds the size limit.".to_string(),
        );
    }
    let mut bytes = Vec::new();
    file.take(max_bytes.saturating_add(1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Unable to read file: {error}"))?;
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
        if status == reqwest::StatusCode::UNAUTHORIZED {
            if let Some(token) = token.as_deref() {
                auth_state.clear_token_if_matches(token);
            }
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
        || url.fragment().is_some()
        || url.port_or_known_default() != Some(443)
        || !matches!(
            (url.host_str(), url.path()),
            (Some("discord.com"), "/oauth2/authorize")
                | (
                    Some("citizenid.space" | "citizenid.dev"),
                    "/connect/authorize"
                )
        )
    {
        return Err("Desktop OAuth returned an unsafe authorization URL.".to_string());
    }
    Ok(url.to_string())
}

fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let system_root = std::env::var_os("SystemRoot")
            .map(PathBuf::from)
            .filter(|path| path.is_absolute())
            .ok_or_else(|| "Unable to resolve the Windows system directory.".to_string())?;
        // Avoid resolving a spoofed rundll32.exe in the application's current
        // directory when launching the trusted HTTPS authorization URL.
        std::process::Command::new(system_root.join("System32").join("rundll32.exe"))
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

fn parse_desktop_oauth_callback(
    request: &str,
    expected_path: &str,
    expected_flow: &str,
    expected_host: &str,
) -> Option<Result<String, String>> {
    let (headers, _) = request.split_once("\r\n\r\n")?;
    let mut lines = headers.split("\r\n");
    let mut request_parts = lines.next()?.split(' ');
    if request_parts.next()? != "GET" {
        return None;
    }
    let target = request_parts.next()?;
    if !matches!(request_parts.next()?, "HTTP/1.0" | "HTTP/1.1")
        || request_parts.next().is_some()
        || target.contains('\\')
        || target.bytes().any(|byte| byte <= b' ' || byte == 0x7f)
        || target.split('?').next()? != expected_path
    {
        return None;
    }
    let mut host_seen = false;
    for line in lines {
        let (name, value) = line.split_once(':')?;
        let value = value.trim();
        if name.eq_ignore_ascii_case("host") {
            if host_seen || value != expected_host {
                return None;
            }
            host_seen = true;
        } else if name.eq_ignore_ascii_case("origin")
            || name.eq_ignore_ascii_case("transfer-encoding")
            || (name.eq_ignore_ascii_case("content-length") && value != "0")
        {
            // A browser navigation callback has no Origin header or body.
            // Reject cross-origin fetches and ambiguous request framing.
            return None;
        }
    }
    if !host_seen {
        return None;
    }
    let url = Url::parse(&format!("http://{expected_host}{target}")).ok()?;
    if url.fragment().is_some() || url.path() != expected_path {
        return None;
    }
    let mut flow = None;
    let mut code = None;
    let mut error = None;
    for (key, value) in url.query_pairs() {
        let slot = match key.as_ref() {
            "flow" => &mut flow,
            "code" => &mut code,
            "error" => &mut error,
            _ => continue,
        };
        if slot.replace(value.into_owned()).is_some() {
            return None;
        }
    }
    if flow.as_deref() != Some(expected_flow) || (code.is_some() && error.is_some()) {
        return None;
    }
    if let Some(error) = error {
        return Some(Err(truncate_error_message(&error)));
    }
    let code = code?;
    if code.is_empty()
        || code.len() > 1024
        || !code
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-._~".contains(&byte))
    {
        return None;
    }
    Some(Ok(code))
}

async fn receive_desktop_oauth_callback(
    listener: TcpListener,
    expected_path: String,
    expected_flow: &str,
) -> Result<String, String> {
    let expected_host = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .to_string();
    let accept = async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let read_request = async {
                let mut request = Vec::new();
                let mut buffer = [0_u8; 1024];
                while request.len() < 8192 {
                    let bytes_read = stream.read(&mut buffer).await.ok()?;
                    if bytes_read == 0 {
                        return None;
                    }
                    request.extend_from_slice(&buffer[..bytes_read]);
                    if request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
                        return String::from_utf8(request).ok();
                    }
                }
                None
            };
            let request = match tokio::time::timeout(
                tokio::time::Duration::from_secs(OAUTH_CALLBACK_READ_TIMEOUT_SECS),
                read_request,
            )
            .await
            {
                Ok(Some(request)) => request,
                _ => continue,
            };
            let callback = parse_desktop_oauth_callback(
                &request,
                &expected_path,
                expected_flow,
                &expected_host,
            );
            let (status, message) = match &callback {
                Some(Ok(_)) => (
                    "200 OK",
                    "Authentication complete. You can return to Item Fabricator.",
                ),
                Some(Err(_)) => (
                    "200 OK",
                    "Authentication failed. You can return to Item Fabricator.",
                ),
                None => ("400 Bad Request", "Invalid callback."),
            };
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\nCache-Control: no-store\r\nReferrer-Policy: no-referrer\r\nX-Content-Type-Options: nosniff\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{message}",
                message.len(),
            );
            let _ = stream.write_all(response.as_bytes()).await;
            if let Some(result) = callback {
                return result;
            }
        }
    };

    tokio::time::timeout(tokio::time::Duration::from_secs(300), accept)
        .await
        .map_err(|_| "Desktop OAuth timed out.".to_string())?
}

fn desktop_code_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
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

    auth_state
        .oauth_in_progress
        .compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
        .map_err(|_| "Desktop OAuth is already in progress.".to_string())?;
    let _attempt_guard = OAuthAttemptGuard(&auth_state.oauth_in_progress);
    let session_generation = auth_state.session_generation.load(Ordering::Acquire);
    // The verifier stays in native memory; intercepted loopback codes cannot
    // be exchanged by the browser, another webview, or a local process alone.
    let code_verifier = generate_url_secret(64)?;
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
        .append_pair("desktopCallback", &callback)
        .append_pair(
            "desktopCodeChallenge",
            &desktop_code_challenge(&code_verifier),
        );

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
        .json(&serde_json::json!({ "code": exchange_code, "codeVerifier": code_verifier }))
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

    auth_state.finish_oauth(payload.session_token, session_generation)?;
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
    channels: Vec<String>,
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
    path.is_dir()
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
    let mut file = open_regular_file(path)?;
    let metadata = file.metadata().map_err(|error| error.to_string())?;
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
    let drives = 'C'..='Z';
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
    for drive in drives {
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
    channel_paths.extend(find_paths_from_common_locations());
    channel_paths.sort();
    channel_paths.dedup();

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

    ScInstallPaths { live, ptu, channels: channel_paths.iter().map(|p| p.to_string_lossy().into_owned()).collect() }
}

// ─── Log reading helpers ──────────────────────────────────────────────────────

fn collect_log_file_paths(channel_path: &Path) -> Result<Vec<PathBuf>, String> {
    let mut paths = Vec::new();
    for entry in WalkDir::new(channel_path).max_depth(1) {
        let entry = entry.map_err(|e| format!("Unable to list installation logs: {e}"))?;
        let path = entry.path();
        if is_regular_file(path) && path.file_name().is_some_and(|n| n.to_string_lossy().eq_ignore_ascii_case("Game.log")) {
            paths.push(path.to_path_buf());
        }
        if entry.file_type().is_dir() && path != channel_path && path.file_name().is_some_and(|n| n.to_string_lossy().eq_ignore_ascii_case("logbackups")) {
            for backup in WalkDir::new(path).follow_links(false) {
                let backup = backup.map_err(|e| format!("Unable to list backup logs: {e}"))?;
                if backup.file_type().is_file() && backup.path().extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("log")) {
                    paths.push(backup.into_path());
                }
            }
        }
    }
    paths.sort();
    Ok(paths)
}

// Stream entire files with bounded line memory; never discard history by byte/file count.
fn scan_log_history(channel_path: &Path) -> Result<Vec<String>, String> {
    let paths = collect_log_file_paths(channel_path)?;
    if paths.is_empty() {
        return Err("No Game.log or backup .log files found. Launch Star Citizen once and check the installation folder.".into());
    }
    let re = build_blueprint_regex();
    let mut seen = HashSet::new();
    let mut names = Vec::new();
    for path in paths {
        let file = open_regular_file(&path).map_err(|e| format!("Unable to read {}: {e}", path.display()))?;
        let mut reader = BufReader::new(file);
        loop {
            let mut bytes = Vec::new();
            let count = Read::by_ref(&mut reader).take((MAX_LOG_LINE_BYTES + 1) as u64).read_until(b'\n', &mut bytes)
                .map_err(|e| format!("Unable to read {}: {e}", path.display()))?;
            if count == 0 { break; }
            if count > MAX_LOG_LINE_BYTES {
                return Err(format!("Log line exceeds the supported size in {}. Scan incomplete.", path.display()));
            }
            let text = String::from_utf8_lossy(&bytes);
            names.extend(extract_blueprints_from_lines(text.lines(), &re, &mut seen));
            if seen.len() >= MAX_KNOWN_BLUEPRINTS {
                return Err("Too many blueprint names in logs. Scan incomplete.".into());
            }
        }
    }
    Ok(names)
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
async fn scan_blueprints_from_logs(channel_path: String) -> Result<Vec<String>, String> {
    let path = validate_sc_channel_path(&channel_path)?;

    tauri::async_runtime::spawn_blocking(move || scan_log_history(&path))
        .await.map_err(|e| format!("Log scan failed: {e}"))?
}

fn extract_complete_log_lines(
    pending: &mut Vec<u8>,
    re: &Regex,
    known: &mut HashSet<String>,
) -> Result<Vec<String>, String> {
    if pending.split(|b| *b == b'\n').any(|line| line.len() > MAX_LOG_LINE_BYTES) {
        return Err("Log line exceeds the supported size. Check Game.log and restart monitoring.".into());
    }
    let Some(end) = pending.iter().rposition(|b| *b == b'\n') else {
        return Ok(Vec::new());
    };
    let text = String::from_utf8_lossy(&pending[..=end]);
    let names = extract_blueprints_from_lines(text.lines(), re, known);
    pending.drain(..=end);
    Ok(names)
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
    mut position: u64,
) {
    // Start from current end of file — don't re-emit already-known blueprints
    let mut last_size: u64 = position;
    let mut last_modified: Option<std::time::SystemTime> =
        std::fs::metadata(&log_path).and_then(|m| m.modified()).ok();

    let mut pending = Vec::new();
    loop {
        tokio::time::sleep(tokio::time::Duration::from_millis(TAIL_POLL_MS)).await;

        if stop.load(Ordering::Relaxed) {
            break;
        }

        let metadata = match std::fs::symlink_metadata(&log_path) {
            Ok(metadata) if metadata.file_type().is_file() => metadata,
            Err(error) => {
                let _ = app.emit("sc-log-error", format!("Unable to access Game.log: {error}. Restart monitoring once the file is available."));
                break;
            }
            Ok(_) => {
                let _ = app.emit("sc-log-error", "Game.log is not a regular file. Monitoring stopped.");
                break;
            },
        };
        let current_size = metadata.len();
        let current_modified = metadata.modified().ok();

        // Log rotated (new game session) — restart from beginning
        if current_size < last_size
            || (current_modified != last_modified && current_size <= position)
        {
            position = 0;
            pending.clear();
        }
        last_size = current_size;
        last_modified = current_modified;

        if current_size <= position {
            continue;
        }

        // Bound every iteration even if a malformed or hostile log grows very quickly.
        // Read only new bytes since last position.
        let new_bytes = {
            let mut f = match open_regular_file(&log_path) {
                Ok(f) => f,
                Err(error) => {
                    let _ = app.emit("sc-log-error", format!("Unable to read Game.log: {error}"));
                    break;
                },
            };
            if let Err(error) = f.seek(SeekFrom::Start(position)) {
                let _ = app.emit("sc-log-error", format!("Unable to seek Game.log: {error}"));
                break;
            }
            let mut buf = Vec::with_capacity(
                current_size
                    .saturating_sub(position)
                    .min(MAX_LOG_TAIL_CHUNK_BYTES as u64) as usize,
            );
            if let Err(error) = f.take(MAX_LOG_TAIL_CHUNK_BYTES as u64).read_to_end(&mut buf) {
                let _ = app.emit("sc-log-error", format!("Unable to read Game.log: {error}"));
                break;
            }
            position += buf.len() as u64;
            buf
        };

        pending.extend_from_slice(&new_bytes);
        let new_names = match extract_complete_log_lines(&mut pending, &re, &mut known) {
            Ok(names) => names,
            Err(error) => {
                let _ = app.emit("sc-log-error", error);
                break;
            }
        };

        if !new_names.is_empty() {
            let _ = app.emit("sc-log-new-blueprints", &new_names);
        }
    }
    stop.store(true, Ordering::Relaxed);
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

    // Historical import is handled by the full scan. Watching starts at a fixed
    // offset captured before spawning, so events during startup are not lost.
    let position = open_regular_file(&log_path)?.metadata().map_err(|e| format!("Unable to read Game.log metadata: {e}"))?.len();
    let known = HashSet::new();

    let stop = Arc::new(AtomicBool::new(false));
    state.replace(path.to_string_lossy().into_owned(), Arc::clone(&stop));

    tauri::async_runtime::spawn(run_log_watcher(log_path, stop, app, re, known, position));

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

#[cfg(any(windows, test))]
fn startup_command(executable: &Path) -> Result<String, String> {
    let path = executable
        .to_str()
        .ok_or_else(|| "Invalid executable path.".to_string())?;
    if path.is_empty() || path.contains(['"', '\r', '\n', '\0']) {
        return Err("Invalid executable path.".to_string());
    }
    // Run values are command lines. Quoting prevents a space in an install
    // directory from turning an earlier path component into an executable.
    Ok(format!("\"{path}\""))
}

// ─── Auto-startup (Windows only) ─────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn get_run_key(access: u32) -> Result<winreg::RegKey, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    winreg::RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", access)
        .map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn repair_legacy_auto_startup() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let key = get_run_key(winreg::enums::KEY_QUERY_VALUE | winreg::enums::KEY_SET_VALUE)?;
    let current: Result<String, _> = key.get_value(APP_REGISTRY_NAME);
    // Existing installations need the fix without requiring the user to
    // disable and re-enable auto-startup. Only migrate our exact old value.
    if current
        .as_deref()
        .is_ok_and(|value| value == exe.to_string_lossy().as_ref())
    {
        key.set_value(APP_REGISTRY_NAME, &startup_command(&exe)?)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn enable_auto_startup() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let key = get_run_key(winreg::enums::KEY_SET_VALUE)?;
        key.set_value(APP_REGISTRY_NAME, &startup_command(&exe)?)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn disable_auto_startup() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let key = get_run_key(winreg::enums::KEY_SET_VALUE)?;
        key.delete_value(APP_REGISTRY_NAME)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn is_auto_startup_enabled() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(key) = get_run_key(winreg::enums::KEY_QUERY_VALUE) {
            let val: Result<String, _> = key.get_value(APP_REGISTRY_NAME);
            return val.is_ok();
        }
    }
    false
}

// ─── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    let _ = repair_legacy_auto_startup();
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

        let blueprints = scan_log_history(&channel_dir).unwrap();

        assert_eq!(blueprints.len(), 4);
        assert!(blueprints.contains(&"Current One".to_string()));
        assert!(blueprints.contains(&"Backup One".to_string()));
        assert!(blueprints.contains(&"Backup Two".to_string()));
        assert!(blueprints.contains(&"Nested Ignored".to_string()));

        let _ = fs::remove_dir_all(channel_dir);
    }

    #[test]
    fn scans_full_large_logs_and_more_than_128_backups() {
        let root = create_test_channel_dir("full_history");
        let channel = root.join("Custom Games").join("LIVE");
        fs::create_dir_all(channel.join("LogBackups").join("archive")).unwrap();
        fs::write(channel.join("Data.p4k"), []).unwrap();
        assert!(validate_sc_channel_path(channel.to_str().unwrap()).is_ok());
        let mut log = fs::File::create(channel.join("Game.log")).unwrap();
        writeln!(log, "Received Blueprint: Beginning: acquired").unwrap();
        let filler = format!("{}\n", "x".repeat(1023));
        for _ in 0..17000 { log.write_all(filler.as_bytes()).unwrap(); }
        writeln!(log, "Received Blueprint: End: acquired").unwrap();
        for i in 0..140 {
            fs::write(channel.join("LogBackups").join("archive").join(format!("{i}.LOG")),
                format!("Received Blueprint: Backup {i}: acquired\n")).unwrap();
        }
        let names = scan_log_history(&channel).unwrap();
        assert_eq!(names.len(), 142);
        assert!(names.contains(&"Beginning".into()));
        assert!(names.contains(&"End".into()));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn watcher_retains_fragmented_notifications_and_utf8() {
        let re = build_blueprint_regex();
        let mut known = HashSet::new();
        let mut pending = Vec::new();
        let mut names = Vec::new();
        for byte in "Schéma reçu : Équipement: acquis\nReceived Blueprint: Second: acquired\n".as_bytes() {
            pending.push(*byte);
            names.extend(extract_complete_log_lines(&mut pending, &re, &mut known).unwrap());
        }
        assert_eq!(names, vec!["Équipement", "Second"]);
        assert!(pending.is_empty());
        pending = vec![b'x'; MAX_LOG_LINE_BYTES + 1];
        assert!(extract_complete_log_lines(&mut pending, &re, &mut known).is_err());
    }

    #[test]
    fn missing_logs_and_oversized_lines_report_errors() {
        let root = create_test_channel_dir("log_errors");
        assert!(scan_log_history(&root).unwrap_err().contains("No Game.log"));
        fs::write(root.join("Game.log"), vec![b'x'; MAX_LOG_LINE_BYTES + 1]).unwrap();
        assert!(scan_log_history(&root).unwrap_err().contains("Scan incomplete"));
        fs::remove_dir_all(root).unwrap();
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
    #[cfg(unix)]
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
    fn desktop_session_prefers_credential_store_over_fallback() {
        // Clear keyring FIRST to ensure clean state from previous tests
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        let root = create_test_channel_dir("desktop_session_prefers_credential_store");
        let fallback_path = root.join("desktop-session.token");
        let token = "credential-store-primary-token";

        // Set test override to use our temp directory
        set_test_session_path_override(Some(fallback_path.clone()));

        // First, check if keyring is actually functional in this environment.
        // In headless CI (e.g., GitHub Actions), Secret Service may not be available.
        let test_service = "space.itemfab.desktop.test1";
        let test_user = "desktop-session-test1";
        let keyring_functional = match keyring::Entry::new(test_service, test_user) {
            Ok(entry) => {
                let test_token = "keyring-functional-test";
                let ok = entry.set_password(test_token).is_ok()
                    && entry.get_password().ok().is_some_and(|v| v == test_token);
                // Clean up test token
                let _ = entry.delete_credential();
                ok
            }
            Err(_) => false,
        };

        // Write through the full flow - the credential store (keyring) succeeds,
        // so the fallback file should NOT be created.
        let result = write_desktop_session_token(Some(token));
        assert!(result.is_ok(), "write should succeed");

        // The fallback file should NOT exist when credential store succeeds.
        // If keyring is not functional (e.g., headless CI), the fallback is expected.
        if keyring_functional {
            assert!(
                !fallback_path.exists(),
                "fallback file must not exist when credential store succeeds"
            );
        } else {
            // In environments without functional keyring, fallback IS expected.
            // The test still passes because write succeeded; we just can't assert
            // on the fallback behavior in this environment.
            eprintln!(
                "Note: keyring not functional in this environment; fallback created as expected"
            );
        }

        // Clean up keyring
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        // Clean up
        clear_test_session_path_override();
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn desktop_session_cross_process_persistence() {
        // AGGRESSIVE ISOLATION: Clear keyring BEFORE setting up test channel
        // (previous tests may have left tokens in the shared keyring)
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        let root = create_test_channel_dir("desktop_session_cross_process");
        let fallback_path = root.join("desktop-session.token");
        let token = "cross-process-token-12345";

        // Set test override to use our temp directory
        set_test_session_path_override(Some(fallback_path.clone()));

        // Clear keyring AGAIN after channel creation
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        // Process A: write token
        let result = write_desktop_session_token(Some(token));
        assert!(result.is_ok(), "Process A: write should succeed");

        // Verify credential store has it (same process read-back)
        let read_result = read_desktop_session_token();
        assert_eq!(
            read_result,
            Some(token.to_string()),
            "Process A: read-back should match"
        );

        // Simulate process restart by creating new state
        let state = DesktopAuthState::new();
        let restored = state.get_token();
        assert_eq!(
            restored,
            Some(token.to_string()),
            "Process B: should restore from credential store"
        );

        // Process C: logout
        let state = DesktopAuthState::new();
        let result = state.set_token(None);
        assert!(result.is_ok(), "Process C: logout should succeed");

        // Verify both credential store and fallback are cleared
        let read_result = read_desktop_session_token();
        assert!(
            read_result.is_none(),
            "After logout: credential store should be empty"
        );
        assert!(
            !fallback_path.exists(),
            "After logout: fallback file should not exist"
        );

        // Process D: should not restore after logout
        let state = DesktopAuthState::new();
        let restored = state.get_token();
        assert!(
            restored.is_none(),
            "Process D: should not restore after logout"
        );

        // Clean up keyring
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        // Clean up
        clear_test_session_path_override();
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn desktop_session_fallback_cross_process_persistence() {
        // COMPLETE ISOLATION: Clear keyring aggressively BEFORE setting up test channel
        // (previous tests may have left tokens in the shared keyring)
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        let root = create_test_channel_dir("desktop_session_fallback_cross_process");
        let fallback_path = root.join("desktop-session.token");
        let token = "fallback-cross-process-token-67890";

        // Set test override to use our temp directory
        set_test_session_path_override(Some(fallback_path.clone()));

        // Also remove any fallback file
        let _ = fs::remove_file(&fallback_path);

        // Double-check keyring is empty
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        // Simulate keyring failure by using an invalid service/user
        // We test the fallback path directly
        let result = write_session_fallback_file(token, &fallback_path);
        assert!(result.is_ok(), "write fallback should succeed");
        assert!(fallback_path.exists(), "fallback file should exist");

        // Process A: read from fallback
        let read_result = read_file_bounded_lossy(&fallback_path, MAX_SESSION_TOKEN_BYTES);
        assert!(
            read_result.is_ok(),
            "Process A: fallback read should succeed"
        );
        assert_eq!(read_result.unwrap(), token);

        // Process B: new state should restore from fallback
        let state = DesktopAuthState::new();
        let restored = state.get_token();
        assert_eq!(
            restored,
            Some(token.to_string()),
            "Process B: should restore from fallback"
        );

        // Process C: logout clears fallback
        let state = DesktopAuthState::new();
        let result = state.set_token(None);
        assert!(result.is_ok(), "Process C: logout should succeed");
        assert!(
            !fallback_path.exists(),
            "After logout: fallback file should be removed"
        );

        // Process D: should not restore after logout
        let state = DesktopAuthState::new();
        let restored = state.get_token();
        assert!(
            restored.is_none(),
            "Process D: should not restore after logout"
        );

        // Clean up keyring
        if let Ok(entry) = desktop_credential_entry() {
            let _ = entry.delete_credential();
        }

        // Clean up
        clear_test_session_path_override();
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
        let path = "/auth/desktop-callback/random-nonce";
        let host = "127.0.0.1:43127";
        let valid =
            format!("GET {path}?flow=discord&code=one-use-code HTTP/1.1\r\nHost: {host}\r\n\r\n");
        assert_eq!(
            parse_desktop_oauth_callback(&valid, path, "discord", host),
            Some(Ok("one-use-code".to_string()))
        );
        for invalid in [
            valid.replace("GET", "POST"),
            valid.replace("HTTP/1.1", "HTTP/2"),
            valid.replace("random-nonce", "wrong-nonce"),
            valid.replace("random-nonce", "other/../random-nonce"),
            valid.replace("Host: 127.0.0.1", "Host: attacker.example"),
            valid.replace("flow=discord", "flow=citizenid"),
            valid.replace("flow=discord", "flow=discord&flow=discord"),
            valid.replace("code=one-use-code", "code=one-use-code&code=second"),
            valid.replace("code=one-use-code", "code=one-use-code&error=denied"),
            valid.replace("code=one-use-code", "code=bad%0D%0Acode"),
            valid.replace("code=one-use-code", "code=one-use-code#fragment"),
            valid.replace("\r\n\r\n", "\r\nOrigin: https://attacker.example\r\n\r\n"),
            valid.replace("\r\n\r\n", &format!("\r\nHost: {host}\r\n\r\n")),
            valid.replace("\r\n\r\n", "\r\nTransfer-Encoding: chunked\r\n\r\n"),
            valid.trim_end().to_string(),
        ] {
            assert!(
                parse_desktop_oauth_callback(&invalid, path, "discord", host).is_none(),
                "accepted malformed callback: {invalid}"
            );
        }
        let denied = valid.replace("code=one-use-code", "error=access_denied");
        assert_eq!(
            parse_desktop_oauth_callback(&denied, path, "discord", host),
            Some(Err("access_denied".to_string()))
        );
        assert!(parse_desktop_oauth_callback(&denied, path, "citizenid", host).is_none());
    }

    #[test]
    fn oauth_listener_ignores_foreign_requests_and_reads_fragmented_callback() {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
                let host = listener.local_addr().unwrap();
                let callback = tauri::async_runtime::spawn(receive_desktop_oauth_callback(
                    listener,
                    "/auth/desktop-callback/secret".to_string(),
                    "discord",
                ));
                let mut foreign = tokio::net::TcpStream::connect(host).await.unwrap();
                foreign.write_all(format!(
                    "GET /wrong?error=denied HTTP/1.1\r\nHost: {host}\r\n\r\n"
                ).as_bytes()).await.unwrap();
                let mut response = String::new();
                foreign.read_to_string(&mut response).await.unwrap();
                assert!(response.starts_with("HTTP/1.1 400"));

                let mut browser = tokio::net::TcpStream::connect(host).await.unwrap();
                browser.write_all(b"GET /auth/desktop-callback/secret?flow=discord&code=split-code HTTP/1.1\r\n").await.unwrap();
                tokio::task::yield_now().await;
                browser.write_all(format!("Host: {host}\r\n\r\n").as_bytes()).await.unwrap();
                response.clear();
                browser.read_to_string(&mut response).await.unwrap();
                assert!(response.starts_with("HTTP/1.1 200"));
                assert!(response.contains("Referrer-Policy: no-referrer"));
                assert_eq!(callback.await.unwrap().unwrap(), "split-code");
            });
    }

    #[test]
    fn desktop_pkce_matches_rfc7636_sha256_vector() {
        assert_eq!(
            desktop_code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
        let verifier = generate_url_secret(64).unwrap();
        assert_eq!(verifier.len(), 64);
        assert_eq!(desktop_code_challenge(&verifier).len(), 43);
        assert_ne!(verifier, generate_url_secret(64).unwrap());
    }

    #[test]
    fn startup_command_quotes_paths_with_spaces() {
        assert_eq!(
            startup_command(Path::new(r"C:\Program Files\Item Fabricator\app.exe")).unwrap(),
            r#""C:\Program Files\Item Fabricator\app.exe""#
        );
        assert!(startup_command(Path::new("app.exe\" --injected")).is_err());
    }

    #[test]
    fn stale_unauthorized_response_does_not_clear_a_new_session() {
        let state = DesktopAuthState {
            session_token: Mutex::new(Some("new-session".to_string())),
            session_generation: AtomicU64::new(1),
            oauth_in_progress: AtomicBool::new(false),
        };
        state.clear_token_if_matches("old-session");
        assert_eq!(state.get_token().as_deref(), Some("new-session"));
    }

    #[test]
    fn pending_oauth_cannot_restore_a_session_after_logout() {
        let state = DesktopAuthState {
            session_token: Mutex::new(None),
            session_generation: AtomicU64::new(2),
            oauth_in_progress: AtomicBool::new(false),
        };
        assert!(state.finish_oauth("late-session".to_string(), 1).is_err());
        assert!(state.get_token().is_none());
    }

    #[test]
    #[cfg(unix)]
    fn fallback_does_not_write_through_a_symlinked_session_directory() {
        let root = create_test_channel_dir("symlinked_session_directory");
        let unrelated = root.join("unrelated");
        let session_dir = root.join("session");
        fs::create_dir_all(&unrelated).unwrap();
        std::os::unix::fs::symlink(&unrelated, &session_dir).unwrap();
        assert!(write_session_fallback_file(
            "test-token",
            &session_dir.join("desktop-session.token")
        )
        .is_err());
        assert!(!unrelated.join("desktop-session.token").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[cfg(unix)]
    fn scans_do_not_follow_symlinked_backup_directories() {
        let root = create_test_channel_dir("symlinked_backup_directory");
        let channel = root.join("channel");
        let unrelated = root.join("unrelated");
        fs::create_dir_all(&channel).unwrap();
        fs::create_dir_all(&unrelated).unwrap();
        fs::write(
            unrelated.join("private.log"),
            "Received Blueprint: Private: acquired",
        )
        .unwrap();
        std::os::unix::fs::symlink(&unrelated, channel.join("logbackups")).unwrap();
        assert!(collect_log_file_paths(&channel).unwrap().is_empty());
        assert!(scan_log_history(&channel).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn authorization_urls_stay_on_known_identity_providers() {
        for url in [
            "https://attacker.example/oauth2/authorize",
            "https://discord.com.attacker.example/oauth2/authorize",
            "https://discord.com:444/oauth2/authorize",
            "https://discord.com/oauth2/authorize#fragment",
            "https://discord.com/channels/@me",
        ] {
            assert!(validate_authorization_url(url).is_err());
        }
        assert!(
            validate_authorization_url("https://citizenid.space/connect/authorize?state=one")
                .is_ok()
        );
        assert!(
            validate_authorization_url("https://citizenid.dev/connect/authorize?state=one").is_ok()
        );
    }
}
