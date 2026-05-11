pub mod commands;
pub mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::config_load,
            commands::config::config_save,
            commands::vaults::vault_add,
            commands::vaults::vault_remove,
            commands::vaults::vault_update,
            commands::vaults::vault_pick_directory,
            commands::vaults::vault_create,
            commands::vaults::vault_create_sample,
            commands::vaults::vault_clone_git,
            commands::files::file_read,
            commands::files::file_write,
            commands::files::file_create,
            commands::files::file_delete,
            commands::files::file_rename,
            commands::files::folder_create,
            commands::files::folder_delete,
            commands::files::vault_scan,
            commands::files::file_duplicate,
            commands::files::file_reveal_in_finder,
            commands::files::url_open,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
