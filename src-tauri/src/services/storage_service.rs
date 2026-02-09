use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use std::fs;

pub struct StorageService;

impl StorageService {
    pub fn app_data_dir() -> PathBuf {
        let data_dir = dirs::data_local_dir()
            .expect("Failed to get data directory")
            .join("CloudCodeSessionManager");

        let _ = fs::create_dir_all(&data_dir);
        data_dir
    }

    pub fn projects_file() -> PathBuf {
        Self::app_data_dir().join("projects.json")
    }

    pub fn sessions_file() -> PathBuf {
        Self::app_data_dir().join("sessions.json")
    }

    #[allow(dead_code)]
    pub fn preferences_file() -> PathBuf {
        Self::app_data_dir().join("preferences.json")
    }

    pub fn read<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<T, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let data = serde_json::from_str(&content)?;
        Ok(data)
    }

    pub fn write<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(data)?;
        fs::write(path, content)?;
        Ok(())
    }
}
