use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub shell: String, // "bash", "zsh", "fish"
    pub environment_variables: HashMap<String, String>,
    pub command_history: Vec<String>, // executed commands
    pub created_at: String,
    pub updated_at: String,
}

impl Session {
    pub fn new(project_id: String, name: String, shell: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            project_id,
            name,
            shell,
            environment_variables: HashMap::new(),
            command_history: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}
