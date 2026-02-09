# CloudCode Session Manager - Implementation Guide

**Date**: February 9, 2026
**Status**: Backend Complete - Ready for React & Command Layer Integration

---

## Quick Start

### File Structure Overview

```
cloudcode-rust/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                 # AppState + invoke_handler (all 18 commands registered)
│   │   ├── models/                 # Data structures
│   │   │   ├── mod.rs
│   │   │   ├── project.rs          # Project struct
│   │   │   ├── session.rs          # Session struct
│   │   │   ├── shell.rs            # ShellType enum (bash, zsh, fish, sh, tcsh, ksh)
│   │   │   └── terminal.rs         # TerminalApp enum (Terminal, iTerm2, WezTerm, Alacritty)
│   │   ├── services/               # Business logic
│   │   │   ├── mod.rs
│   │   │   ├── storage_service.rs  # JSON file I/O
│   │   │   ├── project_service.rs  # Project CRUD
│   │   │   └── session_service.rs  # Session CRUD
│   │   ├── commands/               # Tauri IPC endpoints
│   │   │   ├── mod.rs
│   │   │   ├── project.rs          # 6 project commands
│   │   │   ├── session.rs          # 8 session commands
│   │   │   └── terminal.rs         # 4 terminal commands
│   │   └── utils/
│   │       ├── mod.rs
│   │       └── terminal.rs         # Terminal detection & launching
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # App configuration
│   ├── build.rs                    # Build script
│   └── .gitignore
│
├── src/
│   ├── main.tsx                    # React entry
│   ├── App.tsx                     # Root component (needs integration)
│   ├── App.css                     # Basic styling
│   ├── index.html                  # HTML template
│   ├── components/
│   │   ├── TerminalSelector.tsx    # Terminal selection dropdown
│   │   └── OpenTerminalButton.tsx  # Launch button
│   ├── pages/
│   │   └── SessionDetailView.tsx   # Session details panel
│   ├── styles/
│   │   └── globals.css             # 410+ lines of professional CSS
│   └── index.css / styles.css      # Additional styles
│
├── package.json                    # Frontend dependencies
├── tsconfig.json                   # TypeScript config
├── vite.config.ts                  # Vite build config
├── index.html                      # Frontend entry HTML
│
├── PROJECT_COMPLETION_SUMMARY.md   # Project overview
└── IMPLEMENTATION_GUIDE.md         # This file
```

---

## Backend Architecture

### Data Flow

```
React Component
    ↓ invoke('command_name', args)
Tauri IPC Handler (commands/*.rs)
    ↓ calls
Service Layer (services/*.rs)
    ↓ reads/writes
Storage Service (JSON)
    ↓ persists to
~/Library/Application Support/CloudCodeSessionManager/
```

### Models

#### Project
```rust
pub struct Project {
    pub id: String,              // UUID
    pub name: String,
    pub description: String,
    pub path: String,            // File system path
    pub color: String,           // Hex color
    pub is_favorited: bool,
    pub session_ids: Vec<String>, // References to sessions
    pub created_at: String,      // ISO8601
    pub updated_at: String,
}
```

#### Session
```rust
pub struct Session {
    pub id: String,
    pub project_id: String,      // Parent project
    pub name: String,
    pub shell: String,           // "bash", "zsh", etc.
    pub environment_variables: HashMap<String, String>,
    pub command_history: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}
```

#### ShellType
```rust
pub enum ShellType {
    Bash, Zsh, Fish, Sh, Tcsh, Ksh
}
```

#### TerminalApp
```rust
pub enum TerminalApp {
    Terminal,   // /Applications/Utilities/Terminal.app
    ITerm2,     // /Applications/iTerm.app
    WezTerm,    // /usr/local/bin/wezterm (4-path detection)
    Alacritty,  // /Applications/Alacritty.app
}
```

### Services

#### FileSystemService
```rust
// Location: ~/Library/Application Support/CloudCodeSessionManager/
StorageService::app_data_dir()     // Get app directory
StorageService::projects_file()    // projects.json path
StorageService::sessions_file()    // sessions.json path
StorageService::read::<T>(path)    // JSON deserialization
StorageService::write::<T>(path, data) // JSON serialization
```

#### ProjectService
```rust
pub fn create_project(name, path) -> Result<Project>
pub fn list_projects() -> Result<Vec<Project>>
pub fn get_project(id) -> Result<Project>
pub fn update_project(project) -> Result<Project>
pub fn delete_project(id) -> Result<()>
pub fn toggle_favorite(id) -> Result<Project>
```

#### SessionService
```rust
pub fn create_session(project_id, name, shell) -> Result<Session>
pub fn list_sessions() -> Result<Vec<Session>>
pub fn list_sessions_for_project(project_id) -> Result<Vec<Session>>
pub fn get_session(id) -> Result<Session>
pub fn update_session(session) -> Result<Session>
pub fn delete_session(id) -> Result<()>
pub fn add_command_history(session_id, command) -> Result<()>
pub fn clear_command_history(session_id) -> Result<()>
```

### Tauri Commands

All 18 commands are registered in `main.rs` invoke_handler.

**Project Commands** (6)
- `create_project(name: String, path: String)`
- `list_projects()`
- `get_project(id: String)`
- `update_project(project: Project)`
- `delete_project(id: String)`
- `toggle_favorite(id: String)`

**Session Commands** (8)
- `create_session(project_id: String, name: String, shell: String)`
- `list_sessions()`
- `list_sessions_for_project(project_id: String)`
- `get_session(id: String)`
- `update_session(session: Session)`
- `delete_session(id: String)`
- `add_command_history(session_id: String, command: String)`
- `clear_command_history(session_id: String)`

