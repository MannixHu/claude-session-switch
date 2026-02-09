use tauri::State;
use tauri_plugin_dialog::DialogExt;
use crate::models::Project;
use crate::AppState;

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
pub fn update_project(
    project: Project,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    state.project_service.update_project(project)
}

#[tauri::command]
pub fn delete_project(id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.project_service.delete_project(&id)
}

#[tauri::command]
pub fn toggle_favorite(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    state.project_service.toggle_favorite(&id)
}
