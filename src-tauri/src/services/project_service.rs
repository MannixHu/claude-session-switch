use crate::models::Project;
use crate::services::storage_service::StorageService;
use std::sync::Mutex;

pub struct ProjectService {
    projects: Mutex<Vec<Project>>,
}

impl ProjectService {
    pub fn new() -> Self {
        let projects = match StorageService::read::<Vec<Project>>(&StorageService::projects_file()) {
            Ok(data) => data,
            Err(_) => vec![],
        };

        ProjectService {
            projects: Mutex::new(projects),
        }
    }

    pub fn create_project(&self, name: String, path: String) -> Result<Project, String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        let project = Project::new(name, path);
        projects.push(project.clone());

        if let Err(e) = StorageService::write(&StorageService::projects_file(), &*projects) {
            return Err(format!("Failed to save projects: {}", e));
        }

        Ok(project)
    }

    pub fn list_projects(&self) -> Result<Vec<Project>, String> {
        let projects = self.projects.lock().map_err(|e| e.to_string())?;
        Ok(projects.clone())
    }

    pub fn get_project(&self, id: &str) -> Result<Project, String> {
        let projects = self.projects.lock().map_err(|e| e.to_string())?;
        projects
            .iter()
            .find(|p| p.id == id)
            .cloned()
            .ok_or_else(|| format!("Project not found: {}", id))
    }

    pub fn update_project(&self, mut project: Project) -> Result<Project, String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        if let Some(pos) = projects.iter().position(|p| p.id == project.id) {
            project.updated_at = chrono::Utc::now().to_rfc3339();
            projects[pos] = project.clone();

            if let Err(e) = StorageService::write(&StorageService::projects_file(), &*projects) {
                return Err(format!("Failed to save projects: {}", e));
            }
            Ok(project)
        } else {
            Err(format!("Project not found: {}", project.id))
        }
    }

    pub fn delete_project(&self, id: &str) -> Result<(), String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;
        projects.retain(|p| p.id != id);

        if let Err(e) = StorageService::write(&StorageService::projects_file(), &*projects) {
            return Err(format!("Failed to save projects: {}", e));
        }
        Ok(())
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<Project, String> {
        let mut projects = self.projects.lock().map_err(|e| e.to_string())?;

        if let Some(project) = projects.iter_mut().find(|p| p.id == id) {
            project.is_favorited = !project.is_favorited;
            project.updated_at = chrono::Utc::now().to_rfc3339();

            let result = project.clone();

            if let Err(e) = StorageService::write(&StorageService::projects_file(), &*projects) {
                return Err(format!("Failed to save projects: {}", e));
            }
            Ok(result)
        } else {
            Err(format!("Project not found: {}", id))
        }
    }
}

impl Default for ProjectService {
    fn default() -> Self {
        Self::new()
    }
}
