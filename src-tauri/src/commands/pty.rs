use tauri::State;

use crate::services::pty_service::PtyManager;

#[tauri::command(rename_all = "snake_case")]
pub fn create_pty(
    session_id: String,
    working_dir: String,
    app_handle: tauri::AppHandle,
    state: State<'_, PtyManager>,
) -> Result<bool, String> {
    state.create(&session_id, &working_dir, app_handle)
}

#[tauri::command(rename_all = "snake_case")]
pub fn write_pty(
    session_id: String,
    data: String,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.write(&session_id, &data)
}

#[tauri::command(rename_all = "snake_case")]
pub fn resize_pty(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows)
}

#[tauri::command(rename_all = "snake_case")]
pub fn close_pty(
    session_id: String,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.close(&session_id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn close_all_ptys(state: State<'_, PtyManager>) -> Result<(), String> {
    state.close_all()
}
