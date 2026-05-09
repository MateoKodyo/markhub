use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::models::Config;

const CONFIG_FILE_NAME: &str = "config.json";

/// Resolve the on-disk path for the Markhub config file via Tauri's
/// platform-aware `app_config_dir` (e.g. `~/Library/Application Support/com.kodyo.markhub/`).
pub fn resolve_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(CONFIG_FILE_NAME))
        .map_err(|e| format!("Cannot resolve app config dir: {e}"))
}

#[tauri::command]
pub fn config_load(app: AppHandle) -> Result<Config, String> {
    let path = resolve_config_path(&app)?;
    load_config_from_path(&path)
}

#[tauri::command]
pub fn config_save(app: AppHandle, config: Config) -> Result<(), String> {
    let path = resolve_config_path(&app)?;
    save_config_to_path(&path, &config)
}

/// Load the config from `path`. Returns `Config::default()` if the file is missing.
/// Returns a readable error string if the file exists but cannot be parsed.
pub fn load_config_from_path(path: &Path) -> Result<Config, String> {
    if !path.exists() {
        return Ok(Config::default());
    }
    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read config file at {}: {e}", path.display()))?;
    serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse config JSON at {}: {e}", path.display()))
}

/// Persist `config` to `path`, creating parent directories as needed.
/// Writes pretty-printed JSON with 2-space indentation (serde_json default).
pub fn save_config_to_path(path: &Path, config: &Config) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed to create config parent directory {}: {e}",
                    parent.display()
                )
            })?;
        }
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(path, json)
        .map_err(|e| format!("Failed to write config file at {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Config, LastOpenedFile, Vault, VaultMode};
    use tempfile::TempDir;

    fn temp_config_path() -> (TempDir, std::path::PathBuf) {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("config.json");
        (dir, path)
    }

    // ------ A2.1 — load returns default when file missing ------
    #[test]
    fn load_returns_default_when_file_is_missing() {
        let (_guard, path) = temp_config_path();
        assert!(!path.exists());
        let cfg = load_config_from_path(&path).expect("default load");
        assert_eq!(cfg, Config::default());
    }

    // ------ A2.2 — load reads an existing file ------
    #[test]
    fn load_reads_existing_file() {
        let (_guard, path) = temp_config_path();
        let cfg = Config::default();
        save_config_to_path(&path, &cfg).unwrap();
        let loaded = load_config_from_path(&path).unwrap();
        assert_eq!(loaded, cfg);
    }

    // ------ A2.3 — corrupt JSON => readable error, no panic ------
    #[test]
    fn load_returns_readable_error_on_corrupt_json() {
        let (_guard, path) = temp_config_path();
        std::fs::write(&path, "{ not valid json").unwrap();
        let result = load_config_from_path(&path);
        assert!(result.is_err(), "corrupt JSON must return Err");
        let msg = result.err().unwrap();
        assert!(!msg.is_empty(), "error message must not be empty");
    }

    // ------ A2.4 — save creates parent dirs if missing ------
    #[test]
    fn save_creates_parent_directory_if_missing() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("a").join("b").join("c").join("config.json");
        assert!(!nested.parent().unwrap().exists());
        save_config_to_path(&nested, &Config::default()).expect("save creates dirs");
        assert!(nested.exists(), "config.json must be created");
    }

    // ------ A2.5 — save writes 2-space indented JSON ------
    #[test]
    fn save_writes_two_space_indented_json() {
        let (_guard, path) = temp_config_path();
        save_config_to_path(&path, &Config::default()).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        let expected = "{\n  \"version\": 1,\n  \"vaults\": [],\n  \"lastOpenedFile\": null,\n  \"settings\": {\n    \"autoSaveDelayMs\": 1500,\n    \"theme\": \"system\"\n  },\n  \"vaultStates\": {}\n}";
        assert_eq!(raw, expected);
    }

    // ------ A2.7 — round-trip with vaultStates non-empty ------
    #[test]
    fn round_trip_with_populated_vault_states() {
        let (_guard, path) = temp_config_path();
        let mut cfg = Config::default();
        cfg.vault_states.insert(
            "vault-id-1".to_string(),
            crate::models::VaultState {
                expanded_folders: vec!["a".to_string(), "a/b".to_string()],
            },
        );
        save_config_to_path(&path, &cfg).unwrap();
        let loaded = load_config_from_path(&path).unwrap();
        assert_eq!(loaded, cfg);
    }

    // ------ A2.6 — save then load round-trips identically ------
    #[test]
    fn save_then_load_round_trips() {
        let (_guard, path) = temp_config_path();
        let mut cfg = Config::default();
        cfg.vaults.push(Vault {
            id: "fixed-id-for-test".to_string(),
            name: "Notes".to_string(),
            path: "/tmp/notes".to_string(),
            mode: VaultMode::Edit,
            color: "#7C3AED".to_string(),
        });
        cfg.last_opened_file = Some(LastOpenedFile {
            vault_id: "fixed-id-for-test".to_string(),
            relative_path: "subdir/note.md".to_string(),
        });

        save_config_to_path(&path, &cfg).unwrap();
        let loaded = load_config_from_path(&path).unwrap();
        assert_eq!(loaded, cfg);
    }
}
