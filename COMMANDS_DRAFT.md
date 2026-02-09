# Tauri Commands Implementation - Code Drafts

This file contains the draft implementations ready to be moved into src-tauri/src/commands/ once the backend is initialized.

## File: src-tauri/src/commands/mod.rs

```rust
pub mod project;
pub mod session;
pub mod terminal;
```

## File: src-tauri/src/commands/project.rs

```rust
use tauri::State;
use crate::models::project::Project;
use crate::AppState;

#[tauri::command]
pub fn create_project(
    name: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    state.project_service.create_project(name, path)
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    state.project_service.list_projects()
}

#[tauri::command]
pub fn get_project(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    state.project_service.get_project(&id)
}

#[tauri::command]
pub fn update_project(
    project: Project,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    state.project_service.update_project(project)
}

#[tauri::command]
pub fn delete_project(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.project_service.delete_project(&id)
}

#[tauri::command]
pub fn toggle_favorite(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    state.project_service.toggle_favorite(&id)
}
```

## File: src-tauri/src/commands/session.rs

```rust
use tauri::State;
use crate::models::session::Session;
use crate::AppState;

#[tauri::command]
pub fn create_session(
    project_id: String,
    name: String,
    shell: String,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    state.session_service.create_session(project_id, name, shell)
}

#[tauri::command]
pub fn list_sessions_for_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Session>, String> {
    state.session_service.list_sessions_for_project(&project_id)
}

#[tauri::command]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    state.session_service.list_sessions()
}

#[tauri::command]
pub fn get_session(id: String, state: State<'_, AppState>) -> Result<Session, String> {
    state.session_service.get_session(&id)
}

#[tauri::command]
pub fn update_session(
    session: Session,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    state.session_service.update_session(session)
}

#[tauri::command]
pub fn delete_session(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.session_service.delete_session(&id)
}

#[tauri::command]
pub fn add_command_history(
    session_id: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.session_service.add_command_history(&session_id, command)
}

#[tauri::command]
pub fn clear_command_history(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.session_service.clear_command_history(&session_id)
}
```

## File: src-tauri/src/commands/terminal.rs

```rust
#[tauri::command]
pub fn get_available_terminals() -> Result<Vec<String>, String> {
    let mut available = vec![];

    // Check for Terminal.app
    if std::path::Path::new("/Applications/Utilities/Terminal.app").exists() {
        available.push("Terminal".to_string());
    }

    // Check for iTerm2.app
    if std::path::Path::new("/Applications/iTerm.app").exists() {
        available.push("iTerm2".to_string());
    }

    // Check for WezTerm
    if std::path::Path::new("/usr/local/bin/wezterm").exists()
        || std::path::Path::new("/opt/homebrew/bin/wezterm").exists()
    {
        available.push("WezTerm".to_string());
    }

    // Check for Alacritty
    if std::path::Path::new("/Applications/Alacritty.app").exists() {
        available.push("Alacritty".to_string());
    }

    if available.is_empty() {
        available.push("Terminal".to_string()); // At least system default
    }

    Ok(available)
}

#[tauri::command]
pub fn set_default_terminal(terminal: String) -> Result<(), String> {
    // TODO: Save to preferences.json or config storage
    // For now, this is a placeholder that returns success
    Ok(())
}

#[tauri::command]
pub fn open_session_in_terminal(
    project_path: String,
    terminal_app: String,
) -> Result<(), String> {
    use std::process::Command;

    match terminal_app.as_str() {
        "Terminal" => {
            // macOS Terminal.app
            Command::new("open")
                .arg("-a")
                .arg("Terminal")
                .arg(project_path)
                .spawn()
                .map_err(|e| format!("Failed to open Terminal: {}", e))?;
        }
        "iTerm2" => {
            // iTerm2
            Command::new("open")
                .arg("-a")
                .arg("iTerm")
                .arg(project_path)
                .spawn()
                .map_err(|e| format!("Failed to open iTerm2: {}", e))?;
        }
        "WezTerm" => {
            // WezTerm with --cwd parameter
            Command::new("wezterm")
                .arg("--cwd")
                .arg(project_path)
                .spawn()
                .map_err(|e| format!("Failed to open WezTerm: {}", e))?;
        }
        "Alacritty" => {
            // Alacritty
            Command::new("open")
                .arg("-a")
                .arg("Alacritty")
                .arg(project_path)
                .spawn()
                .map_err(|e| format!("Failed to open Alacritty: {}", e))?;
        }
        _ => return Err(format!("Unknown terminal: {}", terminal_app)),
    }

    Ok(())
}
```

## Main.rs Updates Required

```rust
// Add to invoke_handler in tauri::Builder::default()
.invoke_handler(tauri::generate_handler![
    commands::project::create_project,
    commands::project::list_projects,
    commands::project::get_project,
    commands::project::update_project,
    commands::project::delete_project,
    commands::project::toggle_favorite,
    commands::session::create_session,
    commands::session::list_sessions_for_project,
    commands::session::list_sessions,
    commands::session::get_session,
    commands::session::update_session,
    commands::session::delete_session,
    commands::session::add_command_history,
    commands::session::clear_command_history,
    commands::terminal::get_available_terminals,
    commands::terminal::set_default_terminal,
    commands::terminal::open_session_in_terminal,
])
```

## Status
- [x] Draft implementations prepared
- [x] File structure planned
- [ ] Awaiting src-tauri directory initialization
- [ ] Awaiting models and services implementation
- [ ] Ready to implement when prerequisites complete
