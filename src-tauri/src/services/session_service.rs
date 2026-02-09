use crate::models::{Session, ShellType};
use crate::services::storage_service::StorageService;
use std::sync::Mutex;

pub struct SessionService {
    sessions: Mutex<Vec<Session>>,
}

impl SessionService {
    pub fn new() -> Self {
        let sessions = match StorageService::read::<Vec<Session>>(&StorageService::sessions_file()) {
            Ok(data) => data,
            Err(_) => vec![],
        };

        SessionService {
            sessions: Mutex::new(sessions),
        }
    }

    pub fn create_session(
        &self,
        project_id: String,
        name: String,
        shell: ShellType,
    ) -> Result<Session, String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let session = Session::new(project_id, name, shell.to_string());
        sessions.push(session.clone());

        if let Err(e) = StorageService::write(&StorageService::sessions_file(), &*sessions) {
            return Err(format!("Failed to save sessions: {}", e));
        }

        Ok(session)
    }

    pub fn list_sessions_for_project(&self, project_id: &str) -> Result<Vec<Session>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let project_sessions: Vec<Session> = sessions
            .iter()
            .filter(|s| s.project_id == project_id)
            .cloned()
            .collect();
        Ok(project_sessions)
    }

    pub fn list_sessions(&self) -> Result<Vec<Session>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        Ok(sessions.clone())
    }

    pub fn get_session(&self, id: &str) -> Result<Session, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions
            .iter()
            .find(|s| s.id == id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", id))
    }

    pub fn update_session(&self, mut session: Session) -> Result<Session, String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        if let Some(pos) = sessions.iter().position(|s| s.id == session.id) {
            session.updated_at = chrono::Utc::now().to_rfc3339();
            sessions[pos] = session.clone();

            if let Err(e) = StorageService::write(&StorageService::sessions_file(), &*sessions) {
                return Err(format!("Failed to save sessions: {}", e));
            }
            Ok(session)
        } else {
            Err(format!("Session not found: {}", session.id))
        }
    }

    pub fn delete_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions.retain(|s| s.id != id);

        if let Err(e) = StorageService::write(&StorageService::sessions_file(), &*sessions) {
            return Err(format!("Failed to save sessions: {}", e));
        }
        Ok(())
    }

    pub fn add_command_history(&self, session_id: &str, command: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.command_history.push(command);
            session.updated_at = chrono::Utc::now().to_rfc3339();

            if let Err(e) = StorageService::write(&StorageService::sessions_file(), &*sessions) {
                return Err(format!("Failed to save sessions: {}", e));
            }
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }

    pub fn clear_command_history(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        if let Some(session) = sessions.iter_mut().find(|s| s.id == session_id) {
            session.command_history.clear();
            session.updated_at = chrono::Utc::now().to_rfc3339();

            if let Err(e) = StorageService::write(&StorageService::sessions_file(), &*sessions) {
                return Err(format!("Failed to save sessions: {}", e));
            }
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }
}

impl Default for SessionService {
    fn default() -> Self {
        Self::new()
    }
}
