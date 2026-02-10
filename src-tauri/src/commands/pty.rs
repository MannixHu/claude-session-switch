use tauri::State;

use crate::services::pty_service::{PtyLaunchConfig, PtyManager};

#[tauri::command(rename_all = "snake_case")]
pub fn create_pty(
    session_id: String,
    working_dir: String,
    enable_claude_resume: Option<bool>,
    resume_session_id: Option<String>,
    claude_args: Option<Vec<String>>,
    allow_dangerously_skip_permissions: Option<bool>,
    app_handle: tauri::AppHandle,
    state: State<'_, PtyManager>,
) -> Result<bool, String> {
    let launch_config = if enable_claude_resume.unwrap_or(false) {
        let resume_target = resume_session_id.unwrap_or_else(|| session_id.clone());
        let mut resolved_claude_args = claude_args.unwrap_or_default();

        if allow_dangerously_skip_permissions.unwrap_or(false)
            && !resolved_claude_args
                .iter()
                .any(|arg| arg == "--dangerously-skip-permissions")
        {
            resolved_claude_args.push("--dangerously-skip-permissions".to_string());
        }

        PtyLaunchConfig::claude_resume(resume_target, resolved_claude_args)
    } else {
        PtyLaunchConfig::plain()
    };

    state
        .create(&session_id, &working_dir, launch_config, app_handle)
        .map_err(|error| {
            log::warn!("create_pty failed for {}: {}", session_id, error);
            error
        })
}

#[tauri::command(rename_all = "snake_case")]
pub fn write_pty(
    session_id: String,
    data: String,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.write(&session_id, &data).map_err(|error| {
        log::debug!("write_pty failed for {}: {}", session_id, error);
        error
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn resize_pty(
    session_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, PtyManager>,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows).map_err(|error| {
        log::debug!("resize_pty failed for {}: {}", session_id, error);
        error
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn close_pty(session_id: String, state: State<'_, PtyManager>) -> Result<(), String> {
    state.close(&session_id).map_err(|error| {
        log::warn!("close_pty failed for {}: {}", session_id, error);
        error
    })
}

#[tauri::command(rename_all = "snake_case")]
pub fn close_all_ptys(state: State<'_, PtyManager>) -> Result<(), String> {
    state.close_all().map_err(|error| {
        log::warn!("close_all_ptys failed: {}", error);
        error
    })
}