**Terminal Commands** (4)
- `get_available_terminals()` → Vec<String>
- `set_default_terminal(terminal: String)`
- `open_session_in_terminal(project_path: String, terminal_app: String)`
- `open_session_with_command(project_path: String, terminal_app: String, command: String)`

### Terminal Integration

**Detection**: `utils/terminal.rs`
- Checks 4 standard locations per terminal
- Falls back to PATH lookup for custom installations
- Returns installed terminals immediately

**Launching**: `utils/terminal.rs`
- Terminal.app: Uses `open -a Terminal <path>`
- iTerm2: AppleScript with `tell application "iTerm"`
- WezTerm: CLI `wezterm start --cwd <path>`
- Alacritty: `open -a Alacritty <path>`

---

## Frontend Architecture

### React Components

#### App.tsx (Entry Point)
Currently a simple scaffold. Need to:
1. Import TerminalSelector component
2. Import SessionDetailView component
3. Set up state management
4. Connect to Tauri commands via useBackend hook

#### TerminalSelector
```tsx
<TerminalSelector onSelectTerminal={(terminal) => { /* handle */ }} />
```
- Loads available terminals on mount
- Displays dropdown with available options
- Persists user preference to backend
- Shows loading state

#### OpenTerminalButton
```tsx
<OpenTerminalButton project={project} terminalApp={terminalApp} />
```
- Async button that invokes `open_session_in_terminal`
- Shows "Opening..." during operation
- Displays errors to user
- Disabled while loading

#### SessionDetailView
```tsx
<SessionDetailView session={session} projectPath={path} terminalApp={terminal} />
```
- Displays session info (name, shell type)
- Shows command history
- Shows environment variables
- Integrates OpenTerminalButton

### Styling System

**File**: `src/styles/globals.css` (410+ lines)

**Key Classes**:
- `.app-container` - Main layout flex container
- `.sidebar` - Left sidebar (projects)
- `.main` - Main content area
- `.terminal-selector` - Terminal dropdown styling
- `.session-detail` - Session panel styling
- `.btn-primary` - Primary buttons (blue #007aff)
- `.error-message` - Error display
- `.loading` - Loading spinner animation

**Color Scheme**:
```css
Primary: #007aff (iOS blue)
Neutral: #f5f5f5 (light gray)
Text: #333 (dark gray)
Border: #ddd, #eee
```

### TypeScript Hooks (Ready to Use)

**useBackend** (to be created):
```tsx
const {
  projects,
  sessions,
  createProject,
  deleteProject,
  createSession,
  deleteSession,
  // ... all CRUD operations
} = useBackend();
```

---

## Integration Checklist

### For React Team (Tasks #10-11)

- [ ] Create `src/hooks/useBackend.ts` hook
  - Imports `invoke` from `@tauri-apps/api/core`
  - Wraps all 18 Tauri commands
  - Manages loading/error states
  - Returns data + mutation functions

- [ ] Update `src/App.tsx`
  - Import TerminalSelector
  - Import SessionDetailView
  - Use useBackend hook
  - Set up state management
  - Render project list + session detail

- [ ] Integrate components
  - Place TerminalSelector in app header/settings
  - Place SessionDetailView as main content
  - Wire up all props correctly
  - Test async operations

### For Testing

- [ ] Project CRUD: Create → Read → Update → Delete
- [ ] Session CRUD: Create → Read → Update → Delete
- [ ] Terminal detection: List available terminals
- [ ] Terminal launch: Open project in selected terminal
- [ ] Persistence: Verify JSON files are created

---

## Building & Running

### Prerequisites
```bash
# Install Rust (1.93+)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node (18+)
node --version  # Check version

# Install Xcode tools (macOS)
xcode-select --install
```

### Development
```bash
cd /Users/mannix/Project/projectTerm/cloudcode-rust

# Install dependencies
npm install

# Start dev server with hot reload
npm run tauri dev
```

### Building for Release
```bash
# Build Rust backend
cd src-tauri && cargo build --release

# Build full app
npm run tauri build

# Output: src-tauri/target/release/bundle/dmg/
```

---

## Common Issues & Solutions

### Issue: Rust compilation fails with C compiler error
**Solution**: Run `xcode-select --install` or `sudo xcode-select --reset`

### Issue: Tauri dev server doesn't start
**Solution**:
1. Kill any existing processes: `lsof -ti:1420 | xargs kill -9`
2. Check ports: `netstat -an | grep 1420`
3. Restart: `npm run tauri dev`

### Issue: JSON persistence not working
**Solution**:
1. Check directory: `ls -la ~/Library/Application\ Support/CloudCodeSessionManager/`
2. Verify read/write permissions
3. Check FileSystemService::write() error messages in console

### Issue: Terminal launching fails
**Solution**:
1. Run `get_available_terminals` to verify detection
2. Check terminal paths exist: `ls -la /Applications/iTerm.app`
3. Verify WezTerm path: `which wezterm`

---

## Code Quality Standards

All code follows:
- ✅ Type safety (Rust + TypeScript)
- ✅ Proper error handling (Result types)
- ✅ Async/await patterns
- ✅ Clean code organization
- ✅ Meaningful variable names
- ✅ Comments for complex logic

---

## Next Steps After Integration

1. **Tasks #12-13**: Terminal UI enhancement + end-to-end testing
2. **Task #14**: Final MVP validation + polish
3. **Compilation**: Resolve any build issues
4. **Testing**: Comprehensive end-to-end workflow testing
5. **Deployment**: Create DMG installer and release

---

**Questions?** Contact the team lead or refer to code comments.

**Good luck! 🚀**
