use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub struct StorageService;

impl StorageService {
    pub fn app_data_dir() -> PathBuf {
        let base_dir = dirs::data_local_dir().unwrap_or_else(|| {
            let fallback = std::env::temp_dir();
            log::warn!(
                "Failed to resolve local data directory; using temp dir fallback: {}",
                fallback.display()
            );
            fallback
        });

        let data_dir = base_dir.join("CloudCodeSessionManager");

        if let Err(error) = fs::create_dir_all(&data_dir) {
            log::warn!(
                "Failed to ensure app data dir exists at {}: {}",
                data_dir.display(),
                error
            );
        }

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

    pub fn read<T: for<'de> Deserialize<'de>>(
        path: &PathBuf,
    ) -> Result<T, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let data = serde_json::from_str(&content)?;
        Ok(data)
    }

    pub fn write<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(data)?;
        let temp_path = Self::temp_path_for(path.as_path());

        fs::write(&temp_path, content)?;

        match fs::rename(&temp_path, path) {
            Ok(()) => Ok(()),
            Err(rename_error) => {
                if path.exists() {
                    fs::remove_file(path)?;
                    fs::rename(&temp_path, path)?;
                    Ok(())
                } else {
                    let _ = fs::remove_file(&temp_path);
                    Err(Box::new(rename_error))
                }
            }
        }
    }

    fn temp_path_for(path: &Path) -> PathBuf {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("storage.json");

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();

        path.with_file_name(format!("{}.{}.tmp", file_name, nanos))
    }
}
