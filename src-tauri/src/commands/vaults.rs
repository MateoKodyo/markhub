use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::config;
use crate::models::{Config, Vault, VaultMode};

/// Add a vault entry to the config. Validates that the path exists and is a directory.
/// Returns the newly created Vault. `color` is provided by the caller.
pub fn add_vault(
    config: &mut Config,
    name: String,
    path: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    if !p.is_dir() {
        return Err(format!("Path is not a directory: {path}"));
    }
    let vault = Vault::new(name, path, mode, color);
    config.vaults.push(vault.clone());
    Ok(vault)
}

/// Remove a vault by id. Returns Err if id is not present.
pub fn remove_vault(config: &mut Config, id: &str) -> Result<(), String> {
    let pos = config
        .vaults
        .iter()
        .position(|v| v.id == id)
        .ok_or_else(|| format!("Vault not found: {id}"))?;
    config.vaults.remove(pos);
    Ok(())
}

/// Update name and/or mode of an existing vault. Untouched fields stay intact.
pub fn update_vault(
    config: &mut Config,
    id: &str,
    name: Option<String>,
    mode: Option<VaultMode>,
) -> Result<Vault, String> {
    let v = config
        .vaults
        .iter_mut()
        .find(|v| v.id == id)
        .ok_or_else(|| format!("Vault not found: {id}"))?;
    if let Some(n) = name {
        v.name = n;
    }
    if let Some(m) = mode {
        v.mode = m;
    }
    Ok(v.clone())
}

// ============================================================
// Tauri command wrappers — load config, mutate, save back.
// ============================================================

#[tauri::command]
pub fn vault_add(
    app: AppHandle,
    name: String,
    path: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    let vault = add_vault(&mut cfg, name, path, mode, color)?;
    config::save_config_to_path(&cfg_path, &cfg)?;
    Ok(vault)
}

#[tauri::command]
pub fn vault_remove(app: AppHandle, id: String) -> Result<(), String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    remove_vault(&mut cfg, &id)?;
    config::save_config_to_path(&cfg_path, &cfg)
}

#[tauri::command]
pub fn vault_update(
    app: AppHandle,
    id: String,
    name: Option<String>,
    mode: Option<VaultMode>,
) -> Result<Vault, String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    let updated = update_vault(&mut cfg, &id, name, mode)?;
    config::save_config_to_path(&cfg_path, &cfg)?;
    Ok(updated)
}

#[tauri::command]
pub async fn vault_pick_directory(app: AppHandle) -> Result<Option<String>, String> {
    // MUST be async — `blocking_pick_folder` would deadlock the macOS main thread
    // (the dialog itself runs on the main thread, the caller would wait on it).
    // Marking the command async makes Tauri run it on a tokio worker.
    let picked = app.dialog().file().blocking_pick_folder();
    Ok(picked.map(|fp| fp.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn fixture_config() -> Config {
        Config::default()
    }

    fn vault_dir() -> TempDir {
        TempDir::new().expect("temp dir")
    }

    const TEST_COLOR: &str = "#A78BFA";

    // ------ A3.1 — vault_add appends a vault with generated id + returned Vault ------
    #[test]
    fn add_vault_appends_to_config_and_returns_complete_vault() {
        let dir = vault_dir();
        let path = dir.path().to_string_lossy().to_string();
        let mut config = fixture_config();

        let v = add_vault(
            &mut config,
            "Notes".into(),
            path.clone(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        )
        .expect("add succeeds for an existing directory");

        assert_eq!(v.name, "Notes");
        assert_eq!(v.path, path);
        assert_eq!(v.mode, VaultMode::Edit);
        assert!(!v.id.is_empty(), "vault id must be generated");
        assert_eq!(config.vaults.len(), 1, "vault appended to config");
        assert_eq!(config.vaults[0], v);
    }

    // ------ A3.2 — refuses a path that does not exist ------
    #[test]
    fn add_vault_rejects_path_that_does_not_exist() {
        let mut config = fixture_config();
        let result = add_vault(
            &mut config,
            "Ghost".into(),
            "/this/path/should/never/exist/123abc".into(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        );
        let err = result.expect_err("non-existent path must error");
        assert!(
            err.contains("Path does not exist"),
            "error must mention 'Path does not exist' (got: {err})"
        );
        assert!(config.vaults.is_empty(), "config not mutated on error");
    }

    // ------ A3.3 — refuses a path that exists but is a file, not a directory ------
    #[test]
    fn add_vault_rejects_path_that_is_not_a_directory() {
        let dir = vault_dir();
        let file_path = dir.path().join("not_a_dir.txt");
        std::fs::write(&file_path, "hello").unwrap();

        let mut config = fixture_config();
        let result = add_vault(
            &mut config,
            "Bogus".into(),
            file_path.to_string_lossy().to_string(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        );
        let err = result.expect_err("non-directory must error");
        assert!(
            err.contains("Path is not a directory"),
            "error must mention 'Path is not a directory' (got: {err})"
        );
    }

    // ------ A3.3b — color provided is persisted on the Vault ------
    #[test]
    fn add_vault_persists_provided_color() {
        let dir = vault_dir();
        let path = dir.path().to_string_lossy().to_string();
        let mut config = fixture_config();
        let v = add_vault(
            &mut config,
            "Hue".into(),
            path,
            VaultMode::Edit,
            "#FBBF24".into(),
        )
        .unwrap();
        assert_eq!(v.color, "#FBBF24");
        assert_eq!(config.vaults[0].color, "#FBBF24");
    }

    // ------ A3.4 — vault_remove removes by id ------
    #[test]
    fn remove_vault_removes_entry_by_id() {
        let dir = vault_dir();
        let path = dir.path().to_string_lossy().to_string();
        let mut config = fixture_config();
        let v = add_vault(&mut config, "X".into(), path, VaultMode::Edit, TEST_COLOR.into())
            .unwrap();

        remove_vault(&mut config, &v.id).expect("removal succeeds");
        assert!(config.vaults.is_empty(), "vault removed from config");
    }

    // ------ A3.5 — vault_remove errors on unknown id ------
    #[test]
    fn remove_vault_errors_when_id_not_found() {
        let mut config = fixture_config();
        let result = remove_vault(&mut config, "nonexistent-id");
        assert!(result.is_err(), "unknown id must error");
    }

    // ------ A3.6 — vault_update mutates only provided fields ------
    #[test]
    fn update_vault_changes_name_and_mode_independently() {
        let dir = vault_dir();
        let path = dir.path().to_string_lossy().to_string();
        let mut config = fixture_config();
        let v = add_vault(
            &mut config,
            "Old".into(),
            path.clone(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        )
        .unwrap();
        let original_id = v.id.clone();
        let original_color = v.color.clone();

        // Update only the name
        let after_name =
            update_vault(&mut config, &v.id, Some("New".into()), None).expect("name update");
        assert_eq!(after_name.name, "New");
        assert_eq!(after_name.mode, VaultMode::Edit, "mode untouched");
        assert_eq!(after_name.id, original_id, "id untouched");
        assert_eq!(after_name.color, original_color, "color untouched");
        assert_eq!(after_name.path, path, "path untouched");

        // Update only the mode
        let after_mode =
            update_vault(&mut config, &v.id, None, Some(VaultMode::Readonly)).expect("mode update");
        assert_eq!(after_mode.name, "New", "name preserved from previous update");
        assert_eq!(after_mode.mode, VaultMode::Readonly);
        assert_eq!(config.vaults.len(), 1, "still one vault");
    }
}
