use crate::models::{Session, ShellType};
use crate::services::storage_service::StorageService;
use std::collections::HashSet;
use std::sync::Mutex;

pub struct SessionService {
    sessions: Mutex<Vec<Session>>,
}

impl SessionService {
    pub fn new() -> Self {
        let mut sessions = StorageService::read::<Vec<Session>>(&StorageService::sessions_file())
            .unwrap_or_default();

        if Self::normalize_sessions(&mut sessions) {
            if let Err(error) = Self::persist_sessions(&sessions) {
                log::warn!(
                    "Failed to persist normalized sessions at startup: {}",
                    error
                );
            }
        }

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

        let normalized_project_id = project_id.trim();
        if normalized_project_id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        let normalized_name = name.trim();
        if normalized_name.is_empty() {
            return Err("Session name cannot be empty".to_string());
        }

        let session = Session::new(
            normalized_project_id.to_string(),
            normalized_name.to_string(),
            shell.to_string(),
        );
        sessions.push(session.clone());

        Self::persist_sessions(&sessions)?;

        Ok(session)
    }

    pub fn list_sessions_for_project(&self, project_id: &str) -> Result<Vec<Session>, String> {
        let normalized_project_id = project_id.trim();
        if normalized_project_id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let project_sessions: Vec<Session> = sessions
            .iter()
            .filter(|s| s.project_id == normalized_project_id)
            .cloned()
            .collect();
        Ok(project_sessions)
    }

    pub fn list_sessions(&self) -> Result<Vec<Session>, String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        Ok(sessions.clone())
    }

    pub fn get_session(&self, id: &str) -> Result<Session, String> {
        let normalized_id = id.trim();
        if normalized_id.is_empty() {
            return Err("Session id cannot be empty".to_string());
        }

        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions
            .iter()
            .find(|s| s.id == normalized_id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", normalized_id))
    }

    pub fn update_session(&self, mut session: Session) -> Result<Session, String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        session.id = session.id.trim().to_string();
        if session.id.is_empty() {
            return Err("Session id cannot be empty".to_string());
        }

        session.project_id = session.project_id.trim().to_string();
        if session.project_id.is_empty() {
            return Err("Project id cannot be empty".to_string());
        }

        session.name = session.name.trim().to_string();
        if session.name.is_empty() {
            return Err("Session name cannot be empty".to_string());
        }

        let normalized_shell = session.shell.trim().to_lowercase();
        if ShellType::from_str(&normalized_shell).is_none() {
            return Err(format!("Unsupported shell: {}", session.shell));
        }
        session.shell = normalized_shell;

        if let Some(pos) = sessions.iter().position(|s| s.id == session.id) {
            session.updated_at = chrono::Utc::now().to_rfc3339();
            sessions[pos] = session.clone();

            Self::persist_sessions(&sessions)?;
            Ok(session)
        } else {
            Err(format!("Session not found: {}", session.id))
        }
    }

    pub fn delete_session(&self, id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let normalized_id = id.trim();
        if normalized_id.is_empty() {
            return Err("Session id cannot be empty".to_string());
        }

        let before = sessions.len();
        sessions.retain(|s| s.id != normalized_id);

        if sessions.len() == before {
            return Err(format!("Session not found: {}", normalized_id));
        }

        Self::persist_sessions(&sessions)?;
        Ok(())
    }

    pub fn add_command_history(&self, session_id: &str, command: String) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("Session id cannot be empty".to_string());
        }

        let normalized_command = command.trim();
        if normalized_command.is_empty() {
            return Err("Command cannot be empty".to_string());
        }

        if let Some(session) = sessions.iter_mut().find(|s| s.id == normalized_session_id) {
            session.command_history.push(normalized_command.to_string());
            session.updated_at = chrono::Utc::now().to_rfc3339();

            Self::persist_sessions(&sessions)?;
            Ok(())
        } else {
            Err(format!("Session not found: {}", normalized_session_id))
        }
    }

    pub fn clear_command_history(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;

        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("Session id cannot be empty".to_string());
        }

        if let Some(session) = sessions.iter_mut().find(|s| s.id == normalized_session_id) {
            session.command_history.clear();
            session.updated_at = chrono::Utc::now().to_rfc3339();

            Self::persist_sessions(&sessions)?;
            Ok(())
        } else {
            Err(format!("Session not found: {}", normalized_session_id))
        }
    }

    fn persist_sessions(sessions: &[Session]) -> Result<(), String> {
        StorageService::write(&StorageService::sessions_file(), &sessions)
            .map_err(|e| format!("Failed to save sessions: {}", e))
    }

    fn normalize_sessions(sessions: &mut Vec<Session>) -> bool {
        let mut changed = false;
        let mut seen_ids: HashSet<String> = HashSet::new();

        sessions.retain(|session| {
            let keep = !session.id.trim().is_empty()
                && !session.project_id.trim().is_empty()
                && !session.name.trim().is_empty()
                && seen_ids.insert(session.id.trim().to_string());

            if !keep {
                changed = true;
            }

            keep
        });

        for session in sessions.iter_mut() {
            let normalized_id = session.id.trim().to_string();
            if normalized_id != session.id {
                session.id = normalized_id;
                changed = true;
            }

            let normalized_name = session.name.trim().to_string();
            if normalized_name != session.name {
                session.name = normalized_name;
                changed = true;
            }

            let normalized_project_id = session.project_id.trim().to_string();
            if normalized_project_id != session.project_id {
                session.project_id = normalized_project_id;
                changed = true;
            }

            let normalized_shell = session.shell.trim().to_lowercase();
            if ShellType::from_str(&normalized_shell).is_none() {
                session.shell = ShellType::Zsh.to_string();
                changed = true;
            } else if normalized_shell != session.shell {
                session.shell = normalized_shell;
                changed = true;
            }
        }

        changed
    }
}

impl Default for SessionService {
    fn default() -> Self {
        Self::new()
    }
}
