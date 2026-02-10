use crate::models::Project;
use crate::services::storage_service::StorageService;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

const DEFAULT_PROJECT_COLOR: &str = "#3B82F6";

pub struct ProjectService {
    projects: Mutex<Vec<Project>>,
}

impl ProjectService {
    pub fn new() -> Self {
        let mut projects = StorageService::read::<Vec<Project>>(&StorageService::projects_file())
            .unwrap_or_default();

        if Self::dedupe_projects(&mut projects) {
            if let Err(error) = Self::persist_projects(&projects) {
                log::warn!("Failed to persist deduped projects at startup: {}", error);
            }
        }

        ProjectService {
            projects: Mutex::new(projects),
        }
    }

    pub fn create_project(&self, name: String, path: String) -> Result<Project, String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        let normalized_name = Self::normalize_project_name(&name);
        if normalized_name.is_empty() {
            return Err("Project name cannot be empty".to_string());
        }

        let normalized_path = Self::normalize_project_path(&path);
        if normalized_path.is_empty() {
            return Err("Project path cannot be empty".to_string());
        }

        if let Some(existing) = projects
            .iter_mut()
            .find(|project| Self::is_same_project(project, &normalized_name, &normalized_path))
        {
            existing.name = normalized_name;
            existing.path = normalized_path;
            existing.updated_at = chrono::Utc::now().to_rfc3339();

            let result = existing.clone();
            Self::persist_projects(&projects)?;
            return Ok(result);
        }

        let project = Project::new(normalized_name, normalized_path);
        projects.push(project.clone());

        Self::persist_projects(&projects)?;
        Ok(project)
    }

    pub fn list_projects(&self) -> Result<Vec<Project>, String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        if Self::dedupe_projects(&mut projects) {
            Self::persist_projects(&projects)?;
        }

        Ok(projects.clone())
    }

    pub fn get_project(&self, id: &str) -> Result<Project, String> {
        let normalized_id = id.trim();
        if normalized_id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        let projects = self.projects.lock().map_err(|e| e.to_string())?;
        projects
            .iter()
            .find(|p| p.id == normalized_id)
            .cloned()
            .ok_or_else(|| format!("Project not found: {}", normalized_id))
    }

    pub fn update_project(&self, mut project: Project) -> Result<Project, String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        project.id = project.id.trim().to_string();
        if project.id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        let normalized_name = Self::normalize_project_name(&project.name);
        if normalized_name.is_empty() {
            return Err("Project name cannot be empty".to_string());
        }

        let normalized_path = Self::normalize_project_path(&project.path);
        if normalized_path.is_empty() {
            return Err("Project path cannot be empty".to_string());
        }

        if projects.iter().any(|item| {
            item.id != project.id
                && Self::normalize_project_name(&item.name) == normalized_name
                && Self::normalize_project_path(&item.path) == normalized_path
        }) {
            return Err("A project with the same name and path already exists".to_string());
        }

        if let Some(pos) = projects.iter().position(|p| p.id == project.id) {
            project.name = normalized_name;
            project.path = normalized_path;
            project.updated_at = chrono::Utc::now().to_rfc3339();
            projects[pos] = project.clone();

            if Self::dedupe_projects(&mut projects) {
                // keep deduped state
            }

            Self::persist_projects(&projects)?;
            Ok(project)
        } else {
            Err(format!("Project not found: {}", project.id))
        }
    }

    pub fn delete_project(&self, id: &str) -> Result<(), String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;
        let normalized_id = id.trim();

        if normalized_id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        let before = projects.len();
        projects.retain(|p| p.id != normalized_id);

        if projects.len() == before {
            return Err(format!("Project not found: {}", normalized_id));
        }

        Self::persist_projects(&projects)
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<Project, String> {
        let normalized_id = id.trim();
        if normalized_id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        if let Some(project) = projects.iter_mut().find(|p| p.id == normalized_id) {
            project.is_favorited = !project.is_favorited;
            project.updated_at = chrono::Utc::now().to_rfc3339();

            let result = project.clone();
            Self::persist_projects(&projects)?;
            Ok(result)
        } else {
            Err(format!("Project not found: {}", normalized_id))
        }
    }

    fn persist_projects(projects: &[Project]) -> Result<(), String> {
        StorageService::write(&StorageService::projects_file(), &projects)
            .map_err(|error| format!("Failed to save projects: {}", error))
    }

    fn normalize_project_name(name: &str) -> String {
        name.trim().to_string()
    }

    fn normalize_project_path(path: &str) -> String {
        let mut normalized = path.trim().replace('\\', "/");

        while normalized.len() > 1 && normalized.ends_with('/') {
            if normalized.len() == 3 && normalized.ends_with(":/") {
                break;
            }
            normalized.pop();
        }

        normalized
    }

    fn is_same_project(project: &Project, normalized_name: &str, normalized_path: &str) -> bool {
        Self::normalize_project_name(&project.name) == normalized_name
            && Self::normalize_project_path(&project.path) == normalized_path
    }

    fn dedupe_projects(projects: &mut Vec<Project>) -> bool {
        let original_len = projects.len();

        let mut merged: Vec<Project> = Vec::with_capacity(projects.len());
        let mut index_by_key: HashMap<(String, String), usize> = HashMap::new();
        let mut changed = false;

        for mut project in projects.drain(..) {
            let normalized_name = Self::normalize_project_name(&project.name);
            let normalized_path = Self::normalize_project_path(&project.path);

            if normalized_name.is_empty() || normalized_path.is_empty() {
                changed = true;
                continue;
            }

            if normalized_name != project.name || normalized_path != project.path {
                project.name = normalized_name.clone();
                project.path = normalized_path.clone();
                changed = true;
            }

            let key = (normalized_name, normalized_path);

            if let Some(&target_idx) = index_by_key.get(&key) {
                changed = true;
                let target = &mut merged[target_idx];

                if target.description.trim().is_empty() && !project.description.trim().is_empty() {
                    target.description = project.description;
                }

                if target.color == DEFAULT_PROJECT_COLOR && project.color != DEFAULT_PROJECT_COLOR {
                    target.color = project.color;
                }

                target.is_favorited = target.is_favorited || project.is_favorited;

                let mut existing_session_ids: HashSet<String> =
                    target.session_ids.iter().cloned().collect();
                for session_id in project.session_ids {
                    if existing_session_ids.insert(session_id.clone()) {
                        target.session_ids.push(session_id);
                    }
                }

                if project.created_at < target.created_at {
                    target.created_at = project.created_at;
                }

                if project.updated_at > target.updated_at {
                    target.updated_at = project.updated_at;
                }
            } else {
                index_by_key.insert(key, merged.len());
                merged.push(project);
            }
        }

        if merged.len() != original_len {
            changed = true;
        }

        *projects = merged;
        changed
    }
}

impl Default for ProjectService {
    fn default() -> Self {
        Self::new()
    }
}
