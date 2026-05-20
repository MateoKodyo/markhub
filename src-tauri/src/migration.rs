//! One-shot data-directory migration for the 2026-05-20 rename
//! Markhub → Markus.
//!
//! The Tauri bundle identifier changed from `com.kodyo.markhub` to
//! `com.kodyo.markus`. Tauri derives the platform config directory from
//! the identifier (`~/Library/Application Support/<identifier>/` on
//! macOS), so an existing user's `config.json`, `settings.json` and
//! `frontmatter-state.json` would be orphaned in the old directory.
//!
//! Strategy: on startup, for each known data file, if it is absent from
//! the new directory but present in the legacy `com.kodyo.markhub`
//! sibling directory, copy it over. Idempotent — once the new files
//! exist the migration is a no-op. It never fails the app boot: any
//! error is logged and swallowed.

use std::fs;

use tauri::{AppHandle, Manager};

const DATA_FILES: [&str; 3] = ["config.json", "settings.json", "frontmatter-state.json"];
const LEGACY_IDENTIFIER: &str = "com.kodyo.markhub";

/// Copy legacy `com.kodyo.markhub` data files into the new
/// `com.kodyo.markus` config directory if they haven't been migrated yet.
pub fn migrate_legacy_data_dir(app: &AppHandle) {
    let new_dir = match app.path().app_config_dir() {
        Ok(dir) => dir,
        Err(e) => {
            log::warn!("[migration] cannot resolve app_config_dir: {e}");
            return;
        }
    };

    // The legacy dir is a sibling of the new one (same parent
    // `Application Support/`, different identifier folder name).
    let Some(parent) = new_dir.parent() else {
        return;
    };
    let old_dir = parent.join(LEGACY_IDENTIFIER);
    if !old_dir.is_dir() {
        // No legacy data — fresh install, or already migrated.
        return;
    }

    for file in DATA_FILES {
        let new_path = new_dir.join(file);
        let old_path = old_dir.join(file);
        if new_path.exists() || !old_path.exists() {
            continue;
        }
        if let Err(e) = fs::create_dir_all(&new_dir) {
            log::warn!("[migration] cannot create new data dir: {e}");
            return;
        }
        match fs::copy(&old_path, &new_path) {
            Ok(_) => log::info!("[migration] copied {file} from legacy data dir"),
            Err(e) => log::warn!("[migration] failed to copy {file}: {e}"),
        }
    }
}
