use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::models::UserSettings;

const SETTINGS_FILE_NAME: &str = "settings.json";

/// Resolve the on-disk path for the Markhub user settings file via Tauri's
/// platform-aware `app_config_dir` (e.g. `~/Library/Application Support/com.kodyo.markhub/`).
///
/// This lives next to `config.json` but is a separate file by design — it
/// is what the user exports/imports in the Advanced section (STEP 6).
pub fn resolve_settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(SETTINGS_FILE_NAME))
        .map_err(|e| format!("Cannot resolve app config dir: {e}"))
}

#[tauri::command]
pub fn settings_read(app: AppHandle) -> Result<UserSettings, String> {
    let path = resolve_settings_path(&app)?;
    Ok(load_settings_from_path(&path))
}

#[tauri::command]
pub fn settings_write(app: AppHandle, settings: UserSettings) -> Result<(), String> {
    let path = resolve_settings_path(&app)?;
    save_settings_to_path(&path, &settings)
}

/// Return the app version baked into the binary at compile time. Used by
/// the Settings → Advanced section to display "Markhub vX.Y.Z".
#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Reveal the user config directory in the OS file explorer (Finder on
/// macOS). Creates the directory if it doesn't exist yet so the open
/// call doesn't fail on a fresh install. Read-only operation.
#[tauri::command]
pub fn settings_config_folder_reveal(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Cannot resolve app config dir: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create config dir: {e}"))?;
    }
    let dir_str = dir
        .to_str()
        .ok_or_else(|| "Config dir path is not valid UTF-8".to_string())?;
    std::process::Command::new("open")
        .arg(dir_str)
        .spawn()
        .map_err(|e| format!("Failed to open config folder: {e}"))?;
    Ok(())
}

/// Export the supplied settings to an arbitrary path on disk (user picks
/// the destination via the native save dialog on the front-end). Reuses
/// the atomic-write path so a partial write can never leave a truncated
/// JSON behind.
#[tauri::command]
pub fn settings_export(target_path: String, settings: UserSettings) -> Result<(), String> {
    let path = Path::new(&target_path);
    save_settings_to_path(path, &settings)
}

/// Import settings from an arbitrary path. Strict: unlike
/// `load_settings_from_path` (which silently falls back to defaults on a
/// corrupt file), this surfaces errors so the user sees what failed.
#[tauri::command]
pub fn settings_import(source_path: String) -> Result<UserSettings, String> {
    let path = Path::new(&source_path);
    if !path.exists() {
        return Err(format!("File not found: {source_path}"));
    }
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {source_path}: {e}"))?;
    serde_json::from_str::<UserSettings>(&raw)
        .map_err(|e| format!("Invalid settings JSON: {e}"))
}

/// Load user settings from `path`.
///
/// Resilience policy (intentional: settings should NEVER block the app):
/// - Missing file → return defaults (silent; the file will be written on the
///   first user change).
/// - Unreadable file (permission denied, etc.) → return defaults, log a
///   warning. We do not surface the error to the user-visible result because
///   we want the app to keep running with sensible defaults.
/// - Malformed JSON → return defaults, log a warning, and back up the broken
///   file to `<path>.bak` so the user can recover it from the config folder.
pub fn load_settings_from_path(path: &Path) -> UserSettings {
    if !path.exists() {
        return UserSettings::default();
    }
    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            log::warn!(
                "settings: failed to read {} ({e}) — falling back to defaults",
                path.display()
            );
            return UserSettings::default();
        }
    };
    match serde_json::from_str::<UserSettings>(&raw) {
        Ok(s) => s,
        Err(e) => {
            log::warn!(
                "settings: malformed JSON at {} ({e}) — backing up to .bak and falling back to defaults",
                path.display()
            );
            backup_corrupted_settings(path, &raw);
            UserSettings::default()
        }
    }
}

