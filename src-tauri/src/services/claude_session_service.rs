use crate::models::claude_session::{ClaudeSession, ClaudeSessionsIndex, JsonlEntry};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

pub struct ClaudeSessionService;

impl ClaudeSessionService {
    /// Get the Claude Code projects directory (~/.claude/projects/)
    fn claude_projects_dir() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".claude").join("projects"))
    }

    /// Convert a project path to the Claude Code directory name encoding.
    /// e.g., "/Users/mannix/Project/MeFlow3" -> "-Users-mannix-Project-MeFlow3"
    fn encode_project_path(project_path: &str) -> String {
        project_path.replace('/', "-")
    }

    /// List native Claude Code sessions for a given project path.
    /// Tries sessions-index.json first, falls back to scanning JSONL files.
    pub fn list_sessions_for_project(
        project_path: &str,
        limit: Option<usize>,
    ) -> Result<Vec<ClaudeSession>, String> {
        let normalized_project_path = Self::normalize_non_empty(project_path, "Project path")?;

        let projects_dir = Self::claude_projects_dir()
            .ok_or_else(|| "Cannot determine home directory".to_string())?;

        let encoded = Self::encode_project_path(&normalized_project_path);
        let project_dir = projects_dir.join(&encoded);

        if !project_dir.exists() {
            return Ok(vec![]);
        }

        // Try sessions-index.json first
        let index_path = project_dir.join("sessions-index.json");
        let mut sessions = if index_path.exists() {
            let indexed_sessions = Self::load_from_index(&index_path, &normalized_project_path)?;
            if indexed_sessions.is_empty() {
                Self::scan_jsonl_files(&project_dir, &normalized_project_path)?
            } else {
                indexed_sessions
            }
        } else {
            Self::scan_jsonl_files(&project_dir, &normalized_project_path)?
        };

        // Sort by modified time descending (most recent first)
        sessions.sort_by(|a, b| b.modified.cmp(&a.modified));

        // Apply limit
        if let Some(limit) = limit {
            sessions.truncate(limit);
        }

        Ok(sessions)
    }

    /// Load sessions from a sessions-index.json file
    fn load_from_index(
        index_path: &Path,
        project_path: &str,
    ) -> Result<Vec<ClaudeSession>, String> {
        let content = fs::read_to_string(index_path)
            .map_err(|e| format!("Failed to read sessions index: {}", e))?;

        let index: ClaudeSessionsIndex = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse sessions index: {}", e))?;

        let project_dir = index_path
            .parent()
            .ok_or_else(|| "Failed to resolve project directory for sessions index".to_string())?;

        let sessions: Vec<ClaudeSession> = index
            .entries
            .into_iter()
            .filter(|entry| !entry.is_sidechain.unwrap_or(false))
            .filter_map(|entry| {
                let resolved_path = entry
                    .full_path
                    .as_ref()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| project_dir.join(format!("{}.jsonl", entry.session_id)));

                if !resolved_path.exists() {
                    log::debug!(
                        "Skipping stale Claude session index entry {} because file does not exist: {}",
                        entry.session_id,
                        resolved_path.display()
                    );
                    return None;
                }

                Some(ClaudeSession {
                    session_id: entry.session_id,
                    project_path: entry
                        .project_path
                        .unwrap_or_else(|| project_path.to_string()),
                    summary: entry.summary.unwrap_or_default(),
                    first_prompt: entry.first_prompt.unwrap_or_default(),
                    message_count: entry.message_count.unwrap_or(0),
                    created: entry.created.unwrap_or_default(),
                    modified: entry.modified.unwrap_or_default(),
                    git_branch: entry.git_branch.unwrap_or_default(),
                    is_sidechain: false,
                })
            })
            .collect();

        Ok(sessions)
    }

    /// Scan .jsonl files in the project directory and extract session info
    fn scan_jsonl_files(
        project_dir: &Path,
        project_path: &str,
    ) -> Result<Vec<ClaudeSession>, String> {
        let entries = fs::read_dir(project_dir)
            .map_err(|e| format!("Failed to read project directory: {}", e))?;

        let mut sessions = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }

            // Extract session ID from filename (UUID.jsonl)
            let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
                Some(s) => s.to_string(),
                None => continue,
            };

            // Skip agent/subagent files
            if file_stem.starts_with("agent-") {
                continue;
            }

            if let Ok(session) = Self::parse_jsonl_file(&path, &file_stem, project_path) {
                sessions.push(session);
            }
        }

        Ok(sessions)
    }

    /// Parse a JSONL file to extract session metadata
    fn parse_jsonl_file(
        path: &Path,
        session_id: &str,
        project_path: &str,
    ) -> Result<ClaudeSession, String> {
        let file = fs::File::open(path).map_err(|e| format!("Failed to open JSONL file: {}", e))?;

        let metadata =
            fs::metadata(path).map_err(|e| format!("Failed to get file metadata: {}", e))?;

        let modified_time = metadata
            .modified()
            .ok()
            .and_then(|t| {
                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                    chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default()
                })
            })
            .unwrap_or_default();

        let reader = BufReader::new(file);

        let mut first_prompt = String::new();
        let mut first_timestamp = String::new();
        let mut last_timestamp = modified_time.clone();
        let mut git_branch = String::new();
        let mut message_count: u32 = 0;
        let mut is_sidechain = false;

        // Only read first N lines to avoid parsing huge files
        for line in reader.lines().take(50) {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };

            if line.trim().is_empty() {
                continue;
            }

            let entry: JsonlEntry = match serde_json::from_str(&line) {
                Ok(e) => e,
                Err(_) => continue,
            };

            if let Some(ref t) = entry.entry_type {
                if t == "user" {
                    message_count += 1;

                    if message_count == 1 {
                        // Extract first user prompt
                        if let Some(ref msg) = entry.message {
                            if let Some(ref content) = msg.content {
                                first_prompt = match content {
                                    serde_json::Value::String(s) => s.chars().take(200).collect(),
                                    _ => content.to_string().chars().take(200).collect(),
                                };
                            }
                        }

                        if let Some(ref ts) = entry.timestamp {
                            first_timestamp = ts.clone();
                        }
                    }

                    if let Some(ref branch) = entry.git_branch {
                        if !branch.is_empty() {
                            git_branch = branch.clone();
                        }
                    }

                    if let Some(sc) = entry.is_sidechain {
                        is_sidechain = sc;
                    }
                } else if t == "assistant" {
                    message_count += 1;
                    if let Some(ref ts) = entry.timestamp {
                        last_timestamp = ts.clone();
                    }
                }
            }
        }

        Ok(ClaudeSession {
            session_id: session_id.to_string(),
            project_path: project_path.to_string(),
            summary: String::new(), // No summary available without index
            first_prompt,
            message_count,
            created: first_timestamp,
            modified: last_timestamp,
            git_branch,
            is_sidechain,
        })
    }

    /// List all Claude Code project directories and their original paths
    pub fn list_claude_projects() -> Result<Vec<(String, String)>, String> {
        let projects_dir = Self::claude_projects_dir()
            .ok_or_else(|| "Cannot determine home directory".to_string())?;

        if !projects_dir.exists() {
            return Ok(vec![]);
        }

        let entries = fs::read_dir(&projects_dir)
            .map_err(|e| format!("Failed to read Claude projects directory: {}", e))?;

        let mut projects = Vec::new();

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let dir_name = match path.file_name().and_then(|n| n.to_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };

            // Skip hidden dirs and the current project's memory dir
            if dir_name == "." || dir_name == ".." || dir_name == "memory" {
                continue;
            }

            // Try to read sessions-index.json for the original path
            let index_path = path.join("sessions-index.json");
            let original_path = if index_path.exists() {
                fs::read_to_string(&index_path)
                    .ok()
                    .and_then(|content| serde_json::from_str::<ClaudeSessionsIndex>(&content).ok())
                    .and_then(|index| index.original_path)
                    .unwrap_or_else(|| Self::decode_project_path(&dir_name))
            } else {
                Self::decode_project_path(&dir_name)
            };

            projects.push((dir_name, original_path));
        }

        Ok(projects)
    }

    /// Rename a Claude Code session by updating sessions-index.json metadata.
    ///
    /// This keeps session name consistent between this app and Claude CLI resume list
    /// when Claude uses sessions-index.json for display metadata.
    pub fn rename_claude_session(
        project_path: &str,
        session_id: &str,
        session_name: &str,
    ) -> Result<(), String> {
        let normalized_project_path = Self::normalize_non_empty(project_path, "Project path")?;
        let normalized_session_id = Self::normalize_non_empty(session_id, "Session id")?;
        let normalized_name = Self::normalize_non_empty(session_name, "Session name")?;

        let projects_dir = Self::claude_projects_dir()
            .ok_or_else(|| "Cannot determine home directory".to_string())?;

        let encoded = Self::encode_project_path(&normalized_project_path);
        let project_dir = projects_dir.join(&encoded);
        let index_path = project_dir.join("sessions-index.json");

        if !index_path.exists() {
            return Err("sessions-index.json not found for this project".to_string());
        }

        let content = fs::read_to_string(&index_path)
            .map_err(|e| format!("Failed to read sessions index: {}", e))?;

        let mut index_json: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse sessions index: {}", e))?;

        let entries = index_json
            .get_mut("entries")
            .and_then(|value| value.as_array_mut())
            .ok_or_else(|| "Invalid sessions-index.json format: entries missing".to_string())?;

        let mut found = false;
        for entry in entries.iter_mut() {
            let is_match = entry
                .get("sessionId")
                .and_then(|value| value.as_str())
                .map(|value| value == normalized_session_id)
                .unwrap_or(false);

            if !is_match {
                continue;
            }

            entry["summary"] = serde_json::Value::String(normalized_name.to_string());
            found = true;
            break;
        }

        if !found {
            return Err(format!(
                "Session not found in index: {}",
                normalized_session_id
            ));
        }

        let serialized = serde_json::to_string_pretty(&index_json)
            .map_err(|e| format!("Failed to serialize sessions index: {}", e))?;

        Self::write_file_atomically(&index_path, &serialized)?;

        Ok(())
    }

    /// Delete a Claude Code session JSONL file for the given project path and session ID.
    pub fn delete_claude_session(project_path: &str, session_id: &str) -> Result<(), String> {
        let normalized_project_path = Self::normalize_non_empty(project_path, "Project path")?;
        let normalized_session_id = Self::normalize_non_empty(session_id, "Session id")?;

        let projects_dir = Self::claude_projects_dir()
            .ok_or_else(|| "Cannot determine home directory".to_string())?;

        let encoded = Self::encode_project_path(&normalized_project_path);
        let project_dir = projects_dir.join(&encoded);
        let jsonl_path = project_dir.join(format!("{}.jsonl", normalized_session_id));

        if !jsonl_path.exists() {
            return Err(format!("Session file not found: {}", normalized_session_id));
        }

        fs::remove_file(&jsonl_path)
            .map_err(|e| format!("Failed to delete session file: {}", e))?;

        Ok(())
    }

    /// Decode the directory name back to a path (best effort)
    /// e.g., "-Users-mannix-Project-MeFlow3" -> "/Users/mannix/Project/MeFlow3"
    fn decode_project_path(encoded: &str) -> String {
        if encoded.starts_with('-') {
            // Replace leading dash with / and subsequent dashes with /
            format!("/{}", &encoded[1..].replace('-', "/"))
        } else {
            encoded.replace('-', "/")
        }
    }

    fn normalize_non_empty(value: &str, field: &str) -> Result<String, String> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err(format!("{} cannot be empty", field));
        }

        Ok(trimmed.to_string())
    }

    fn write_file_atomically(path: &Path, content: &str) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to prepare parent directory: {}", error))?;
        }

        let temp_path = Self::temp_path_for(path);
        fs::write(&temp_path, content)
            .map_err(|error| format!("Failed to write temporary sessions index: {}", error))?;

        match fs::rename(&temp_path, path) {
            Ok(()) => Ok(()),
            Err(rename_error) => {
                if path.exists() {
                    fs::remove_file(path)
                        .map_err(|error| format!("Failed to replace sessions index: {}", error))?;
                    fs::rename(&temp_path, path).map_err(|error| {
                        format!("Failed to finalize sessions index replacement: {}", error)
                    })?;
                    Ok(())
                } else {
                    let _ = fs::remove_file(&temp_path);
                    Err(format!(
                        "Failed to persist sessions index: {}",
                        rename_error
                    ))
                }
            }
        }
    }

    fn temp_path_for(path: &Path) -> PathBuf {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("sessions-index.json");

        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();

        path.with_file_name(format!("{}.{}.tmp", file_name, nanos))
    }
}
