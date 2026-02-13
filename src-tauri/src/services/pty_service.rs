use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PtyLaunchMode {
    Plain,
    ClaudeResume,
}

#[derive(Debug, Clone)]
pub struct PtyLaunchConfig {
    pub mode: PtyLaunchMode,
    pub resume_session_id: Option<String>,
    pub claude_args: Vec<String>,
}

impl PtyLaunchConfig {
    pub fn plain() -> Self {
        Self {
            mode: PtyLaunchMode::Plain,
            resume_session_id: None,
            claude_args: Vec::new(),
        }
    }

    pub fn claude_resume(resume_session_id: String, claude_args: Vec<String>) -> Self {
        Self {
            mode: PtyLaunchMode::ClaudeResume,
            resume_session_id: Some(resume_session_id),
            claude_args,
        }
    }

    fn launch_script(&self, fallback_session_id: &str, _working_dir: &str) -> Option<String> {
        if self.mode == PtyLaunchMode::Plain {
            return None;
        }

        let resume_id = self
            .resume_session_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(fallback_session_id);

        let mut claude_base_parts = vec![String::from("claude")];

        for arg in self
            .claude_args
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            claude_base_parts.push(shell_quote(arg));
        }

        let claude_base_command = claude_base_parts.join(" ");

        let mut claude_resume_parts = claude_base_parts;
        claude_resume_parts.push(String::from("-r"));
        claude_resume_parts.push(shell_quote(resume_id));

        let claude_resume_command = claude_resume_parts.join(" ");
        let claude_command = format!("{} || {}", claude_resume_command, claude_base_command);

        Some(format!(r#"exec {claude_command}"#))
    }
}

struct PtySession {
    token: String,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create(
        &self,
        session_id: &str,
        working_dir: &str,
        launch_config: PtyLaunchConfig,
        app_handle: tauri::AppHandle,
    ) -> Result<bool, String> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("PTY session id cannot be empty".to_string());
        }

        let normalized_working_dir = working_dir.trim();
        validate_working_dir(normalized_working_dir)?;

        if launch_config.mode == PtyLaunchMode::ClaudeResume {
            let resume_id = launch_config
                .resume_session_id
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or(normalized_session_id);

            validate_claude_resume_target(normalized_working_dir, resume_id)?;
        }

        log::info!(
            "PTY create request sid={} cwd={} mode={:?}",
            normalized_session_id,
            normalized_working_dir,
            launch_config.mode
        );

        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if sessions.contains_key(normalized_session_id) {
            log::debug!("PTY already exists for sid={}", normalized_session_id);
            return Ok(true);
        }

        let pty_system = native_pty_system();
        let size = PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let launch_script =
            launch_config.launch_script(normalized_session_id, normalized_working_dir);

        if let Some(script) = launch_script.as_ref() {
            log::debug!(
                "PTY launch script sid={} preview={}",
                normalized_session_id,
                log_preview(script)
            );
        }

        let mut cmd = CommandBuilder::new("/bin/zsh");
        if let Some(script) = launch_script {
            cmd.arg("-ilc");
            cmd.arg(script);
        } else {
            cmd.arg("-il");
        }
        cmd.cwd(normalized_working_dir);

        let inherited_term = std::env::var("TERM").unwrap_or_default();
        let resolved_term = if inherited_term.trim().is_empty() || inherited_term == "dumb" {
            "xterm-256color".to_string()
        } else {
            inherited_term
        };
        cmd.env("TERM", resolved_term.as_str());

        if let Ok(colorterm) = std::env::var("COLORTERM") {
            if !colorterm.trim().is_empty() {
                cmd.env("COLORTERM", colorterm);
            }
        } else {
            cmd.env("COLORTERM", "truecolor");
        }

        let inherited_path = std::env::var("PATH").unwrap_or_default();
        let runtime_path = build_runtime_path(&inherited_path);
        cmd.env("PATH", runtime_path.as_str());

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        drop(pair.slave);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

        let token = Uuid::new_v4().to_string();
        let sid = normalized_session_id.to_string();
        let sessions_ref = Arc::clone(&self.sessions);
        let reader_token = token.clone();

        std::thread::spawn(move || {
            reader_thread(sid, reader_token, reader, child, app_handle, sessions_ref);
        });

        let session = PtySession {
            token,
            master: pair.master,
            writer,
        };