/// Best-effort backup: ignore errors. The point is to give the user a chance
/// to recover their old prefs from the config folder; if the backup fails too,
/// the next `save_settings_to_path` will overwrite the broken JSON anyway.
fn backup_corrupted_settings(path: &Path, raw: &str) {
    let bak = path.with_extension("json.bak");
    if let Err(e) = fs::write(&bak, raw) {
        log::warn!("settings: failed to write .bak backup ({e})");
    }
}

/// Persist `settings` to `path` atomically.
///
/// Atomicity: write to `<path>.tmp` then rename to `<path>`. `fs::rename`
/// is atomic on POSIX (same filesystem), which is what we want — a partial
/// write or a power-loss mid-flush can never leave the user with a
/// half-written settings.json that fails to parse next boot.
pub fn save_settings_to_path(path: &Path, settings: &UserSettings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed to create settings parent directory {}: {e}",
                    parent.display()
                )
            })?;
        }
    }
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json)
        .map_err(|e| format!("Failed to write settings tmp file {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| {
        // Cleanup: don't leave a stray .tmp file lying around if rename fails.
        let _ = fs::remove_file(&tmp);
        format!(
            "Failed to atomically install settings at {}: {e}",
            path.display()
        )
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::UserSettings;
    use tempfile::TempDir;

    fn temp_settings_path() -> (TempDir, PathBuf) {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("settings.json");
        (dir, path)
    }

    // ------ S1.1 — load returns defaults when file is missing ------
    #[test]
    fn load_returns_defaults_when_file_is_missing() {
        let (_g, path) = temp_settings_path();
        assert!(!path.exists());
        let s = load_settings_from_path(&path);
        assert_eq!(s, UserSettings::default());
    }

    // ------ S1.2 — save then load round-trips identically ------
    #[test]
    fn save_then_load_round_trips() {
        let (_g, path) = temp_settings_path();
        let mut s = UserSettings::default();
        s.appearance.theme = "dark".to_string();
        s.appearance.editor_font_size = 18;
        s.appearance.editor_line_height = 1.75;
        s.editor.autosave_delay_ms = 3000;
        s.editor.spell_check = false;
        s.source.mono_font = "fira-code".to_string();
        s.files.confirm_delete = false;

        save_settings_to_path(&path, &s).expect("save ok");
        let loaded = load_settings_from_path(&path);
        assert_eq!(loaded, s);
    }

    // ------ S1.3 — save creates parent directories if missing ------
    #[test]
    fn save_creates_parent_directory_if_missing() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("a").join("b").join("settings.json");
        assert!(!nested.parent().unwrap().exists());
        save_settings_to_path(&nested, &UserSettings::default()).expect("save creates dirs");
        assert!(nested.exists());
    }

    // ------ S1.4 — save is atomic (no .tmp leftover after success) ------
    #[test]
    fn save_leaves_no_tmp_file_behind_on_success() {
        let (_g, path) = temp_settings_path();
        save_settings_to_path(&path, &UserSettings::default()).unwrap();
        let tmp = path.with_extension("json.tmp");
        assert!(!tmp.exists(), "atomic install must clean up .tmp");
        assert!(path.exists());
    }

    // ------ S1.5 — malformed JSON falls back to defaults and creates .bak ------
    #[test]
    fn load_falls_back_to_defaults_on_malformed_json() {
        let (_g, path) = temp_settings_path();
        fs::write(&path, "{ not valid json at all").unwrap();
        let s = load_settings_from_path(&path);
        assert_eq!(s, UserSettings::default());

        // The broken file should have been backed up so the user can recover.
        let bak = path.with_extension("json.bak");
        assert!(bak.exists(), "corrupted settings must be backed up to .bak");
        let bak_raw = fs::read_to_string(&bak).unwrap();
        assert_eq!(bak_raw, "{ not valid json at all");
    }

    // ------ S1.6 — overwrite replaces previous content atomically ------
    #[test]
    fn save_overwrites_existing_file_atomically() {
        let (_g, path) = temp_settings_path();
        let mut s1 = UserSettings::default();
        s1.appearance.editor_font_size = 14;
        save_settings_to_path(&path, &s1).unwrap();

        let mut s2 = UserSettings::default();
        s2.appearance.editor_font_size = 20;
        save_settings_to_path(&path, &s2).unwrap();

        let loaded = load_settings_from_path(&path);
        assert_eq!(loaded.appearance.editor_font_size, 20);

        // No tmp file remaining either.
        let tmp = path.with_extension("json.tmp");
        assert!(!tmp.exists());
    }

    // ------ S1.7 — defaults match the documented schema ------
    #[test]
    fn defaults_match_documented_schema() {
        let s = UserSettings::default();
        assert_eq!(s.version, 1);
        assert_eq!(s.appearance.theme, "system");
        assert_eq!(s.appearance.editor_font, "geist");
        assert_eq!(s.appearance.editor_font_size, 16);
        assert!((s.appearance.editor_line_height - 1.6).abs() < f64::EPSILON);
        assert_eq!(s.appearance.editor_content_width, 720);
        assert_eq!(s.editor.autosave_delay_ms, 1500);
        assert!(s.editor.spell_check);
        assert_eq!(s.source.mono_font, "geist-mono");
        assert!(s.files.confirm_delete);
    }

    // ------ S6.1 — settings_export writes a valid JSON file ------
    #[test]
    fn export_writes_valid_settings_json() {
        let (_g, path) = temp_settings_path();
        let mut s = UserSettings::default();
        s.appearance.editor_font_size = 19;
        let path_str = path.to_str().unwrap().to_string();
        super::settings_export(path_str.clone(), s.clone()).expect("export ok");
        assert!(path.exists());
        let loaded = load_settings_from_path(&path);
        assert_eq!(loaded, s);
    }

    // ------ S6.2 — settings_import round-trips an exported file ------
    #[test]
    fn import_round_trips_an_exported_file() {
        let (_g, path) = temp_settings_path();
        let mut s = UserSettings::default();
        s.editor.autosave_delay_ms = 2500;
        s.source.mono_font = "jetbrains-mono".to_string();
        save_settings_to_path(&path, &s).unwrap();
        let imported = super::settings_import(path.to_str().unwrap().to_string())
            .expect("import ok");
        assert_eq!(imported, s);
    }

    // ------ S6.3 — settings_import rejects a non-existent file ------
    #[test]
    fn import_rejects_missing_file() {
        let dir = TempDir::new().unwrap();
        let missing = dir.path().join("not-here.json");
        let err = super::settings_import(missing.to_str().unwrap().to_string())
            .expect_err("must error on missing file");
        assert!(err.contains("not found") || err.contains("File not found"));
    }

    // ------ S6.4 — settings_import surfaces JSON errors (strict mode) ------
    #[test]
    fn import_rejects_malformed_json() {
        let (_g, path) = temp_settings_path();
        fs::write(&path, "{ this is not settings json").unwrap();
        let err = super::settings_import(path.to_str().unwrap().to_string())
            .expect_err("must error on malformed JSON");
        assert!(err.contains("Invalid settings JSON"));
    }

    // ------ S6.5 — app_version is the Cargo.toml package version ------
    #[test]
    fn app_version_matches_cargo_pkg() {
        let v = super::app_version();
        assert_eq!(v, env!("CARGO_PKG_VERSION"));
    }

    // ------ S1.8 — JSON keys are camelCase (frontend contract) ------
    #[test]
    fn json_keys_are_camel_case() {
        let s = UserSettings::default();
        let json = serde_json::to_string_pretty(&s).unwrap();
        // A handful of representative keys — if these are right, serde's
        // rename_all = "camelCase" is wired correctly throughout.
        assert!(json.contains("\"editorFontSize\""));
        assert!(json.contains("\"editorLineHeight\""));
        assert!(json.contains("\"editorContentWidth\""));
        assert!(json.contains("\"autosaveDelayMs\""));
        assert!(json.contains("\"spellCheck\""));
        assert!(json.contains("\"monoFont\""));
        assert!(json.contains("\"confirmDelete\""));
        // And NOT snake_case leaks.
        assert!(!json.contains("editor_font_size"));
        assert!(!json.contains("autosave_delay_ms"));
    }
}
