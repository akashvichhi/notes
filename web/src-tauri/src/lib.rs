mod keychain;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            keychain::save_token,
            keychain::load_token,
            keychain::delete_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Notes application");
}