        sessions.insert(normalized_session_id.to_string(), session);
        log::info!("PTY created sid={} cwd={}", normalized_session_id, normalized_working_dir);
        Ok(true)
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("PTY session id cannot be empty".to_string());
        }

        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .get_mut(normalized_session_id)
            .ok_or_else(|| format!("PTY session not found: {}", normalized_session_id))?;

        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;

        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("PTY session id cannot be empty".to_string());
        }

        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .get(normalized_session_id)
            .ok_or_else(|| format!("PTY session not found: {}", normalized_session_id))?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        Ok(())
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let normalized_session_id = session_id.trim();
        if normalized_session_id.is_empty() {
            return Err("PTY session id cannot be empty".to_string());
        }

        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions
            .remove(normalized_session_id)
            .ok_or_else(|| format!("PTY session not found: {}", normalized_session_id))?;
        log::info!("PTY close requested sid={}", normalized_session_id);
        Ok(())
    }

    pub fn close_all(&self) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let count = sessions.len();
        sessions.clear();
        if count > 0 {
            log::info!("PTY close_all requested count={}", count);
        }
        Ok(())
    }
}

impl Drop for PtyManager {
    fn drop(&mut self) {
        let _ = self.close_all();
    }
}

#[derive(serde::Serialize, Clone)]
struct PtyOutput {
    session_id: String,
    data: String,
}

#[derive(serde::Serialize, Clone)]
struct PtyExit {
    session_id: String,
    status: String,
}

fn emit_pty_output(app_handle: &tauri::AppHandle, session_id: &str, data: &str) -> bool {
    use tauri::Emitter;

    let payload = PtyOutput {
        session_id: session_id.to_string(),
        data: data.to_string(),
    };

    if let Err(error) = app_handle.emit("pty-output", payload) {
        log::warn!("Failed emitting global pty-output for {}: {}", session_id, error);
        return false;
    }

    let channel = format!("pty-output:{}", session_id);
    if let Err(error) = app_handle.emit(&channel, data.to_string()) {
        log::debug!(
            "Failed emitting session-specific PTY channel {}: {}",
            channel,
            error
        );
    }

    true
}

fn emit_pty_exit(app_handle: &tauri::AppHandle, session_id: &str, status: &str) {
    use tauri::Emitter;

    let payload = PtyExit {
        session_id: session_id.to_string(),
        status: status.to_string(),
    };

    if let Err(error) = app_handle.emit("pty-exit", payload) {
        log::debug!("Failed emitting pty-exit for {}: {}", session_id, error);
    }
}

fn reader_thread(
    session_id: String,
    token: String,
    mut reader: Box<dyn Read + Send>,
    mut child: Box<dyn portable_pty::Child + Send + Sync>,
    app_handle: tauri::AppHandle,
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
) {
    let mut buf = [0u8; 4096];
    let mut pending_utf8 = Vec::<u8>::new();
    let mut logged_chunk_count: usize = 0;

    'reader_loop: loop {
        match reader.read(&mut buf) {
            Ok(0) => {
                log::info!("PTY stream reached EOF sid={}", session_id);
                break;
            }
            Ok(n) => {
                pending_utf8.extend_from_slice(&buf[..n]);

                while !pending_utf8.is_empty() {
                    match std::str::from_utf8(&pending_utf8) {
                        Ok(valid_text) => {
                            if logged_chunk_count < 6 {
                                log::info!(
                                    "PTY output chunk sid={} idx={} bytes={} preview={}",
                                    session_id,
                                    logged_chunk_count,
                                    valid_text.len(),
                                    log_preview(valid_text)
                                );
                            }
                            logged_chunk_count += 1;

                            if !emit_pty_output(&app_handle, &session_id, valid_text) {
                                log::debug!("PTY output emit failed for session {}", session_id);
                                break 'reader_loop;
                            }

                            pending_utf8.clear();
                        }
                        Err(utf8_error) => {
                            let valid_up_to = utf8_error.valid_up_to();

                            if valid_up_to > 0 {
                                let valid_text =
                                    std::str::from_utf8(&pending_utf8[..valid_up_to]).unwrap();

                                if logged_chunk_count < 6 {
                                    log::info!(
                                        "PTY output chunk sid={} idx={} bytes={} preview={}",
                                        session_id,
                                        logged_chunk_count,
                                        valid_up_to,
                                        log_preview(valid_text)
                                    );
                                }
                                logged_chunk_count += 1;

                                if !emit_pty_output(&app_handle, &session_id, valid_text) {
                                    log::debug!("PTY output emit failed for session {}", session_id);
                                    break 'reader_loop;
                                }

                                pending_utf8.drain(0..valid_up_to);
                                continue;
                            }

                            if utf8_error.error_len().is_none() {
                                break;
                            }

                            pending_utf8.drain(0..1);
                            if logged_chunk_count < 6 {
                                log::info!(
                                    "PTY output chunk sid={} idx={} bytes={} preview=�",
                                    session_id,
                                    logged_chunk_count,
                                    1
                                );
                            }
                            logged_chunk_count += 1;

                            if !emit_pty_output(&app_handle, &session_id, "�") {
                                log::debug!("PTY output emit failed for session {}", session_id);
                                break 'reader_loop;
                            }
                        }
                    }
                }
            }
            Err(error) => {
                log::warn!("PTY reader error for session {}: {}", session_id, error);
                break;
            }
        }
    }

    let exit_status = match child.wait() {
        Ok(status) => {
            let status_text = format!("{:?}", status);
            log::info!("PTY child exited sid={} status={}", session_id, status_text);
            status_text
        }
        Err(error) => {
            let status_text = format!("wait_error: {}", error);
            log::warn!(
                "Failed waiting PTY child for session {}: {}",
                session_id,
                error
            );
            status_text
        }
    };

    emit_pty_exit(&app_handle, &session_id, &exit_status);

    if let Ok(mut map) = sessions.lock() {
        let should_remove = map
            .get(&session_id)
            .map(|session| session.token == token)
            .unwrap_or(false);

        if should_remove {
            map.remove(&session_id);
            log::info!("PTY session cleaned sid={}", session_id);
        }
    } else {
        log::warn!(
            "Failed to lock PTY session map while cleaning up {}",
            session_id
        );
    }
}

