# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CloudCodeSessionManager is a cross-platform desktop application for managing code projects and terminal sessions, built with **Rust + Tauri 2.0** (backend) and **React 18 + TypeScript** (frontend). The app provides persistent project/session management with native Mac terminal integration (Terminal.app, iTerm2, WezTerm, Alacritty).

## Common Commands

### Development
```bash
# Start dev server with hot reload (React + Rust auto-compile)
npm run tauri dev

# TypeScript type checking
npx tsc --noEmit

# TypeScript watch mode
npx tsc --watch --noEmit
```

### Building
```bash
# Production build for current platform
npm run tauri build

# Output locations:
# - macOS: src-tauri/target/release/bundle/dmg/
# - Linux: src-tauri/target/release/bundle/appimage/
# - Windows: src-tauri/target/release/bundle/msi/
```

### Testing
```bash
# Run all Rust tests
cd src-tauri && cargo test

# Run integration tests only
cd src-tauri && cargo test --test integration_test

# Enable Rust debug logging
RUST_LOG=debug npm run tauri dev
```

### Rust Development
```bash
# Check Rust compilation without building
cd src-tauri && cargo check

# Format Rust code
cd src-tauri && cargo fmt

# Run Clippy linter
cd src-tauri && cargo clippy
```

## Architecture Overview

### Frontend → Backend Communication
The app uses Tauri's IPC bridge to communicate between React frontend and Rust backend:

```
React Component
  ↓
Tauri invoke() API (@tauri-apps/api)
  ↓
Rust Command Handler (commands/)
  ↓
Service Layer (services/)
  ↓
StorageService (JSON persistence)
```

### Backend Architecture (Rust)
- **main.rs**: Entry point, registers all Tauri IPC commands
- **models/**: Data structures (Project, Session, Terminal, Shell)
- **services/**: Business logic layer
  - `ProjectService`: Project CRUD operations
  - `SessionService`: Session management
  - `StorageService`: JSON file persistence
- **commands/**: Tauri IPC command handlers (project, session, terminal)
- **utils/**: Platform-specific terminal integration

### Frontend Architecture (React)
- **src/main.tsx**: React app entry point
- **src/hooks/**: Custom hooks including `useWindowManager.ts`
- **src/components/**: Reusable UI components
  - `ProjectList.tsx`: Sidebar project list
  - `SessionList.tsx`: Center panel session list
  - `SessionDetailView.tsx`: Right panel session details
  - `ProjectEditorSheet.tsx`: Project create/edit modal
  - `SessionEditorSheet.tsx`: Session create/edit modal

### Data Storage
- Location: `~/.local/share/CloudCodeSessionManager/` (Linux) or `~/Library/Application Support/CloudCodeSessionManager/` (macOS)
- Format: JSON files (`projects.json`, `sessions.json`)
- Managed by: `StorageService` (Rust)

### Tauri Commands
The backend exposes 19 IPC commands grouped into three categories:

**Project Commands (7)**:
- `pick_project_folder`, `create_project`, `list_projects`, `get_project`, `update_project`, `delete_project`, `toggle_favorite`

**Session Commands (8)**:
- `create_session`, `list_sessions`, `list_sessions_for_project`, `get_session`, `update_session`, `delete_session`, `add_command_history`, `clear_command_history`

**Terminal Commands (4)**:
- `get_available_terminals`, `set_default_terminal`, `open_session_in_terminal`, `open_session_with_command`

## Key Technical Constraints

### Rust Backend
- **Tauri 2.0**: Using latest stable API (v2.3+)
- **Async Runtime**: Tokio for async operations
- **Error Handling**: All commands return `Result<T, String>` for Tauri IPC compatibility
- **macOS-Specific Code**: Terminal integration uses `cocoa` and `objc` crates (see `Cargo.toml` target dependencies)

### Frontend
- **React 18**: Uses modern hooks API (no class components)
- **TypeScript**: Strict mode enabled, 100% type coverage required
- **Vite**: Dev server on port 5173, hot reload enabled
- **Tauri API**: Import from `@tauri-apps/api` (v2.0)

### Cross-Platform Considerations
- All file paths must use cross-platform abstractions (`PathBuf` in Rust)
- Terminal integration currently Mac-only (Linux/Windows support planned)
- Storage paths use `dirs` crate for platform-specific app data directories

## Development Workflow

### Adding a New Tauri Command
1. Define data models in `src-tauri/src/models/` if needed
2. Add business logic to appropriate service in `src-tauri/src/services/`
3. Create command handler in `src-tauri/src/commands/`
4. Register command in `src-tauri/src/main.rs` via `invoke_handler`
5. Add TypeScript types for the command in frontend
6. Call command from React components using `invoke()`

### Modifying Frontend Components
1. All components are in `src/components/`
2. Use TypeScript for all new code
3. Test with hot reload via `npm run tauri dev`
4. Ensure no TypeScript errors with `npx tsc --noEmit`

### Adding Tests
- Integration tests go in `src-tauri/tests/`
- Run with `cd src-tauri && cargo test`
- Tests validate workflows, not just individual functions

## Important Notes

### Terminal Integration
- macOS terminal launching uses AppleScript via `osascript` command
- Each terminal type (Terminal.app, iTerm2, WezTerm, Alacritty) has custom AppleScript in `utils/terminal.rs`
- Terminal detection checks for app existence at known paths

### Data Persistence
- All writes go through `StorageService::save()` which handles file locking
- Storage directory is created automatically on first launch
- JSON serialization uses `serde_json` with pretty-printing

### Hot Reload Behavior
- React changes: < 1 second reload
- Rust changes: Full recompile (15-30 seconds)
- Tauri config changes: Requires full restart

### Known Limitations (Phase 1)
- No multi-window support yet
- No keyboard shortcuts
- No session import/export
- Mac terminal support only (Linux/Windows planned for Phase 2)

## Debugging

### Frontend
- Open DevTools: `Cmd+Shift+I` (macOS) or `Ctrl+Shift+I`
- Check Tauri IPC calls in Console tab
- React errors appear in DevTools console

### Backend
- Enable Rust logging: `RUST_LOG=debug npm run tauri dev`
- Logs appear in terminal running `tauri dev`
- Check data files manually: `cat ~/Library/Application\ Support/CloudCodeSessionManager/projects.json`

### Common Issues
- **App won't start**: Delete storage directory and restart
- **Terminal not launching**: Verify terminal app is installed, check `get_available_terminals` output
- **Changes not persisting**: Check file permissions in app data directory
- **TypeScript errors**: Run `npx tsc --noEmit` to see all errors
