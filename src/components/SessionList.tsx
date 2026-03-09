import React, { useState, useEffect, useCallback } from "react";
import { useBackend, Session } from "../hooks/useBackend";
import "./SessionList.css";

interface SessionListProps {
  projectId: string;
  onSelectSession: (session: Session) => void;
  selectedSessionId?: string;
}

interface SessionItemProps {
  session: Session;
  isSelected: boolean;
  onSelect: (session: Session) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, sessionId: string) => void;
}

const SessionItem = React.memo(function SessionItem({
  session,
  isSelected,
  onSelect,
  onDelete,
}: SessionItemProps) {
  return (
    <div
      className={`session-item ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(session)}
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
        onClick={(e) => onDelete(e, session.id)}
        title="Delete session"
      >
        ×
      </button>
    </div>
  );
});

export function SessionList({
  projectId,
  onSelectSession,
  selectedSessionId,
}: SessionListProps) {
  const { listSessionsForProject, deleteSession, loading, error } =
    useBackend();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const data = await listSessionsForProject(projectId);
        setSessions(data);
      } catch (err) {
        console.error("Failed to load sessions", err);
      }
    };
    loadSessions();
  }, [projectId, listSessionsForProject]);

  const handleDelete = useCallback(async (
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
  }, [deleteSession]);

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
            <SessionItem
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={onSelectSession}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {sessions.length === 0 && !loading && (
        <div className="empty-state">No sessions for this project</div>
      )}
    </div>
  );
}
