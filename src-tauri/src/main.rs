// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod utils;

use services::pty_service::PtyManager;
use services::{ProjectService, SessionService};

pub struct AppState {
    pub project_service: ProjectService,
    pub session_service: SessionService,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            project_service: ProjectService::new(),
            session_service: SessionService::new(),
        })
        .manage(PtyManager::new())
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
            commands::terminal::run_session_command,
            commands::pty::create_pty,
            commands::pty::write_pty,
            commands::pty::resize_pty,
            commands::pty::close_pty,
            commands::pty::close_all_ptys,
            commands::claude_session::list_claude_sessions,
            commands::claude_session::list_claude_projects,
            commands::claude_session::delete_claude_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
