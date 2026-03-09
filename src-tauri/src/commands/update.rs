use crate::services::update_service::{UpdateCheckResult, UpdateService};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadedUpdateResult {
    pub version: String,
    pub asset_name: String,
    pub downloaded_path: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn check_for_updates() -> Result<UpdateCheckResult, String> {
    UpdateService::fetch_latest_release_info(env!("CARGO_PKG_VERSION"), std::env::consts::ARCH)
}

#[tauri::command(rename_all = "snake_case")]
pub fn download_and_open_update(
    download_url: String,
    asset_name: String,
    expected_sha256: String,
    version: String,
) -> Result<DownloadedUpdateResult, String> {
    let downloaded_path =
        UpdateService::download_update(&download_url, &asset_name, &expected_sha256)?;
    UpdateService::open_downloaded_installer(&downloaded_path)?;

    Ok(DownloadedUpdateResult {
        version,
        asset_name,
        downloaded_path: downloaded_path.display().to_string(),
    })
}
