#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::Manager;

const SETTINGS_FILE: &str = "window-settings.json";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowSettings {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    expanded: bool,
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            x: 24,
            y: 24,
            width: 320,
            height: 420,
            expanded: false,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|directory| directory.join(SETTINGS_FILE))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_window_settings(app: tauri::AppHandle) -> Result<WindowSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(WindowSettings::default());
    }

    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_window_settings(
    app: tauri::AppHandle,
    settings: WindowSettings,
) -> Result<(), String> {
    let path = settings_path(&app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "window settings path has no parent directory".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    let contents = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_window_settings,
            save_window_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
