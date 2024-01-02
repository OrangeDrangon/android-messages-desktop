// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, Menu, MenuItem, Runtime, Submenu, SystemTray, SystemTrayEvent,
    SystemTrayMenu, SystemTrayMenuItem, WindowEvent,
};

const MAIN_WINDOW: &str = "main";

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show Window"))
        .add_item(CustomMenuItem::new("quit", "Quit"));
    let system_tray = SystemTray::new().with_menu(tray_menu);
    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::DoubleClick { .. } => {
                app.get_window(MAIN_WINDOW).unwrap().show().unwrap();
            }
            SystemTrayEvent::MenuItemClick { tray_id, id, .. } => match id.as_str() {
                "show" => {
                    let main = app.get_window("main").unwrap();
                    main.show().unwrap();
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_page_load(|window, payload| {})
        .on_window_event(|event| match event.event() {
            WindowEvent::CloseRequested { api, .. } => {
                let window = event.window();
                if window.label() == MAIN_WINDOW {
                    api.prevent_close();
                    event.window().hide().expect("Failed to hide window");
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => api.prevent_exit(),
            _ => {}
        });
}
