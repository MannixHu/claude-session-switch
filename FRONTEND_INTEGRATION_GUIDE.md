# Frontend Integration Guide - Task #10-11

**For**: react-frontend-dev
**Status**: Backend ready for integration
**Date**: February 9, 2026

## Overview

The Rust backend Tauri IPC commands are now fully implemented and ready for React frontend integration. This guide explains how to connect the frontend to these commands.

## Available Commands (16 Total)

### Project Commands
```rust
create_project(name: String, path: String) -> Project
list_projects() -> Vec<Project>
get_project(id: String) -> Project
update_project(project: Project) -> Project
delete_project(id: String) -> ()
toggle_favorite(id: String) -> Project
```

### Session Commands
```rust
create_session(project_id: String, name: String, shell: String) -> Session
list_sessions_for_project(project_id: String) -> Vec<Session>
list_sessions() -> Vec<Session>
get_session(id: String) -> Session
update_session(session: Session) -> Session
delete_session(id: String) -> ()
add_command_history(session_id: String, command: String) -> ()
clear_command_history(session_id: String) -> ()
```

### Terminal Commands
```rust
get_available_terminals() -> Vec<String>
set_default_terminal(terminal: String) -> ()
open_session_in_terminal(project_path: String, terminal_app: String) -> ()
```

## Backend File Locations

**Implementation Files**:
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/commands/project.rs` (174 lines)
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/commands/session.rs` (130 lines)
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/commands/terminal.rs` (115 lines)
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/main.rs` (AppState setup)

**Services Layer**:
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/services/project_service.rs`
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/services/session_service.rs`
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/services/storage_service.rs`

**Data Models**:
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/models/project.rs`
- `/Users/mannix/Project/projectTerm/cloudcode-rust/src-tauri/src/models/session.rs`

## React/TypeScript Integration Example

### 1. Create Tauri Command Hooks

Create `/src/hooks/useProjects.ts`:

```typescript
import { invoke } from '@tauri-apps/api/tauri';
import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  description: string;
  path: string;
  color: string;
  is_favorited: boolean;
  session_ids: string[];
  created_at: string;
  updated_at: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const result = await invoke<Project[]>('list_projects');
      setProjects(result);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string, path: string) => {
    try {
      const result = await invoke<Project>('create_project', { name, path });
      setProjects([...projects, result]);
      return result;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  const updateProject = async (project: Project) => {
    try {
      const result = await invoke<Project>('update_project', { project });
      setProjects(projects.map(p => p.id === result.id ? result : p));
      return result;
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await invoke('delete_project', { id });
      setProjects(projects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      const result = await invoke<Project>('toggle_favorite', { id });
      setProjects(projects.map(p => p.id === result.id ? result : p));
      return result;
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  };

  return {
    projects,
    loading,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    toggleFavorite,
  };
}
```

### 2. Create Sessions Hook

Create `/src/hooks/useSessions.ts` (similar pattern):

```typescript
export function useSessions(projectId?: string) {
  const [sessions, setSessions] = useState([]);

  const loadSessions = async () => {
    try {
      const result = projectId
        ? await invoke('list_sessions_for_project', { project_id: projectId })
        : await invoke('list_sessions');
      setSessions(result);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // Similar methods for create, update, delete, add_command_history, etc.

  return { sessions, loadSessions, /* ... */ };
}
```

### 3. Create Terminal Hook

Create `/src/hooks/useTerminal.ts`:

```typescript
export function useTerminal() {
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);

  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const terminals = await invoke<string[]>('get_available_terminals');
        setAvailableTerminals(terminals);
      } catch (error) {
        console.error('Failed to get terminals:', error);
      }
    };
    fetchTerminals();
  }, []);

  const openInTerminal = async (projectPath: string, terminalApp: string) => {
    try {
      await invoke('open_session_in_terminal', {
        project_path: projectPath,
        terminal_app: terminalApp,
      });
    } catch (error) {
      console.error('Failed to open terminal:', error);
      throw error;
    }
  };

  const setDefaultTerminal = async (terminal: string) => {
    try {
      await invoke('set_default_terminal', { terminal });
    } catch (error) {
      console.error('Failed to set default terminal:', error);
      throw error;
    }
  };

  return {
    availableTerminals,
    openInTerminal,
    setDefaultTerminal,
  };
}
```

### 4. Use Hooks in Components

```typescript
// ProjectDashboard.tsx
import { useProjects } from '../hooks/useProjects';

export function ProjectDashboard() {
  const { projects, loading, createProject, deleteProject } = useProjects();

  return (
    <div>
      <h1>Projects</h1>
      {loading ? <p>Loading...</p> : (
        <ul>
          {projects.map(p => (
            <li key={p.id}>
              {p.name}
              <button onClick={() => deleteProject(p.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => createProject('New Project', '/path')}>
        Create Project
      </button>
    </div>
  );
}
```

## Data Types

### Project
```typescript
interface Project {
  id: string;           // UUID
  name: string;
  description: string;
  path: string;
  color: string;        // Hex color, default: #3B82F6
  is_favorited: boolean;
  session_ids: string[];
  created_at: string;   // RFC3339 timestamp
  updated_at: string;   // RFC3339 timestamp
}
```

### Session
```typescript
interface Session {
  id: string;                              // UUID
  project_id: string;
  name: string;
  metadata: {
    shell: 'bash' | 'zsh' | 'fish' | 'sh' | 'tcsh' | 'ksh';
    working_directory: string;
    environment_variables: Record<string, string>;
  };
  command_history: string[];
  created_at: string;                      // RFC3339 timestamp
  updated_at: string;                      // RFC3339 timestamp
}
```

## Available Terminals

Detected automatically on macOS:
- `Terminal` - macOS Terminal.app
- `iTerm2` - iTerm2 terminal
- `WezTerm` - WezTerm terminal (if installed)
- `Alacritty` - Alacritty terminal (if installed)
- `Kitty` - Kitty terminal (if installed)

## Error Handling

All commands return `Result<T, String>`, which means errors come as strings:

```typescript
try {
  await invoke('create_project', { name, path });
} catch (error) {
  // error is a string: "Project not found: xyz" or similar
  console.error('Error:', error);
}
```

## State Persistence

- Projects and sessions are automatically saved to JSON files
- Located in `~/Library/Application Support/CloudCodeSessionManager/`
- Files: `projects.json`, `sessions.json`
- Automatically loaded on app startup

## Debugging Tips

1. **Check Backend Logs**: Rust logs are available in console
2. **Verify IPC Communication**: Use Tauri DevTools (F12)
3. **Test Commands Directly**: Use Tauri Shell command for testing
4. **Type Safety**: Use TypeScript interfaces matching Rust struct definitions

## Next Steps

1. Implement hooks (Task #10)
2. Create React components (Task #11)
3. Integrate terminal UI (Task #12)
4. End-to-end testing (Task #13)
5. Final validation (Task #14)

## Support

Refer to:
- `/Users/mannix/Project/projectTerm/cloudcode-rust/IMPLEMENTATION_SUMMARY_TASK_3.md` - Detailed command implementation
- Rust source files for exact signatures
- Tauri docs: https://tauri.app/v1/guides/frontend/
