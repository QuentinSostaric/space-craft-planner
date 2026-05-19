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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![fetch_api_json])
        .run(tauri::generate_context!())
        .expect("error while running Item Fabricator");
}
