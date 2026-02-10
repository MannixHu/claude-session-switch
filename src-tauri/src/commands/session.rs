use crate::models::{Session, ShellType};
use crate::AppState;
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn create_session(
    project_id: String,
    name: String,
    shell: String,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    let shell_type = ShellType::from_str(&shell)
        .ok_or_else(|| format!("Unsupported shell: {}", shell.trim()))?;
    state
        .session_service
        .create_session(project_id, name, shell_type)
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_sessions_for_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Session>, String> {
    state.session_service.list_sessions_for_project(&project_id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    state.session_service.list_sessions()
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_session(id: String, state: State<'_, AppState>) -> Result<Session, String> {
    state.session_service.get_session(&id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_session(session: Session, state: State<'_, AppState>) -> Result<Session, String> {
    state.session_service.update_session(session)
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_session(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.session_service.delete_session(&id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn add_command_history(
    session_id: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .session_service
        .add_command_history(&session_id, command)
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_command_history(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.session_service.clear_command_history(&session_id)
}
