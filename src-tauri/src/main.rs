// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;

use services::pty_service::PtyManager;
use services::{ProjectService, SessionService, SettingsService};

#[cfg(target_os = "macos")]
use services::StorageService;
#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "macos")]
use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem};
#[cfg(target_os = "macos")]
use tauri::{Emitter, Manager};

#[cfg(target_os = "macos")]
const MENU_OPEN_SETTINGS_ID: &str = "open_settings";
#[cfg(target_os = "macos")]
const MENU_OPEN_CONFIG_FILE_ID: &str = "open_config_file";
#[cfg(target_os = "macos")]
const MENU_RELOAD_CONFIG_ID: &str = "reload_config";
#[cfg(target_os = "macos")]
const EVENT_OPEN_SETTINGS: &str = "open-settings";
#[cfg(target_os = "macos")]
const EVENT_RELOAD_SETTINGS: &str = "reload-settings";

pub struct AppState {
    pub project_service: ProjectService,
    pub session_service: SessionService,
    pub settings_service: SettingsService,
}

#[cfg(target_os = "macos")]
fn emit_to_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>, event_name: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit(event_name, ());
    }
}

#[cfg(target_os = "macos")]
fn open_preferences_file_with_default_app() -> Result<(), String> {
    let config_path = StorageService::preferences_file();

    Command::new("open")
        .arg(&config_path)
        .spawn()
        .map_err(|error| {
            format!(
                "Failed to open config file {}: {}",
                config_path.display(),
                error
            )
        })?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn build_app_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;

    let app_submenu = menu.items()?.into_iter().find_map(|item| match item {
        MenuItemKind::Submenu(submenu) => Some(submenu),
        _ => None,
    });

    if let Some(submenu) = app_submenu {
        let settings_item = MenuItem::with_id(
            app,
            MENU_OPEN_SETTINGS_ID,
            "Settings…",
            true,
            Some("CmdOrCtrl+,"),
        )?;
        let open_config_item = MenuItem::with_id(
            app,
            MENU_OPEN_CONFIG_FILE_ID,
            "Open Config File",
            true,
            Option::<&str>::None,
        )?;
        let reload_config_item = MenuItem::with_id(
            app,
            MENU_RELOAD_CONFIG_ID,
            "Reload Config",
            true,
            Option::<&str>::None,
        )?;
        let separator = PredefinedMenuItem::separator(app)?;

        submenu.insert_items(
            &[
                &settings_item,
                &open_config_item,
                &reload_config_item,
                &separator,
            ],
            2,
        )?;
    }

    Ok(menu)
}

fn main() {
    let _ = env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info"),
    )
    .format_timestamp_millis()
    .try_init();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            project_service: ProjectService::new(),
            session_service: SessionService::new(),
            settings_service: SettingsService::new(),
        })
        .manage(PtyManager::new());

    #[cfg(target_os = "macos")]
    let builder =
        builder
            .menu(build_app_menu)
            .on_menu_event(|app, event| match event.id().as_ref() {
                MENU_OPEN_SETTINGS_ID => emit_to_main_window(app, EVENT_OPEN_SETTINGS),
                MENU_OPEN_CONFIG_FILE_ID => {
                    if let Err(error) = open_preferences_file_with_default_app() {
                        log::warn!("{}", error);
                    }
                }
                MENU_RELOAD_CONFIG_ID => emit_to_main_window(app, EVENT_RELOAD_SETTINGS),
                _ => {}
            });

    builder
        .invoke_handler(tauri::generate_handler![
            commands::project::pick_project_folder,
            commands::project::create_project,
            commands::project::list_projects,
            commands::project::get_project,
            commands::project::update_project,
            commands::project::delete_project,
            commands::project::toggle_favorite,
            commands::session::create_session,
            commands::session::list_sessions_for_project,
            commands::session::list_sessions,
            commands::session::get_session,
            commands::session::update_session,
            commands::session::delete_session,
            commands::session::add_command_history,
            commands::session::clear_command_history,
            commands::terminal::get_available_terminals,
            commands::terminal::set_default_terminal,
            commands::terminal::open_session_in_terminal,
            commands::terminal::open_session_with_command,
            commands::terminal::open_project_in_terminal,
            commands::terminal::run_session_command,
            commands::pty::create_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
            commands::pty::close_pty,
            commands::pty::close_all_ptys,
            commands::claude_session::list_claude_sessions,
            commands::claude_session::list_claude_projects,
            commands::claude_session::rename_claude_session,
            commands::claude_session::delete_claude_session,
            commands::settings::get_app_settings,
            commands::settings::set_app_settings,
            commands::system::open_external_url,
            commands::system::get_available_editors,
            commands::system::open_project_in_editor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
