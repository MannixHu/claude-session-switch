use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use serde::Serialize;
use tauri::State;

use crate::models::TerminalApp;
use crate::utils::{detect_available_terminals, open_terminal_with_command, open_terminal_with_path};
use crate::AppState;

#[derive(Serialize)]
pub struct SessionCommandResult {
    pub command: String,
    pub shell: String,
    pub cwd: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_available_terminals() -> Result<HashMap<String, String>, String> {
    let terminals = detect_available_terminals();

    let mut mapped = HashMap::new();
    for terminal in terminals {
        let name = terminal.display_name().to_string();
        mapped.insert(name.clone(), name);
    }

    Ok(mapped)
}

#[tauri::command(rename_all = "snake_case")]
pub fn set_default_terminal(terminal: String) -> Result<(), String> {
    log::info!("Default terminal set to: {}", terminal);
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_session_in_terminal(
    session_id: String,
    terminal: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let session = state.session_service.get_session(&session_id)?;
    let project = state.project_service.get_project(&session.project_id)?;

    let terminal_app = terminal.unwrap_or_else(|| "Terminal".to_string());
    let resolved_terminal = TerminalApp::from_display_name(&terminal_app)
        .ok_or_else(|| format!("Unknown terminal: {}", terminal_app))?;

    open_terminal_with_path(resolved_terminal, &project.path)
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_session_with_command(
    project_path: String,
    terminal_app: String,
    command: String,
) -> Result<(), String> {
    let resolved_terminal = TerminalApp::from_display_name(&terminal_app)
        .ok_or_else(|| format!("Unknown terminal: {}", terminal_app))?;

    open_terminal_with_command(resolved_terminal, &project_path, &command)
}

#[tauri::command(rename_all = "snake_case")]
pub fn run_session_command(
    session_id: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<SessionCommandResult, String> {
    let trimmed_command = command.trim();
    if trimmed_command.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let session = state.session_service.get_session(&session_id)?;
    let project = state.project_service.get_project(&session.project_id)?;
    let shell_path = resolve_shell_path(&session.shell);

    let output = Command::new(&shell_path)
        .arg("-lc")
        .arg(trimmed_command)
        .current_dir(&project.path)
        .output()
        .map_err(|error| {
            format!(
                "Failed to run command with shell {}: {}",
                shell_path, error
            )
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    if let Err(error) = state
        .session_service
        .add_command_history(&session_id, trimmed_command.to_string())
    {
        log::warn!("Failed to persist command history: {}", error);
    }

    Ok(SessionCommandResult {
        command: trimmed_command.to_string(),
        shell: shell_path,
        cwd: project.path,
        exit_code,
        stdout,
        stderr,
    })
}

fn resolve_shell_path(shell: &str) -> String {
    let normalized = shell.trim();

    if normalized.is_empty() {
        return "/bin/zsh".to_string();
    }

    if normalized.contains('/') {
        return normalized.to_string();
    }

    let bundled_path = format!("/bin/{}", normalized);
    if Path::new(&bundled_path).exists() {
        return bundled_path;
    }

    normalized.to_string()
}
