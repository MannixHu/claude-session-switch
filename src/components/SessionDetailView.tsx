import { useState } from "react";
import { Session, ShellType } from "../hooks/useBackend";
import "./SessionDetailView.css";

interface SessionDetailViewProps {
  session: Session;
  onOpenInTerminal: (terminal?: string) => void;
  onOpenEmbeddedTerminal?: () => void;
  onUpdate: (name: string, shell: ShellType, workDir: string) => void;
  loading?: boolean;
  availableTerminals?: Record<string, string>;
}

export function SessionDetailView({
  session,
  onOpenInTerminal,
  onOpenEmbeddedTerminal,
  onUpdate,
  loading = false,
  availableTerminals = {},
}: SessionDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(session.name);
  const [editShell, setEditShell] = useState((session.shell as ShellType) || ShellType.Zsh);
  const [editWorkDir, setEditWorkDir] = useState("");
  const [selectedTerminal, setSelectedTerminal] = useState<string>("");
  const [showTerminalSelector, setShowTerminalSelector] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    general: true,
    environment: false,
    history: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSave = () => {
    onUpdate(editName, editShell, editWorkDir);
    setIsEditing(false);
  };

  const handleOpenInTerminal = () => {
    if (showTerminalSelector && selectedTerminal) {
      onOpenInTerminal(selectedTerminal);
      setShowTerminalSelector(false);
      setSelectedTerminal("");
    } else if (!showTerminalSelector && Object.keys(availableTerminals).length > 0) {
      setShowTerminalSelector(true);
    } else {
      onOpenInTerminal();
    }
  };

  return (
    <div className="session-detail-view">
      <div className="detail-header">
        <h2>{session.name}</h2>
        <div className="header-actions">
          {showTerminalSelector && Object.keys(availableTerminals).length > 0 && (
            <select
              className="terminal-selector"
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
              disabled={loading}
            >
              <option value="">Select Terminal...</option>
              {Object.entries(availableTerminals).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <button
            className="primary-btn"
            onClick={handleOpenInTerminal}
            disabled={loading || (showTerminalSelector && !selectedTerminal)}
          >
            {showTerminalSelector ? "Launch" : "Open in Terminal"}
          </button>
          {onOpenEmbeddedTerminal && (
            <button
              className="primary-btn"
              onClick={onOpenEmbeddedTerminal}
              disabled={loading}
            >
              Embedded Terminal
            </button>
          )}
          {showTerminalSelector && (
            <button
              className="secondary-btn"
              onClick={() => {
                setShowTerminalSelector(false);
                setSelectedTerminal("");
              }}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* General Section */}
      <div className="detail-section">
        <div
          className="section-title"
          onClick={() => toggleSection("general")}
        >
          <span className="expand-icon">
            {expandedSections.general ? "▼" : "▶"}
          </span>
          General Settings
        </div>
        {expandedSections.general && (
          <div className="section-content">
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Session Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Shell</label>
                  <select
                    value={editShell}
                    onChange={(e) => setEditShell(e.target.value as ShellType)}
                    disabled={loading}
                  >
                    {Object.values(ShellType).map((shell) => (
                      <option key={shell} value={shell}>
                        {shell.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Working Directory</label>
                  <input
                    type="text"
                    value={editWorkDir}
                    onChange={(e) => setEditWorkDir(e.target.value)}
                    placeholder="~"
                    disabled={loading}
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="secondary-btn"
                    onClick={() => setIsEditing(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-btn"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-display">
                <div className="info-row">
                  <span className="label">Session ID:</span>
                  <span className="value">{session.id}</span>
                </div>
                <div className="info-row">
                  <span className="label">Shell:</span>
                  <span className="value">{session.shell}</span>
                </div>
                <div className="info-row">
                  <span className="label">Working Directory:</span>
                  <span className="value">~</span>
                </div>
                <div className="info-row">
                  <span className="label">Created:</span>
                  <span className="value">
                    {new Date(session.created_at).toLocaleString()}
                  </span>
                </div>
                <button
                  className="secondary-btn"
                  onClick={() => setIsEditing(true)}
                  disabled={loading}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Environment Variables Section */}
      <div className="detail-section">
        <div
          className="section-title"
          onClick={() => toggleSection("environment")}
        >
          <span className="expand-icon">
            {expandedSections.environment ? "▼" : "▶"}
          </span>
          Environment Variables
        </div>
        {expandedSections.environment && (
          <div className="section-content">
            {Object.keys(session.environment_variables || {}).length > 0 ? (
              <div className="env-list">
                {Object.entries(session.environment_variables || {}).map(
                  ([key, value]) => (
                    <div key={key} className="env-item">
                      <span className="env-key">{key}</span>
                      <span className="env-value">{String(value)}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="empty-state">No environment variables set</div>
            )}
          </div>
        )}
      </div>

      {/* Command History Section */}
      <div className="detail-section">
        <div
          className="section-title"
          onClick={() => toggleSection("history")}
        >
          <span className="expand-icon">
            {expandedSections.history ? "▼" : "▶"}
          </span>
          Command History
        </div>
        {expandedSections.history && (
          <div className="section-content">
            {session.command_history.length > 0 ? (
              <div className="command-history">
                {session.command_history.map((cmd, idx) => (
                  <div key={idx} className="history-item">
                    <span className="history-index">{idx + 1}</span>
                    <span className="history-command">{cmd}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No command history</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
