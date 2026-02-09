use crate::models::ClaudeSession;
use crate::services::ClaudeSessionService;

#[tauri::command(rename_all = "snake_case")]
pub fn list_claude_sessions(
    project_path: String,
    limit: Option<usize>,
) -> Result<Vec<ClaudeSession>, String> {
    ClaudeSessionService::list_sessions_for_project(&project_path, limit)
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_claude_projects() -> Result<Vec<(String, String)>, String> {
    ClaudeSessionService::list_claude_projects()
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_claude_session(project_path: String, session_id: String) -> Result<(), String> {
    ClaudeSessionService::delete_claude_session(&project_path, &session_id)
}
