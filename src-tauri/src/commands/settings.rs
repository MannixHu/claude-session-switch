use tauri::State;

use crate::models::app_settings::AppSettings;
use crate::AppState;

#[tauri::command(rename_all = "snake_case")]
pub fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.settings_service.get_settings().map_err(|error| {
        log::warn!("get_app_settings failed: {}", error);
        error
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_app_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    state.settings_service.set_settings(settings).map_err(|error| {
        log::warn!("set_app_settings failed: {}", error);
        error
    })
}
