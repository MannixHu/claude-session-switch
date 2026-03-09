use crate::models::{Session, ShellType};
use crate::services::{ProjectService, SessionService};
use crate::AppState;
use tauri::State;

#[tauri::command(rename_all = "snake_case")]
pub fn create_session(
    project_id: String,
    name: String,
    shell: String,
    state: State<'_, AppState>,
) -> Result<Session, String> {
    create_session_internal(
        &state.project_service,
        &state.session_service,
        project_id,
        name,
        shell,
    )
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_sessions_for_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Session>, String> {
    state.session_service.list_sessions_for_project(&project_id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn list_sessions(state: State<'_, AppState>) -> Result<Vec<Session>, String> {
    state.session_service.list_sessions()
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_session(id: String, state: State<'_, AppState>) -> Result<Session, String> {
    state.session_service.get_session(&id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn update_session(session: Session, state: State<'_, AppState>) -> Result<Session, String> {
    state.session_service.update_session(session)
}

#[tauri::command(rename_all = "snake_case")]
pub fn delete_session(id: String, state: State<'_, AppState>) -> Result<(), String> {
    delete_session_internal(&state.project_service, &state.session_service, id)
}

#[tauri::command(rename_all = "snake_case")]
pub fn add_command_history(
    session_id: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .session_service
        .add_command_history(&session_id, command)
}

#[tauri::command(rename_all = "snake_case")]
pub fn clear_command_history(session_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state.session_service.clear_command_history(&session_id)
}

fn create_session_internal(
    project_service: &ProjectService,
    session_service: &SessionService,
    project_id: String,
    name: String,
    shell: String,
) -> Result<Session, String> {
    let project = project_service.get_project(&project_id)?;
    let shell_type = ShellType::from_str(&shell)
        .ok_or_else(|| format!("Unsupported shell: {}", shell.trim()))?;
    let session = session_service.create_session(project.id.clone(), name, shell_type)?;

    if let Err(error) = project_service.add_session_to_project(&project.id, &session.id) {
        let _ = session_service.delete_session(&session.id);
        return Err(error);
    }

    Ok(session)
}

fn delete_session_internal(
    project_service: &ProjectService,
    session_service: &SessionService,
    id: String,
) -> Result<(), String> {
    let session = session_service.get_session(&id)?;
    session_service.delete_session(&session.id)?;
    project_service.remove_session_from_project(&session.project_id, &session.id)
}

#[cfg(test)]
mod tests {
    use super::{create_session_internal, delete_session_internal};
    use crate::models::ShellType;
    use crate::services::storage_service::{
        storage_test_env_lock, unique_test_data_dir, DATA_DIR_OVERRIDE_ENV,
    };
    use crate::services::{ProjectService, SessionService};
    use std::fs;

    #[test]
    fn create_session_internal_updates_project_session_ids() {
        let _guard = storage_test_env_lock().lock().unwrap();
        let data_dir = unique_test_data_dir("create-session-command");
        std::env::set_var(DATA_DIR_OVERRIDE_ENV, &data_dir);

        let project_service = ProjectService::new();
        let session_service = SessionService::new();

        let project = project_service
            .create_project("Demo".to_string(), "/tmp/demo".to_string())
            .unwrap();

        let session = create_session_internal(
            &project_service,
            &session_service,
            project.id.clone(),
            "Main".to_string(),
            "zsh".to_string(),
        )
        .unwrap();

        let stored_project = project_service.get_project(&project.id).unwrap();
        assert_eq!(stored_project.session_ids, vec![session.id]);

        std::env::remove_var(DATA_DIR_OVERRIDE_ENV);
        let _ = fs::remove_dir_all(data_dir);
    }

    #[test]
    fn delete_session_internal_removes_project_session_id() {
        let _guard = storage_test_env_lock().lock().unwrap();
        let data_dir = unique_test_data_dir("delete-session-command");
        std::env::set_var(DATA_DIR_OVERRIDE_ENV, &data_dir);

        let project_service = ProjectService::new();
        let session_service = SessionService::new();

        let project = project_service
            .create_project("Demo".to_string(), "/tmp/demo".to_string())
            .unwrap();
        let session = session_service
            .create_session(project.id.clone(), "Main".to_string(), ShellType::Zsh)
            .unwrap();

        let mut stored_project = project_service.get_project(&project.id).unwrap();
        stored_project.session_ids = vec![session.id.clone()];
        project_service.update_project(stored_project).unwrap();

        delete_session_internal(&project_service, &session_service, session.id.clone()).unwrap();

        let refreshed_project = project_service.get_project(&project.id).unwrap();
        assert!(refreshed_project.session_ids.is_empty());

        std::env::remove_var(DATA_DIR_OVERRIDE_ENV);
        let _ = fs::remove_dir_all(data_dir);
    }
}
