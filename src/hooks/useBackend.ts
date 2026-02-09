import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

// Type definitions
export interface Project {
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

export enum ShellType {
  Bash = "bash",
  Zsh = "zsh",
  Fish = "fish",
  Sh = "sh",
  Tcsh = "tcsh",
  Ksh = "ksh",
}

export interface SessionMetadata {
  shell: ShellType;
  working_directory: string;
  environment_variables: Record<string, string>;
}

export interface Session {
  id: string;
  project_id: string;
  name: string;
  shell: string;
  environment_variables: Record<string, string>;
  command_history: string[];
  created_at: string;
  updated_at: string;
}

export interface SessionCommandResult {
  command: string;
  shell: string;
  cwd: string;
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface ClaudeSession {
  session_id: string;
  project_path: string;
  summary: string;
  first_prompt: string;
  message_count: number;
  created: string;
  modified: string;
  git_branch: string;
  is_sidechain: boolean;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  description?: string;
  color?: string;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string;
  path?: string;
  color?: string;
}

export interface CreateSessionInput {
  project_id: string;
  name: string;
  shell: ShellType;
  working_directory?: string;
  environment_variables?: Record<string, string>;
}

export interface UpdateSessionInput {
  id: string;
  name?: string;
  shell?: ShellType;
  working_directory?: string;
  environment_variables?: Record<string, string>;
}

interface BackendState {
  loading: boolean;
  error: string | null;
}

// Main useBackend hook
export function useBackend() {
  const [state, setState] = useState<BackendState>({
    loading: false,
    error: null,
  });

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  // Project Commands
  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Project>("create_project", {
          name: input.name,
          path: input.path,
          description: input.description || "",
          color: input.color || "#3B82F6",
        });
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const listProjects = useCallback(async (): Promise<Project[]> => {
    setLoading(true);
    clearError();
    try {
      const result = await invoke<Project[]>("list_projects");
      return result || [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setError]);

  const getProject = useCallback(
    async (id: string): Promise<Project> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Project>("get_project", { id });
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const updateProject = useCallback(
    async (input: UpdateProjectInput): Promise<Project> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Project>("update_project", {
          id: input.id,
          name: input.name,
          description: input.description,
          path: input.path,
          color: input.color,
        } as Record<string, unknown>);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      clearError();
      try {
        await invoke("delete_project", { id });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const toggleFavorite = useCallback(
    async (id: string): Promise<Project> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Project>("toggle_favorite", { id });
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  // Session Commands
  const createSession = useCallback(
    async (input: CreateSessionInput): Promise<Session> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Session>("create_session", {
          project_id: input.project_id,
          name: input.name,
          shell: input.shell.toLowerCase(),
          working_directory: input.working_directory || "",
          environment_variables: input.environment_variables || {},
        });
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const listSessionsForProject = useCallback(
    async (projectId: string): Promise<Session[]> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Session[]>(
          "list_sessions_for_project",
          { project_id: projectId }
        );
        return result || [];
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const listSessions = useCallback(async (): Promise<Session[]> => {
    setLoading(true);
    clearError();
    try {
      const result = await invoke<Session[]>("list_sessions");
      return result || [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, clearError, setError]);

  const getSession = useCallback(
    async (id: string): Promise<Session> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Session>("get_session", { id });
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const updateSession = useCallback(
    async (input: UpdateSessionInput): Promise<Session> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Session>("update_session", {
          id: input.id,
          name: input.name,
          shell: input.shell,
          working_directory: input.working_directory,
          environment_variables: input.environment_variables,
        } as Record<string, unknown>);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const deleteSession = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true);
      clearError();
      try {
        await invoke("delete_session", { id });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const addCommandHistory = useCallback(
    async (sessionId: string, command: string): Promise<void> => {
      setLoading(true);
      clearError();
      try {
        await invoke("add_command_history", {
          session_id: sessionId,
          command,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const clearCommandHistory = useCallback(
    async (sessionId: string): Promise<void> => {
      setLoading(true);
      clearError();
      try {
        await invoke("clear_command_history", { session_id: sessionId });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  // Terminal Commands
  const getAvailableTerminals = useCallback(
    async (): Promise<Record<string, string>> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<Record<string, string>>(
          "get_available_terminals"
        );
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const openSessionInTerminal = useCallback(
    async (sessionId: string, terminal?: string): Promise<void> => {
      setLoading(true);
      clearError();
      try {
        await invoke("open_session_in_terminal", {
          session_id: sessionId,
          terminal: terminal || null,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const runSessionCommand = useCallback(
    async (sessionId: string, command: string): Promise<SessionCommandResult> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<SessionCommandResult>("run_session_command", {
          session_id: sessionId,
          command,
        });
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  // PTY Commands
  const createPty = useCallback(
    async (sessionId: string, workingDir: string): Promise<boolean> => {
      return invoke<boolean>("create_pty", { session_id: sessionId, working_dir: workingDir });
    },
    []
  );

  const writePty = useCallback(
    async (sessionId: string, data: string): Promise<void> => {
      return invoke<void>("write_pty", { session_id: sessionId, data });
    },
    []
  );

  const resizePty = useCallback(
    async (sessionId: string, cols: number, rows: number): Promise<void> => {
      return invoke<void>("resize_pty", { session_id: sessionId, cols, rows });
    },
    []
  );

  const closePty = useCallback(
    async (sessionId: string): Promise<void> => {
      return invoke<void>("close_pty", { session_id: sessionId });
    },
    []
  );

  const closeAllPtys = useCallback(
    async (): Promise<void> => {
      return invoke<void>("close_all_ptys");
    },
    []
  );

  // Claude Code Native Session Commands
  const listClaudeSessions = useCallback(
    async (projectPath: string, limit?: number): Promise<ClaudeSession[]> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<ClaudeSession[]>("list_claude_sessions", {
          project_path: projectPath,
          limit: limit ?? null,
        });
        return result || [];
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const listClaudeProjects = useCallback(
    async (): Promise<[string, string][]> => {
      setLoading(true);
      clearError();
      try {
        const result = await invoke<[string, string][]>("list_claude_projects");
        return result || [];
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, clearError, setError]
  );

  const deleteClaudeSession = useCallback(
    async (projectPath: string, sessionId: string): Promise<void> => {
      try {
        await invoke<void>("delete_claude_session", {
          project_path: projectPath,
          session_id: sessionId,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setError(errorMsg);
        throw error;
      }
    },
    [setError]
  );

  return {
    // State
    loading: state.loading,
    error: state.error,
    clearError,

    // Project commands
    createProject,
    listProjects,
    getProject,
    updateProject,
    deleteProject,
    toggleFavorite,

    // Session commands
    createSession,
    listSessionsForProject,
    listSessions,
    getSession,
    updateSession,
    deleteSession,
    addCommandHistory,
    clearCommandHistory,

    // Terminal commands
    getAvailableTerminals,
    openSessionInTerminal,
    runSessionCommand,

    // PTY commands
    createPty,
    writePty,
    resizePty,
    closePty,
    closeAllPtys,

    // Claude Code native session commands
    listClaudeSessions,
    listClaudeProjects,
    deleteClaudeSession,
  };
}
