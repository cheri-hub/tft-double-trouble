#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    double_trouble_tft_lib::run();
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! Welcome to Double Trouble TFT.")
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
