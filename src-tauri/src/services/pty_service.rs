use std::collections::HashMap;
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

    fn launch_script(&self, fallback_session_id: &str, working_dir: &str) -> Option<String> {
        if self.mode == PtyLaunchMode::Plain {
            return None;
        }

        let resume_id = self
            .resume_session_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(fallback_session_id);

        let mut claude_command_parts = vec![String::from("claude")];

        for arg in self
            .claude_args
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            claude_command_parts.push(shell_quote(arg));
        }

        claude_command_parts.push(String::from("-r"));
        claude_command_parts.push(shell_quote(resume_id));

        let claude_command = claude_command_parts.join(" ");

        let tmux_session_name = tmux_session_name(resume_id);
        let tmux_session_name_quoted = shell_quote(&tmux_session_name);
        let working_dir_quoted = shell_quote(working_dir);
        let claude_command_quoted = shell_quote(&claude_command);

        Some(format!(
            r#"if command -v tmux >/dev/null 2>&1; then tmux kill-session -t {tmux_session_name_quoted} >/dev/null 2>&1; tmux new-session -d -s {tmux_session_name_quoted} -c {working_dir_quoted} {claude_command_quoted}; tmux set-option -q -t {tmux_session_name_quoted} status off >/dev/null 2>&1; exec tmux attach-session -t {tmux_session_name_quoted} || exec {claude_command}; else exec {claude_command}; fi"#
        ))
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

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let launch_script =
            launch_config.launch_script(normalized_session_id, normalized_working_dir);

        if let Some(script) = launch_script.as_ref() {
            log::debug!(
                "PTY launch script sid={} preview={}",
                normalized_session_id,
                log_preview(script)
            );
        }

        let mut cmd = CommandBuilder::new(&shell);
        if let Some(script) = launch_script {
            cmd.arg("-lc");
            cmd.arg(script);
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


fn reader_thread(
    session_id: String,
    token: String,
    mut reader: Box<dyn Read + Send>,
    mut child: Box<dyn portable_pty::Child + Send + Sync>,
    app_handle: tauri::AppHandle,
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
) {
    let mut buf = [0u8; 4096];
    let mut logged_chunk_count: usize = 0;

    loop {
        match reader.read(&mut buf) {
            Ok(0) => {
                log::info!("PTY stream reached EOF sid={}", session_id);
                break;
            }
            Ok(n) => {
                let data = String::from_utf8_lossy(&buf[..n]).to_string();

                if logged_chunk_count < 6 {
                    log::info!(
                        "PTY output chunk sid={} idx={} bytes={} preview={}",
                        session_id,
                        logged_chunk_count,
                        n,
                        log_preview(&data)
                    );
                }
                logged_chunk_count += 1;

                if !emit_pty_output(&app_handle, &session_id, &data) {
                    log::debug!("PTY output emit failed for session {}", session_id);
                    break;
                }
            }
            Err(error) => {
                log::warn!("PTY reader error for session {}: {}", session_id, error);
                break;
            }
        }
    }

    match child.wait() {
        Ok(status) => {
            log::info!("PTY child exited sid={} status={:?}", session_id, status);
        }
        Err(error) => {
            log::warn!(
                "Failed waiting PTY child for session {}: {}",
                session_id,
                error
            );
        }
    }

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

fn tmux_session_name(session_id: &str) -> String {
    let sanitized: String = session_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();

    let trimmed = sanitized.trim_matches('_');
    let fallback = if trimmed.is_empty() {
        "session"
    } else {
        trimmed
    };
    let limited: String = fallback.chars().take(48).collect();

    format!("ccsm_{}", limited)
}