fn log_preview(data: &str) -> String {
    let compact = data
        .chars()
        .map(|ch| {
            if ch.is_control() {
                ' '
            } else {
                ch
            }
        })
        .collect::<String>();

    let trimmed = compact.split_whitespace().collect::<Vec<_>>().join(" ");
    trimmed.chars().take(160).collect::<String>()
}

fn claude_projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".claude").join("projects"))
}

fn encode_project_path(project_path: &str) -> String {
    project_path.replace('/', "-")
}

fn claude_session_file_path(project_path: &str, session_id: &str) -> Option<PathBuf> {
    let projects_dir = claude_projects_dir()?;
    let encoded_project = encode_project_path(project_path);
    Some(
        projects_dir
            .join(encoded_project)
            .join(format!("{}.jsonl", session_id)),
    )
}

fn validate_claude_resume_target(working_dir: &str, session_id: &str) -> Result<(), String> {
    let session_file_path = claude_session_file_path(working_dir, session_id)
        .ok_or_else(|| "Cannot resolve Claude projects directory".to_string())?;

    if session_file_path.exists() {
        return Ok(());
    }

    Err(format!(
        "Claude session file not found for resume target {} at {}",
        session_id,
        session_file_path.display()
    ))
}

fn build_runtime_path(existing_path: &str) -> String {
    let mut ordered_paths: Vec<String> = Vec::new();
    let mut seen = HashSet::new();

    let mut push_path = |candidate: String| {
        let trimmed = candidate.trim();
        if trimmed.is_empty() {
            return;
        }

        let normalized = trimmed.to_string();
        if seen.insert(normalized.clone()) {
            ordered_paths.push(normalized);
        }
    };

    for value in existing_path.split(':') {
        push_path(value.to_string());
    }

    for value in [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
        "/Library/Apple/usr/bin",
    ] {
        push_path(value.to_string());
    }

    if let Some(home) = dirs::home_dir() {
        for relative in [
            ".local/bin",
            ".npm-global/bin",
            "Library/pnpm",
            ".bun/bin",
            ".volta/bin",
            ".cargo/bin",
        ] {
            push_path(home.join(relative).to_string_lossy().to_string());
        }
    }

    if let Ok(npm_prefix) = std::env::var("npm_config_prefix") {
        push_path(
            PathBuf::from(npm_prefix)
                .join("bin")
                .to_string_lossy()
                .to_string(),
        );
    }

    if let Ok(pnpm_home) = std::env::var("PNPM_HOME") {
        push_path(pnpm_home);
    }

    ordered_paths.join(":")
}

fn validate_working_dir(working_dir: &str) -> Result<(), String> {
    if working_dir.is_empty() {
        return Err("Working directory cannot be empty".to_string());
    }

    let path = Path::new(working_dir);
    if !path.exists() {
        return Err(format!("Working directory does not exist: {}", working_dir));
    }

    if !path.is_dir() {
        return Err(format!(
            "Working directory is not a directory: {}",
            working_dir
        ));
    }

    Ok(())
}

fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }

    format!("'{}'", value.replace('\'', "'\\''"))
}
