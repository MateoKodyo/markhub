use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "frontmatter-state.json";

/// Resolve the on-disk path for the per-file frontmatter collapse map via
/// Tauri's platform-aware `app_config_dir` (e.g. `~/Library/Application
/// Support/com.kodyo.markhub/frontmatter-state.json`).
pub fn resolve_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(FILE_NAME))
        .map_err(|e| format!("Cannot resolve app config dir: {e}"))
}

/// Read the persisted state. Missing / unreadable / malformed files all
/// return an empty map silently — collapsed state is purely cosmetic and
/// must never block the app from booting.
#[tauri::command]
pub fn frontmatter_state_read(app: AppHandle) -> Result<HashMap<String, bool>, String> {
    let path = resolve_path(&app)?;
    Ok(load_from_path(&path))
}

#[tauri::command]
pub fn frontmatter_state_write(
    app: AppHandle,
    state: HashMap<String, bool>,
) -> Result<(), String> {
    let path = resolve_path(&app)?;
    save_to_path(&path, &state)
}

pub fn load_from_path(path: &Path) -> HashMap<String, bool> {
    if !path.exists() {
        return HashMap::new();
    }
    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) => {
            log::warn!(
                "frontmatter_state: failed to read {} ({e}) — empty map",
                path.display()
            );
            return HashMap::new();
        }
    };
    match serde_json::from_str::<HashMap<String, bool>>(&raw) {
        Ok(m) => m,
        Err(e) => {
            log::warn!(
                "frontmatter_state: malformed JSON at {} ({e}) — empty map",
                path.display()
            );
            HashMap::new()
        }
    }
}

/// Atomic write via tmp + rename — same pattern as settings persistence so
/// a partial write or a power-loss mid-flush can't leave a half-written
/// JSON behind. Frontmatter state is unimportant enough that a write
/// failure is logged but not surfaced.
pub fn save_to_path(path: &Path, state: &HashMap<String, bool>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!(
                    "Failed to create frontmatter-state parent dir {}: {e}",
                    parent.display()
                )
            })?;
        }
    }
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize frontmatter state: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| {
        format!("Failed to write frontmatter-state tmp {}: {e}", tmp.display())
    })?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!(
            "Failed to atomically install frontmatter state at {}: {e}",
            path.display()
        )
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn temp_path() -> (TempDir, PathBuf) {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().join("frontmatter-state.json");
        (dir, path)
    }

    #[test]
    fn load_returns_empty_when_missing() {
        let (_g, path) = temp_path();
        let map = load_from_path(&path);
        assert!(map.is_empty());
    }

    #[test]
    fn save_then_load_round_trips() {
        let (_g, path) = temp_path();
        let mut map = HashMap::new();
        map.insert("vault-a::notes/one.md".to_string(), false);
        map.insert("vault-a::notes/two.md".to_string(), true);
        save_to_path(&path, &map).expect("save ok");
        let loaded = load_from_path(&path);
        assert_eq!(loaded, map);
    }

    #[test]
    fn malformed_json_falls_back_to_empty_map() {
        let (_g, path) = temp_path();
        fs::write(&path, "{ not valid").unwrap();
        let map = load_from_path(&path);
        assert!(map.is_empty());
    }

    #[test]
    fn save_creates_parent_dir() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("a/b").join("frontmatter-state.json");
        save_to_path(&nested, &HashMap::new()).expect("save ok");
        assert!(nested.exists());
    }

    #[test]
    fn save_leaves_no_tmp_behind() {
        let (_g, path) = temp_path();
        save_to_path(&path, &HashMap::new()).unwrap();
        assert!(!path.with_extension("json.tmp").exists());
    }
}
