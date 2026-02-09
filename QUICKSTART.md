# CloudCodeSessionManager - Quick Start Guide

## ✨ Overview

CloudCodeSessionManager is a production-ready cross-platform desktop application for managing code projects and terminal sessions. Built with **Rust + Tauri 2.0** and **React 18**, it provides:

- 🚀 **Lightning-fast** React hot reload (< 1 second)
- 🔧 **Robust** Rust backend with proper error handling
- 🖥️ **Native** Mac terminal integration (Terminal, iTerm2, WezTerm, Alacritty)
- 💾 **Persistent** JSON-based storage with cross-platform support
- 🎨 **Beautiful** responsive UI with Tailwind-inspired design

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ (for npm)
- **Rust** 1.70+ (for backend)
- **macOS** 10.13+ (or Linux/Windows)

### Installation

```bash
# 1. Clone or navigate to project
cd cloudcode-rust

# 2. Install frontend dependencies
npm install

# 3. Start development environment (hot reload)
npm run tauri dev
```

The application will:
1. Start Vite dev server (React hot reload)
2. Compile Rust backend
3. Launch Tauri window with live-reloading UI

**First time setup takes 1-2 minutes** (Rust compilation).
**Subsequent hot reloads take < 1 second** (React only).

---

## 🎯 Core Workflows

### Workflow 1: Create Your First Project

1. **Open Application** → ProjectDashboard appears
2. **Click "New Project"** → ProjectEditorSheet modal opens
3. **Fill in details**:
   - **Name**: "My First Project"
   - **Path**: `/Users/[you]/projects/my-project`
   - **Description**: (optional) "My awesome project"
   - **Color**: Click color circle to choose accent color
4. **Click "Create"** → Project appears in sidebar

### Workflow 2: Create a Session

1. **Select project** in sidebar (highlight appears)
2. **Click "New Session"** → SessionEditorSheet modal opens
3. **Configure session**:
   - **Name**: "Development"
   - **Shell**: Select bash, zsh, fish, sh, tcsh, or ksh
   - **Working Directory**: Auto-filled from project path
   - **Environment Variables** (optional):
     - Add: `NODE_ENV` = `development`
     - Add: `DEBUG` = `true`
4. **Click "Create"** → Session appears in center panel

### Workflow 3: Open Session in Terminal

1. **Select session** in center panel (detail view shows on right)
2. **Choose terminal** in dropdown (Terminal.app, iTerm2, etc.)
3. **Click "Open in Terminal"** → Terminal launches with:
   - Working directory set
   - Environment variables loaded
   - Shell type configured

### Workflow 4: Track Commands

1. **In session detail view**, expand "Command History" panel
2. **Any commands executed** get recorded
3. **History persists** across app restarts
4. **Clear history** with "Clear" button if needed

---

## 🏗️ Architecture Overview

### Frontend → Backend Flow

```
┌──────────────────┐
│  React Component │ (ProjectDashboard.tsx)
│  (ProjectList)   │
└────────┬─────────┘
         │
         ├─ useBackend Hook
         │  (src/hooks/useBackend.ts)
         │
         └─ Tauri IPC
            (Window.invoke)
            │
            ├─ create_project
            ├─ list_projects
            ├─ update_project
            └─ delete_project
                 │
                 ▼
         ┌──────────────────┐
         │ Rust Backend     │
         │ (main.rs)        │
         └────────┬─────────┘
                  │
                  ├─ ProjectService
                  │  (src-tauri/src/services/project_service.rs)
                  │
                  ├─ SessionService
                  │  (src-tauri/src/services/session_service.rs)
                  │
                  └─ StorageService
                     (JSON persistence)
                     │
                     └─ ~/.local/share/CloudCodeSessionManager/
                        (or macOS equivalent)
```

### Data Model

**Project**
```json
{
  "id": "uuid",
  "name": "Project Name",
  "path": "/full/project/path",
  "color": "#3B82F6",
  "is_favorited": false,
  "session_ids": ["session-uuid-1", "session-uuid-2"],
  "created_at": "2026-02-09T...",
  "updated_at": "2026-02-09T..."
}
```

**Session**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "Session Name",
  "metadata": {
    "shell": "zsh",
    "working_directory": "/full/project/path",
    "environment_variables": {
      "NODE_ENV": "development",
      "DEBUG": "true"
    }
  },
  "command_history": ["command1", "command2"],
  "created_at": "2026-02-09T...",
  "updated_at": "2026-02-09T..."
}
```

---

## 📂 Project Structure

```
cloudcode-rust/
├── src/                          # React Frontend
│   ├── hooks/useBackend.ts       # Tauri API integration
│   ├── components/               # React components
│   ├── pages/ProjectDashboard.tsx # Main layout
│   └── styles/globals.css        # Global styling
│
├── src-tauri/                    # Rust Backend
│   ├── src/
│   │   ├── main.rs               # Entry point, command registration
│   │   ├── models/               # Data models
│   │   ├── services/             # Business logic
│   │   ├── commands/             # Tauri IPC endpoints
│   │   └── utils/                # Utilities
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
│
├── .github/workflows/            # CI/CD
│   └── build.yml                 # GitHub Actions build
│
├── package.json                  # Node dependencies
├── tsconfig.json                 # TypeScript configuration
└── IMPLEMENTATION_CHECKLIST.md   # Task completion status
```

---

## 🔧 Available Commands

### Development
```bash
# Start dev server with hot reload
npm run tauri dev

# TypeScript type checking
npx tsc --noEmit

# TypeScript watch mode
npx tsc --watch --noEmit
```

### Building
```bash
# Release build (production binary)
npm run tauri build

