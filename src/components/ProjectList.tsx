import React, { useState, useEffect } from "react";
import { useBackend, Project } from "../hooks/useBackend";
import "./ProjectList.css";

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
  selectedProjectId?: string;
  refreshSignal?: number;
}

export function ProjectList({
  onSelectProject,
  selectedProjectId,
  refreshSignal = 0,
}: ProjectListProps) {
  const { listProjects, deleteProject, toggleFavorite, loading, error } =
    useBackend();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadProjects();
  }, [refreshSignal]);

  const loadProjects = async () => {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    projectId: string
  ) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  const handleToggleFavorite = async (
    e: React.MouseEvent<HTMLButtonElement>,
    projectId: string
  ) => {
    e.stopPropagation();
    try {
      const updated = await toggleFavorite(projectId);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updated : p))
      );
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const favorited = filteredProjects.filter((p) => p.is_favorited);
  const regular = filteredProjects.filter((p) => !p.is_favorited);

  return (
    <div className="project-list">
      <div className="project-list-header">
        <h3>Projects</h3>
        {error && <div className="error-message">{error}</div>}
      </div>

      <input
        type="text"
        placeholder="Search projects..."
        className="search-input"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loading && <div className="loading">Loading projects...</div>}

      {favorited.length > 0 && (
        <div className="project-group">
          <div className="group-title">Favorites</div>
          {favorited.map((project) => (
            <div
              key={project.id}
              className={`project-item ${
                selectedProjectId === project.id ? "selected" : ""
              }`}
              onClick={() => onSelectProject(project)}
            >
              <div
                className="project-color"
                style={{ backgroundColor: project.color }}
              ></div>
              <div className="project-info">
                <div className="project-name">{project.name}</div>
                <div className="project-path">{project.path}</div>
              </div>
              <div className="project-actions">
                <button
                  className="icon-btn favorite"
                  onClick={(e) => handleToggleFavorite(e, project.id)}
                  title="Remove from favorites"
                >
                  ★
                </button>
                <button
                  className="icon-btn delete"
                  onClick={(e) => handleDelete(e, project.id)}
                  title="Delete project"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {regular.length > 0 && (
        <div className="project-group">
          {favorited.length > 0 && <div className="group-title">All Projects</div>}
          {regular.map((project) => (
            <div
              key={project.id}
              className={`project-item ${
                selectedProjectId === project.id ? "selected" : ""
              }`}
              onClick={() => onSelectProject(project)}
            >
              <div
                className="project-color"
                style={{ backgroundColor: project.color }}
              ></div>
              <div className="project-info">
                <div className="project-name">{project.name}</div>
                <div className="project-path">{project.path}</div>
              </div>
              <div className="project-actions">
                <button
                  className="icon-btn favorite"
                  onClick={(e) => handleToggleFavorite(e, project.id)}
                  title="Add to favorites"
                >
                  ☆
                </button>
                <button
                  className="icon-btn delete"
                  onClick={(e) => handleDelete(e, project.id)}
                  title="Delete project"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredProjects.length === 0 && !loading && (
        <div className="empty-state">
          {searchTerm ? "No projects match your search" : "No projects yet"}
        </div>
      )}
    </div>
  );
}
