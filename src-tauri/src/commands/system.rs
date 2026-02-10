use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

fn is_allowed_url_scheme(url: &str) -> bool {
    url.starts_with("https://") || url.starts_with("http://") || url.starts_with("mailto:")
}

fn app_exists(paths: &[&str]) -> bool {
    paths.iter().any(|path| Path::new(path).exists())
}

fn command_exists(command: &str) -> bool {
    let normalized = command.trim();
    if normalized.is_empty() || normalized.contains(char::is_whitespace) {
        return false;
    }

    Command::new("which")
        .arg(normalized)
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn normalize_existing_directory_path(path: &str) -> Result<String, String> {
    let normalized = path.trim();
    if normalized.is_empty() {
        return Err("Project path cannot be empty".to_string());
    }

    let candidate = Path::new(normalized);
    if !candidate.exists() {
        return Err(format!("Project path does not exist: {}", normalized));
    }

    if !candidate.is_dir() {
        return Err(format!("Project path is not a directory: {}", normalized));
    }

    Ok(normalized.to_string())
}

fn detect_available_editors() -> Vec<String> {
    let mut editors = Vec::new();

    if app_exists(&["/Applications/Visual Studio Code.app"]) || command_exists("code") {
        editors.push("VSCode".to_string());
    }

    if app_exists(&["/Applications/Cursor.app"]) || command_exists("cursor") {
        editors.push("Cursor".to_string());
    }

    if app_exists(&["/Applications/Windsurf.app"]) || command_exists("windsurf") {
        editors.push("Windsurf".to_string());
    }

    if app_exists(&["/Applications/Zed.app"]) || command_exists("zed") {
        editors.push("Zed".to_string());
    }

    if app_exists(&["/Applications/Sublime Text.app"]) || command_exists("subl") {
        editors.push("Sublime Text".to_string());
    }

    if editors.is_empty() {
        editors.push("VSCode".to_string());
    }

    editors
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_external_url(url: String) -> Result<(), String> {
    let normalized = url.trim();

    if normalized.is_empty() {
        return Err("URL is empty".to_string());
    }

    if !is_allowed_url_scheme(normalized) {
        return Err(format!("Unsupported URL scheme: {}", normalized));
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(normalized)
            .spawn()
            .map_err(|error| format!("Failed to open URL: {}", error))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", normalized])
            .spawn()
            .map_err(|error| format!("Failed to open URL: {}", error))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(normalized)
            .spawn()
            .map_err(|error| format!("Failed to open URL: {}", error))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform for opening URL".to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub fn get_available_editors() -> Result<HashMap<String, String>, String> {
    let editors = detect_available_editors();

    let mut mapped = HashMap::new();
    for editor in editors {
        mapped.insert(editor.clone(), editor);
    }

    Ok(mapped)
}

#[tauri::command(rename_all = "snake_case")]
pub fn open_project_in_editor(
    project_path: String,
    editor_app: Option<String>,
) -> Result<(), String> {
    let normalized_path = normalize_existing_directory_path(&project_path)?;

    let selected_editor = editor_app
        .unwrap_or_else(|| "VSCode".to_string())
        .trim()
        .to_string();

    if selected_editor.is_empty() {
        return Err("Editor cannot be empty".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let result = match selected_editor.as_str() {
            "VSCode" => {
                if command_exists("code") {
                    Command::new("code").arg(&normalized_path).spawn()
                } else {
                    Command::new("open")
                        .args(["-a", "Visual Studio Code", &normalized_path])
                        .spawn()
                }
            }
            "Cursor" => {
                if command_exists("cursor") {
                    Command::new("cursor").arg(&normalized_path).spawn()
                } else {
                    Command::new("open")
                        .args(["-a", "Cursor", &normalized_path])
                        .spawn()
                }
            }
            "Windsurf" => {
                if command_exists("windsurf") {
                    Command::new("windsurf").arg(&normalized_path).spawn()
                } else {
                    Command::new("open")
                        .args(["-a", "Windsurf", &normalized_path])
                        .spawn()
                }
            }
            "Zed" => {
                if command_exists("zed") {
                    Command::new("zed").arg(&normalized_path).spawn()
                } else {
                    Command::new("open")
                        .args(["-a", "Zed", &normalized_path])
                        .spawn()
                }
            }
            "Sublime Text" => {
                if command_exists("subl") {
                    Command::new("subl").arg(&normalized_path).spawn()
                } else {
                    Command::new("open")
                        .args(["-a", "Sublime Text", &normalized_path])
                        .spawn()
                }
            }
            _ => return Err(format!("Unknown editor: {}", selected_editor)),
        };

        result
            .map_err(|error| format!("Failed to open project in {}: {}", selected_editor, error))?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &normalized_path])
            .spawn()
            .map_err(|error| format!("Failed to open project in editor: {}", error))?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&normalized_path)
            .spawn()
            .map_err(|error| format!("Failed to open project in editor: {}", error))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform for opening editor".to_string())
}
