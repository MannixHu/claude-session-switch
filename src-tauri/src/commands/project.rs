use crate::models::Project;
use crate::services::{ProjectService, SessionService};
use crate::AppState;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn pick_project_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Select Project Folder")
        .blocking_pick_folder();

    let path = selected
        .and_then(|file_path| file_path.into_path().ok())
        .map(|path_buf| path_buf.to_string_lossy().to_string());

    Ok(path)
}

#[tauri::command]
pub fn create_project(
    name: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    state.project_service.create_project(name, path)
}

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    state.project_service.list_projects()
}

#[tauri::command]
pub fn get_project(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    state.project_service.get_project(&id)
}

#[tauri::command]
pub fn update_project(project: Project, state: State<'_, AppState>) -> Result<Project, String> {
    state.project_service.update_project(project)
}

#[tauri::command]
pub fn delete_project(id: String, state: State<'_, AppState>) -> Result<(), String> {
    delete_project_internal(&state.project_service, &state.session_service, id)
}

#[tauri::command]
pub fn toggle_favorite(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    state.project_service.toggle_favorite(&id)
}

fn delete_project_internal(
    project_service: &ProjectService,
    session_service: &SessionService,
    id: String,
) -> Result<(), String> {
    let project = project_service.get_project(&id)?;
    session_service.delete_sessions_for_project(&project.id)?;
    project_service.delete_project(&project.id)
}

#[cfg(test)]
mod tests {
    use super::delete_project_internal;
    use crate::models::ShellType;
    use crate::services::storage_service::{
        storage_test_env_lock, unique_test_data_dir, DATA_DIR_OVERRIDE_ENV,
    };
    use crate::services::{ProjectService, SessionService};
    use std::fs;

    #[test]
    fn delete_project_internal_removes_project_sessions() {
        let _guard = storage_test_env_lock().lock().unwrap();
        let data_dir = unique_test_data_dir("delete-project-command");
        std::env::set_var(DATA_DIR_OVERRIDE_ENV, &data_dir);

        let project_service = ProjectService::new();
        let session_service = SessionService::new();

        let project = project_service
            .create_project("Demo".to_string(), "/tmp/demo".to_string())
            .unwrap();
        session_service
            .create_session(project.id.clone(), "Main".to_string(), ShellType::Zsh)
            .unwrap();

        delete_project_internal(&project_service, &session_service, project.id.clone()).unwrap();

        assert!(session_service
            .list_sessions_for_project(&project.id)
            .unwrap()
            .is_empty());

        std::env::remove_var(DATA_DIR_OVERRIDE_ENV);
        let _ = fs::remove_dir_all(data_dir);
    }
}
