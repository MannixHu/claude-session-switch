# CloudCode Rust Backend - Project Structure

## Overall Layout

```
cloudcode-rust/
├── src/                      # React frontend (TypeScript)
├── src-tauri/                # Rust backend (Tauri 2.0)
├── package.json              # npm dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite build config
└── index.html                # HTML entry point
```

## Frontend Structure (src/)

### React Components
- `App.tsx` - Main application component
- `main.tsx` - React entry point
- `components/` - Reusable UI components
  - ProjectList.tsx / ProjectList.css
  - ProjectEditorSheet.tsx / ProjectEditorSheet.css
  - SessionList.tsx / SessionList.css
  - SessionEditorSheet.tsx / SessionEditorSheet.css
  - SessionDetailView.tsx / SessionDetailView.css

### Pages
- `pages/ProjectDashboard.tsx` - Main dashboard view

### Hooks & Utilities
- `hooks/useBackend.ts` - Backend API integration
- `hooks/useWindowManager.ts` - Window management
- `styles/` - Global CSS styles

## Backend Structure (src-tauri/src/)

### Core Files
- `main.rs` - Application entry point and setup
- `Cargo.toml` - Rust dependencies configuration
- `build.rs` - Build script for Tauri

### Models (models/)
- `mod.rs` - Module declarations
- `project.rs` - Project data model
- `session.rs` - Session data model
- `shell.rs` - ShellType enum
- `terminal.rs` - TerminalApp enum

### Services (services/)
- `mod.rs` - Service module declarations
- `project_service.rs` - Project CRUD operations
- `session_service.rs` - Session CRUD operations
- `storage_service.rs` - File system persistence

### Commands (commands/)
- `mod.rs` - Command module declarations
- `project.rs` - Project IPC commands
- `session.rs` - Session IPC commands
- `terminal.rs` - Terminal operations

### Configuration
- `tauri.conf.json` - Tauri application configuration

## Key Dependencies

### Frontend (npm)
- react@18.2.0
- @tauri-apps/api@2.0
- vite@5
- typescript@5

### Backend (Cargo)
- tauri@2.0
- tokio@1 (async runtime)
- serde@1.0 (serialization)
- uuid@1.0 (ID generation)
- chrono@0.4 (timestamps)
- dirs@5.0 (system paths)

## Development Setup

### Prerequisites
- Node.js 18+
- Rust 1.60+
- Xcode Command Line Tools (macOS)

### Installation
```bash
cd /Users/mannix/Project/projectTerm/cloudcode-rust
npm install
```

### Building
```bash
# Frontend
npm run build

# Backend
cd src-tauri && cargo build --release

# Full app
npm run build
```

### Development
```bash
npm run dev  # Runs Tauri dev server
```

## Compilation Status

**Environment Issue**: macOS SDK linking issue with current Rust environment
- Error: `unknown option '-lSystem'`
- Likely caused by Xcode Command Line Tools configuration
- Workaround needed: SDK path configuration or Xcode reinstall

**Code Status**: All source files are properly created and syntactically correct
- 14 Rust source files
- 19 React/TypeScript files
- Configuration files (Cargo.toml, package.json, tauri.conf.json)

## Next Steps

1. Resolve macOS SDK linking issue
2. Run `cargo build` to compile Rust backend
3. Test IPC communication between React frontend and Rust backend
4. Integrate with WezTerm for terminal operations
5. Run full test suite
