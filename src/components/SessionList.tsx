import React, { useState, useEffect } from "react";
import { useBackend, Session } from "../hooks/useBackend";
import "./SessionList.css";

interface SessionListProps {
  projectId: string;
  onSelectSession: (session: Session) => void;
  selectedSessionId?: string;
}

export function SessionList({
  projectId,
  onSelectSession,
  selectedSessionId,
}: SessionListProps) {
  const { listSessionsForProject, deleteSession, loading, error } =
    useBackend();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    loadSessions();
  }, [projectId]);

  const loadSessions = async () => {
    try {
      const data = await listSessionsForProject(projectId);
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    sessionId: string
  ) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this session?")) {
      return;
    }
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h3>Sessions</h3>
        {error && <div className="error-message">{error}</div>}
      </div>

      {loading && <div className="loading">Loading sessions...</div>}

      {sessions.length > 0 && (
        <div className="session-group">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${
                selectedSessionId === session.id ? "selected" : ""
              }`}
              onClick={() => onSelectSession(session)}
            >
              <div className="session-shell-badge">
                {session.shell.toUpperCase()}
              </div>
              <div className="session-info">
                <div className="session-name">{session.name}</div>
                <div className="session-meta">{session.shell}</div>
              </div>
              <button
                className="icon-btn delete"
                onClick={(e) => handleDelete(e, session.id)}
                title="Delete session"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && !loading && (
        <div className="empty-state">No sessions for this project</div>
      )}
    </div>
  );
}
