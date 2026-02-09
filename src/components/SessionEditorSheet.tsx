import React, { useState } from "react";
import { ShellType } from "../hooks/useBackend";
import "./SessionEditorSheet.css";

interface SessionEditorSheetProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSubmit: (
    name: string,
    shell: ShellType,
    workDir: string,
    envVars: Record<string, string>
  ) => void;
  loading?: boolean;
}

export function SessionEditorSheet({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}: SessionEditorSheetProps) {
  const [formData, setFormData] = useState({
    name: "",
    shell: ShellType.Bash,
    workDir: "",
    envVars: "" as string,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Please fill in session name");
      return;
    }

    // Parse environment variables (format: KEY=value, one per line)
    const envVars: Record<string, string> = {};
    if (formData.envVars.trim()) {
      const lines = formData.envVars.trim().split("\n");
      for (const line of lines) {
        const [key, value] = line.split("=");
        if (key && value) {
          envVars[key.trim()] = value.trim();
        }
      }
    }

    onSubmit(formData.name, formData.shell, formData.workDir, envVars);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      shell: ShellType.Bash,
      workDir: "",
      envVars: "",
    });
  };

  return (
    <>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Session</h2>
              <button
                className="close-btn"
                onClick={onClose}
                disabled={loading}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="session-form">
              <div className="form-group">
                <label htmlFor="name">Session Name *</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Development Session"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="shell">Shell Type *</label>
                <select
                  id="shell"
                  value={formData.shell}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      shell: e.target.value as ShellType,
                    }))
                  }
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
                <label htmlFor="workDir">Working Directory</label>
                <input
                  id="workDir"
                  type="text"
                  placeholder="~"
                  value={formData.workDir}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      workDir: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="envVars">Environment Variables</label>
                <textarea
                  id="envVars"
                  placeholder="KEY1=value1&#10;KEY2=value2"
                  value={formData.envVars}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      envVars: e.target.value,
                    }))
                  }
                  disabled={loading}
                  rows={4}
                />
                <div className="hint">
                  Enter one environment variable per line in KEY=value format
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
