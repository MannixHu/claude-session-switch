# Tauri IPC Commands Implementation Plan

## Task #3: Rust Commands Developer
**Status**: Ready for implementation
**Awaiting**: src-tauri directory initialization and services layer completion

## Commands to Implement

### 1. Project Commands (commands/project.rs)
- `create_project(name: String, path: String) -> Result<Project, String>`
- `list_projects() -> Result<Vec<Project>, String>`
- `get_project(id: String) -> Result<Project, String>`
- `update_project(project: Project) -> Result<Project, String>`
- `delete_project(id: String) -> Result<(), String>`
- `toggle_favorite(id: String) -> Result<Project, String>`

### 2. Session Commands (commands/session.rs)
- `create_session(project_id: String, name: String, shell: String) -> Result<Session, String>`
- `list_sessions_for_project(project_id: String) -> Result<Vec<Session>, String>`
- `list_sessions() -> Result<Vec<Session>, String>`
- `get_session(id: String) -> Result<Session, String>`
- `update_session(session: Session) -> Result<Session, String>`
- `delete_session(id: String) -> Result<(), String>`
- `add_command_history(session_id: String, command: String) -> Result<(), String>`
- `clear_command_history(session_id: String) -> Result<(), String>`

### 3. Terminal Commands (commands/terminal.rs)
- `get_available_terminals() -> Result<Vec<String>, String>`
- `set_default_terminal(terminal: String) -> Result<(), String>`
- `open_session_in_terminal(project_path: String, terminal_app: String) -> Result<(), String>`

## Dependencies
- Requires `models/` module with Project, Session, SessionMetadata types
- Requires `services/` module with ProjectService, SessionService implementations
- Requires `AppState` struct for managing service instances

## Implementation Files Needed
1. `src-tauri/src/commands/mod.rs` - Module declarations
2. `src-tauri/src/commands/project.rs` - Project CRUD commands
3. `src-tauri/src/commands/session.rs` - Session CRUD commands
4. `src-tauri/src/commands/terminal.rs` - Terminal management commands
5. Update `src-tauri/src/main.rs` - Add command handlers

## Prerequisites (from Task #1 & #2)
- [ ] src-tauri directory structure created
- [ ] models/project.rs with Project struct
- [ ] models/session.rs with Session struct
- [ ] services/project_service.rs with ProjectService
- [ ] services/session_service.rs with SessionService
- [ ] AppState struct defined

## Terminal Support
Will support:
- Terminal.app (macOS)
- iTerm2
- WezTerm
- Alacritty

## Next Steps After Implementation
1. Run `cargo build` to verify compilation
2. Update `src-tauri/src/main.rs` with invoke_handler
3. Test commands via Tauri frontend API
4. Frontend integration (Task #10)
