import React, { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./ProjectEditorSheet.css";

interface ProjectEditorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, path: string, description: string, color: string) => void;
  loading?: boolean;
}

const COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
];

export function ProjectEditorSheet({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}: ProjectEditorSheetProps) {
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    path: "",
    description: "",
    color: COLORS[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.path.trim()) {
      alert("Please fill in all required fields");
      return;
    }
    onSubmit(formData.name, formData.path, formData.description, formData.color);
    setFormData({
      name: "",
      path: "",
      description: "",
      color: COLORS[0],
    });
  };

  const handleBrowseFolder = useCallback(async () => {
    if (loading) {
      return;
    }

    setPickerError(null);

    try {
      const selected = await invoke<string | null>("pick_project_folder");

      if (!selected) {
        return;
      }

      const inferredName = selected.split(/[\\/]/).filter(Boolean).pop() || "";

      setFormData((prev) => ({
        ...prev,
        path: selected,
        name: prev.name.trim() ? prev.name : inferredName,
      }));
    } catch (error) {
      console.error("Failed to open folder picker", error);
      setPickerError("Failed to open native folder picker. Please try again.");
    }
  }, [loading]);

  useEffect(() => {
    if (!isOpen || loading) {
      return;
    }

    void handleBrowseFolder();
  }, [isOpen, loading, handleBrowseFolder]);

  return (
    <>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Project</h2>
              <button
                className="close-btn"
                onClick={onClose}
                disabled={loading}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="project-form">
              <div className="form-group">
                <label htmlFor="name">Project Name *</label>
                <input
                  id="name"
                  type="text"
                  placeholder="My Project"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="path">Project Path *</label>
                <div className="path-picker-group">
                  <button
                    type="button"
                    className="browse-btn"
                    onClick={() => void handleBrowseFolder()}
                    disabled={loading}
                    title="Choose project folder"
                  >
                    {formData.path ? "Change Folder" : "Choose Folder"}
                  </button>
                  <div
                    id="path"
                    className={`path-preview ${formData.path ? "selected" : "empty"}`}
                  >
                    {formData.path || "No folder selected"}
                  </div>
                </div>
                {pickerError && <span className="field-error">{pickerError}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  placeholder="Optional project description..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  disabled={loading}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Project Color</label>
                <div className="color-picker">
                  {COLORS.map((color) => (
                    <div
                      key={color}
                      className={`color-option ${
                        formData.color === color ? "selected" : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() =>
                        !loading &&
                        setFormData((prev) => ({ ...prev, color }))
                      }
                      title={color}
                    >
                      {formData.color === color && <span>✓</span>}
                    </div>
                  ))}
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
                  {loading ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