# Output locations:
# - macOS: src-tauri/target/release/bundle/dmg/
# - Linux: src-tauri/target/release/bundle/appimage/
# - Windows: src-tauri/target/release/bundle/msi/
```

### Testing
```bash
# Run Rust tests
cd src-tauri
cargo test

# Run integration tests
cargo test --test integration_test
```

---

## 🎨 UI Components Reference

### ProjectList
- Displays all projects in sidebar
- Search filtering by name
- Favorite toggle
- Delete with confirmation
- Click to select

**Props**: `projects`, `selectedProjectId`, `onSelect`, `onDelete`, `onToggleFavorite`

### SessionList
- Shows sessions for selected project
- Shell type badges
- Click to select
- Delete with confirmation

**Props**: `sessions`, `selectedSessionId`, `onSelect`, `onDelete`

### SessionDetailView
- 3 collapsible panels: General, Environment, History
- Environment variable display
- Command history viewer
- Terminal selector dropdown
- Open in Terminal button

**Props**: `session`, `onUpdate`, `onDelete`, `onOpenTerminal`

### Modals
- **ProjectEditorSheet**: Create/edit projects, color picker
- **SessionEditorSheet**: Create/edit sessions, environment variables

---

## 🌐 Tauri IPC Commands Reference

### Project Commands
```typescript
// Create a new project
createProject({
  name: string,
  path: string,
  description?: string,
  color?: string
}): Promise<Project>

// List all projects
listProjects(): Promise<Project[]>

// Get single project
getProject(id: string): Promise<Project>

// Update project
updateProject(project: Project): Promise<Project>

// Delete project
deleteProject(id: string): Promise<void>

// Toggle favorite status
toggleFavorite(id: string): Promise<Project>
```

### Session Commands
```typescript
// Create session
createSession({
  project_id: string,
  name: string,
  shell: ShellType,
  working_directory?: string,
  environment_variables?: Record<string, string>
}): Promise<Session>

// List sessions (all or by project)
listSessions(): Promise<Session[]>
listSessionsForProject(projectId: string): Promise<Session[]>

// Get single session
getSession(id: string): Promise<Session>

// Update session
updateSession(session: Session): Promise<Session>

// Delete session
deleteSession(id: string): Promise<void>

// Command history
addCommandHistory(sessionId: string, command: string): Promise<void>
clearCommandHistory(sessionId: string): Promise<void>
```

### Terminal Commands
```typescript
// Detect available terminals
getAvailableTerminals(): Promise<Record<string, string>>

// Set user's default terminal
setDefaultTerminal(terminal: string): Promise<void>

// Open session in terminal
openSessionInTerminal(
  sessionId: string,
  terminal?: string
): Promise<void>

// Open with command execution
openSessionWithCommand(
  sessionId: string,
  command: string,
  terminal?: string
): Promise<void>
```

---

## 🐛 Debugging

### Enable Tauri DevTools
In development mode, press **Ctrl+Shift+I** (or **Cmd+Shift+I** on macOS) to open DevTools.

**Console Tab**: Shows Rust backend logs and Tauri errors
**Network Tab**: Shows Tauri IPC command calls and responses

### Enable Rust Logging
```bash
RUST_LOG=debug npm run tauri dev
```

### Check Data Storage
```bash
# macOS
open ~/Library/Application\ Support/CloudCodeSessionManager/

# Linux
cat ~/.local/share/CloudCodeSessionManager/projects.json
```

---

## 📊 Performance Tips

1. **Large Project Count** (100+)
   - Use search to filter projects
   - Sessions load on-demand per project

2. **Many Sessions** (50+ per project)
   - Detail view doesn't load all at once
   - Command history lazy-loads

3. **Complex Environments**
   - Environment variables limit: 100+ variables supported
   - Large strings (1000+ chars) supported

---

## 🚀 Next Steps

### For Users
1. Create your first project
2. Add sessions with your typical environments
3. Test opening sessions in your preferred terminal
4. Explore customizing colors and environment variables

### For Developers
1. Read `IMPLEMENTATION_CHECKLIST.md` for full task status
2. Check `.github/workflows/build.yml` for CI/CD setup
3. Review `src-tauri/tests/integration_test.rs` for test patterns
4. Study component interactions in `src/pages/ProjectDashboard.tsx`

### Feature Requests
- Multi-window support
- Advanced search and filtering
- Session export/import
- Keyboard shortcuts
- Theme customization

---

## 📞 Support

### Common Issues

**Q: App won't start**
A: Delete `~/.local/share/CloudCodeSessionManager/` and restart

**Q: Terminal not launching**
A: Verify terminal app is installed, check `get_available_terminals`

**Q: Changes not persisting**
A: Check file permissions in Application Support directory

**Q: React not hot-reloading**
A: Restart `npm run tauri dev`

---

## ✅ Verification Checklist

Before deploying, verify:

- [x] `npm install` completes without errors
- [x] `npm run tauri dev` starts successfully
- [x] ProjectDashboard renders with empty state
- [x] Can create a project
- [x] Can create a session in that project
- [x] Can edit session environment variables
- [x] Can select and view session details
- [x] Can open session in terminal
- [x] App restarts and retains data
- [x] No errors in Tauri DevTools console

---

## 🎉 You're Ready!

CloudCodeSessionManager is now ready to use. Start by creating your first project and enjoy the seamless terminal integration experience.

**Happy coding!** 🚀

---

*Version 0.1.0 | Built with Rust + Tauri 2.0 + React 18 | 2026-02-09*
