import React, { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Project, ClaudeSession, useBackend } from "../hooks/useBackend";
import { useWindowManager } from "../hooks/useWindowManager";
import EmbeddedTerminal from "../components/EmbeddedTerminal";
import "./ProjectDashboard.css";

type ThemeMode = "dark" | "light";
const THEME_STORAGE_KEY = "cloudcode_theme_mode";
const DEFAULT_VISIBLE_SESSIONS = 3;

export function ProjectDashboard() {
  const {
    listProjects,
    listClaudeSessions,
    createProject,
    closePty,
    deleteClaudeSession,
    error,
  } = useBackend();

  const { layout, updateSidebarWidth } = useWindowManager();

  const [projects, setProjects] = useState<Project[]>([]);
  const [claudeSessionsByProject, setClaudeSessionsByProject] = useState<
    Record<string, ClaudeSession[]>
  >({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showAllSessions, setShowAllSessions] = useState<Record<string, boolean>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openTerminalSessionIds, setOpenTerminalSessionIds] = useState<Set<string>>(new Set());
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [, setStatusMessage] = useState("Ready.");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" ? "light" : "dark";
  });

  // Keyboard shortcut: ⌘B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const getWorkingDir = (terminalId: string): string => {
    if (terminalId.startsWith("__plain__")) {
      const projectId = terminalId.replace("__plain__", "");
      const project = projects.find((p) => p.id === projectId);
      return project?.path || "";
    }
    for (const project of projects) {
      const sessions = claudeSessionsByProject[project.id] || [];
      if (sessions.some((s) => s.session_id === terminalId)) {
        return project.path;
      }
    }
    return selectedProject?.path || "";
  };

  const loadProjectsAndSessions = async () => {
    try {
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);

      const claudeEntries = await Promise.all(
        loadedProjects.map(async (project) => {
          try {
            const sessions = await listClaudeSessions(project.path);
            return [project.id, sessions] as const;
          } catch {
            return [project.id, []] as const;
          }
        })
      );

      const sessionsByProject = Object.fromEntries(claudeEntries);
      setClaudeSessionsByProject(sessionsByProject);

      setExpandedProjects((previous) => {
        const next = { ...previous };
        for (const project of loadedProjects) {
          if (next[project.id] === undefined) {
            next[project.id] = true;
          }
        }
        return next;
      });

      if (!selectedProjectId && loadedProjects.length > 0) {
        let mostRecentSession: ClaudeSession | null = null;
        let mostRecentProjectId: string | null = null;

        for (const project of loadedProjects) {
          const sessions = (sessionsByProject[project.id] || [])
            .filter((s: ClaudeSession) => s.first_prompt || s.summary);
          for (const session of sessions) {
            if (!mostRecentSession || session.modified > mostRecentSession.modified) {
              mostRecentSession = session;
              mostRecentProjectId = project.id;
            }
          }
        }

        if (mostRecentSession && mostRecentProjectId) {
          setSelectedProjectId(mostRecentProjectId);
          setSelectedSessionId(mostRecentSession.session_id);
        } else {
          setSelectedProjectId(loadedProjects[0].id);
        }
      }
    } catch (loadError) {
      console.error("Failed to load projects and sessions", loadError);
      setStatusMessage("Failed to load projects/sessions.");
    }
  };

  useEffect(() => {
    void loadProjectsAndSessions();
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    getCurrentWindow().setTheme(themeMode === "dark" ? "dark" : "light").catch(() => {});
  }, [themeMode]);

  // Open terminal when session is selected
  useEffect(() => {
    if (!selectedSessionId || !selectedProject) return;

    // Close plain terminals
    setOpenTerminalSessionIds((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (id.startsWith("__plain__")) {
          closePty(id).catch(() => {});
          next.delete(id);
        }
      }
      next.add(selectedSessionId);
      return next;
    });
    setActiveTerminalId(selectedSessionId);
  }, [selectedSessionId]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((previous) => ({
      ...previous,
      [projectId]: !previous[projectId],
    }));
  };

  const handleQuickCreateProject = async () => {
    try {
      const selectedPath = await invoke<string | null>("pick_project_folder");
      if (!selectedPath) {
        setStatusMessage("Project creation canceled.");
        return;
      }

      const inferredName = selectedPath.split(/[\\/]/).filter(Boolean).pop() || "New Project";
      const created = await createProject({ name: inferredName, path: selectedPath });

      setProjects((previous) => [...previous, created]);
      setClaudeSessionsByProject((previous) => ({ ...previous, [created.id]: [] }));
      setExpandedProjects((previous) => ({ ...previous, [created.id]: true }));
      setSelectedProjectId(created.id);
      setSelectedSessionId(null);
      setStatusMessage(`Project added: ${created.name}`);

      try {
        const sessions = await listClaudeSessions(created.path);
        setClaudeSessionsByProject((previous) => ({ ...previous, [created.id]: sessions }));
      } catch {
        // No sessions found
      }
    } catch (createError) {
      console.error("Failed to create project", createError);
      const message = createError instanceof Error ? createError.message : String(createError);
      window.alert(`Create project failed: ${message}`);
      setStatusMessage(`Create project failed: ${message}`);
    }
  };

  const handleMouseDownDivider = (event: React.MouseEvent) => {
    if (isSidebarCollapsed) return;

    setIsDraggingDivider(true);
    const startX = event.clientX;
    const startWidth = layout.sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      updateSidebarWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const formatSessionLabel = (session: ClaudeSession): string => {
    if (session.summary) return session.summary;
    if (session.first_prompt) {
      return session.first_prompt.length > 50
        ? session.first_prompt.slice(0, 50) + "..."
        : session.first_prompt;
    }
    return session.session_id.slice(0, 8);
  };

  const formatTimeAgo = (dateStr: string): string => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "";
    }
  };

  const handleStopTerminal = async (event: React.MouseEvent, sessionId: string) => {
    event.stopPropagation();
    try {
      await closePty(sessionId);
      setOpenTerminalSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });

      // Open a plain terminal at the project directory
      if (selectedProject) {
        const plainId = `__plain__${selectedProject.id}`;
        setOpenTerminalSessionIds((prev) => new Set(prev).add(plainId));
        setActiveTerminalId(plainId);
        setSelectedSessionId(null);
        return;
      }

      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setActiveTerminalId(null);
      }
    } catch (err) {
      console.error("Failed to stop terminal", err);
    }
  };

  const handleDeleteSession = async (
    event: React.MouseEvent,
    projectId: string,
    projectPath: string,
    sessionId: string
  ) => {
    event.stopPropagation();
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    try {
      if (openTerminalSessionIds.has(sessionId)) {
        await closePty(sessionId);
        setOpenTerminalSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }
      await deleteClaudeSession(projectPath, sessionId);
      setClaudeSessionsByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] || []).filter((s) => s.session_id !== sessionId),
      }));
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setActiveTerminalId(null);
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  const sidebarWidth = isSidebarCollapsed ? 56 : layout.sidebarWidth;

  return (
    <div className={`project-dashboard theme-${themeMode}`}>
      <div className="drag-region" />
      {error && <div className="global-error">{error}</div>}

      <div className="dashboard-container">
        <aside
          className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="sidebar-header">
            <button
              className="sidebar-collapse-btn"
              onClick={() => setIsSidebarCollapsed((previous) => !previous)}
              title={isSidebarCollapsed ? "Show sidebar  ⌘B" : "Hide sidebar  ⌘B"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            {!isSidebarCollapsed && (
              <>
                <h2>Sessions</h2>
                <div className="sidebar-header-controls">
                  <button
                    className="theme-toggle-btn"
                    onClick={() => setThemeMode((prev) => (prev === "dark" ? "light" : "dark"))}
                    title={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                  >
                    {themeMode === "dark" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="create-project-btn"
                    onClick={() => void handleQuickCreateProject()}
                    title="Add project"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>

          {!isSidebarCollapsed && (
            <>
              <div className="project-tree">
                {projects.map((project) => {
                  const isSelectedProject = selectedProjectId === project.id;
                  const isExpanded = expandedProjects[project.id] ?? false;
                  const allSessions = (claudeSessionsByProject[project.id] || [])
                    .filter((s) => s.first_prompt || s.summary);
                  const isShowingAll = showAllSessions[project.id] ?? false;
                  const visibleSessions = isShowingAll
                    ? allSessions
                    : allSessions.slice(0, DEFAULT_VISIBLE_SESSIONS);
                  const hasMore = allSessions.length > DEFAULT_VISIBLE_SESSIONS;

                  return (
                    <div key={project.id} className="tree-project-block">
                      <div
                        className={`tree-project-row ${isSelectedProject ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setSelectedSessionId(null);
                        }}
                      >
                        <button
                          className="expand-toggle"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleProjectExpanded(project.id);
                          }}
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                        <span className="tree-project-name" title={project.name}>
                          {project.name}
                        </span>
                        {allSessions.length > 0 && (
                          <span className="tree-project-count">{allSessions.length}</span>
                        )}
                      </div>

                      <div className={`tree-session-list-wrapper ${isExpanded ? "expanded" : ""}`}>
                        <div className="tree-session-list">
                          {allSessions.length === 0 && (
                            <div className="tree-empty">No sessions</div>
                          )}

                          {visibleSessions.map((session) => (
                            <div
                              key={session.session_id}
                              className={`tree-session-row ${
                                selectedSessionId === session.session_id ? "selected" : ""
                              }`}
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setSelectedSessionId(session.session_id);
                              }}
                              title={session.first_prompt || session.summary}
                            >
                              <span className={`session-dot ${openTerminalSessionIds.has(session.session_id) ? "open" : ""}`}>
                                {openTerminalSessionIds.has(session.session_id) ? "●" : "•"}
                              </span>
                              <span className="tree-session-name">
                                {formatSessionLabel(session)}
                              </span>
                              <span className="tree-session-time">
                                {formatTimeAgo(session.modified)}
                              </span>
                              <span className="session-actions">
                                {openTerminalSessionIds.has(session.session_id) && (
                                  <button
                                    className="session-action-btn"
                                    onClick={(e) => void handleStopTerminal(e, session.session_id)}
                                    title="Stop terminal"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="6" y="6" width="12" height="12" rx="1" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  className="session-action-btn session-action-delete"
                                  onClick={(e) => void handleDeleteSession(e, project.id, project.path, session.session_id)}
                                  title="Delete session"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                          ))}

                          {hasMore && (
                            <button
                              className="show-more-btn"
                              onClick={(event) => {
                                event.stopPropagation();
                                setShowAllSessions((prev) => ({
                                  ...prev,
                                  [project.id]: !prev[project.id],
                                }));
                              }}
                            >
                              {isShowingAll
                                ? "Show less"
                                : `Show ${allSessions.length - DEFAULT_VISIBLE_SESSIONS} more...`}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {projects.length === 0 && <div className="tree-empty">No projects yet</div>}
              </div>
            </>
          )}

          {!isSidebarCollapsed && (
            <div
              className={`sidebar-resize-handle ${isDraggingDivider ? "dragging" : ""}`}
              onMouseDown={handleMouseDownDivider}
              title="Drag to resize sidebar"
            />
          )}
        </aside>

        <div className="terminal-area">
          {Array.from(openTerminalSessionIds).map((id) => (
            <EmbeddedTerminal
              key={id}
              sessionId={id}
              workingDir={getWorkingDir(id)}
              visible={id === activeTerminalId}
              isDark={themeMode === "dark"}
            />
          ))}
          {openTerminalSessionIds.size === 0 && (
            <div className="workspace-placeholder">
              <p>Select a session to open Claude Code.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
