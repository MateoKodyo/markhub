use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VaultMode {
    Edit,
    Readonly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub path: String,
    pub mode: VaultMode,
    pub color: String,
}

impl Vault {
    /// Construct a Vault with a freshly generated UUID v4 id.
    /// `color` is provided by the caller (front-side palette rotation).
    pub fn new(name: String, path: String, mode: VaultMode, color: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            path,
            mode,
            color,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LastOpenedFile {
    pub vault_id: String,
    pub relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub auto_save_delay_ms: u32,
    pub theme: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            auto_save_delay_ms: 1500,
            theme: "system".to_string(),
        }
    }
}

// ============================================================
// User Settings v1 — PLAN-SETTINGS STEP 1
//
// Lives in its own file (`settings.json`) so it can be exported / imported
// independently of the app's machine state (vaults, last opened, expansion).
//
// Deviations from PLAN-SETTINGS.md, documented:
// - `theme` is typed as a free-form `String` (default `"system"`) and accepts
//   the legacy 3-value set ('dark' | 'light' | 'system'). The plan defines
//   4 curated theme presets, but their CSS does not exist yet — that's STEP 3
//   (Appearance section). Until then, the new store delegates to the existing
//   `themeStore` so user-visible behavior stays identical.
// - `line_height` is a real number, so we drop the `Eq` derive (PartialEq
//   suffices for tests).
// ============================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub theme: String,
    pub editor_font: String,
    pub editor_font_size: u32,
    pub editor_line_height: f64,
    pub editor_content_width: u32,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            // ID matching the picker in `SettingsAppearance.svelte`. Resolved
            // to a font-family stack on the frontend (see FONTS array there).
            editor_font: "geist".to_string(),
            editor_font_size: 16,
            editor_line_height: 1.6,
            editor_content_width: 720,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSettings {
    pub autosave_delay_ms: u32,
    pub spell_check: bool,
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            autosave_delay_ms: 1500,
            spell_check: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSettings {
    pub mono_font: String,
}

impl Default for SourceSettings {
    fn default() -> Self {
        Self {
            mono_font: "geist-mono".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesSettings {
    pub confirm_delete: bool,
}

impl Default for FilesSettings {
    fn default() -> Self {
        Self { confirm_delete: true }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BehaviorSettings {
    pub ask_before_closing_unsaved: bool,
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            ask_before_closing_unsaved: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub version: u32,
    pub appearance: AppearanceSettings,
    pub editor: EditorSettings,
    pub source: SourceSettings,
    pub files: FilesSettings,
    pub behavior: BehaviorSettings,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            version: 1,
            appearance: AppearanceSettings::default(),
            editor: EditorSettings::default(),
            source: SourceSettings::default(),
            files: FilesSettings::default(),
            behavior: BehaviorSettings::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub relative_path: String,
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct VaultState {
    /// Relative paths (from vault root) of folders currently expanded in the sidebar.
    /// Persisted across sessions so the tree restores its open/closed state.
    #[serde(default)]
    pub expanded_folders: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub version: u32,
    pub vaults: Vec<Vault>,
    pub last_opened_file: Option<LastOpenedFile>,
    pub settings: Settings,
    /// Per-vault UI state (expansion, future: scroll position, etc.).
    /// `#[serde(default)]` keeps backwards compatibility with configs written
    /// before this field existed.
    #[serde(default)]
    pub vault_states: HashMap<String, VaultState>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            version: 1,
            vaults: Vec::new(),
            last_opened_file: None,
            settings: Settings::default(),
            vault_states: HashMap::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    // ------ A1.1 — Vault::new generates a valid UUID v4 ------
    #[test]
    fn vault_new_generates_a_valid_uuid_v4() {
        let v = Vault::new(
            "Notes".into(),
            "/tmp/notes".into(),
            VaultMode::Edit,
            "#A78BFA".into(),
        );
        let parsed = Uuid::parse_str(&v.id).expect("id is a valid uuid");
        assert_eq!(
            parsed.get_version_num(),
            4,
            "vault id must be a UUID v4 (got version {})",
            parsed.get_version_num()
        );
    }

    #[test]
    fn vault_new_assigns_provided_name_path_mode_and_color() {
        let v = Vault::new(
            "Notes".into(),
            "/tmp/notes".into(),
            VaultMode::Readonly,
            "#34D399".into(),
        );
        assert_eq!(v.name, "Notes");
        assert_eq!(v.path, "/tmp/notes");
        assert_eq!(v.mode, VaultMode::Readonly);
        assert_eq!(v.color, "#34D399");
    }

    #[test]
    fn vault_new_emits_distinct_ids_per_call() {
        let a = Vault::new("a".into(), "/a".into(), VaultMode::Edit, "#fff".into());
        let b = Vault::new("b".into(), "/b".into(), VaultMode::Edit, "#fff".into());
        assert_ne!(a.id, b.id, "each Vault must have its own id");
    }

    // ------ A1.2 — VaultMode serde round-trip ------
    #[test]
    fn vault_mode_serializes_to_edit_or_readonly() {
        assert_eq!(serde_json::to_string(&VaultMode::Edit).unwrap(), "\"edit\"");
        assert_eq!(
            serde_json::to_string(&VaultMode::Readonly).unwrap(),
            "\"readonly\""
        );
    }

    #[test]
    fn vault_mode_deserializes_from_edit_or_readonly() {
        let edit: VaultMode = serde_json::from_str("\"edit\"").unwrap();
        let ro: VaultMode = serde_json::from_str("\"readonly\"").unwrap();
        assert_eq!(edit, VaultMode::Edit);
        assert_eq!(ro, VaultMode::Readonly);
    }

    // ------ A1.3 — Config snapshot serialization ------
    #[test]
    fn default_config_serializes_to_expected_snapshot() {
        let cfg = Config::default();
        let json = serde_json::to_string_pretty(&cfg).unwrap();
        let expected = "{\n  \"version\": 1,\n  \"vaults\": [],\n  \"lastOpenedFile\": null,\n  \"settings\": {\n    \"autoSaveDelayMs\": 1500,\n    \"theme\": \"system\"\n  },\n  \"vaultStates\": {}\n}";
        assert_eq!(json, expected);
    }

    // ------ A1.4 — VaultState round-trip ------
    #[test]
    fn vault_state_with_expanded_folders_round_trips() {
        let state = VaultState {
            expanded_folders: vec!["sub".into(), "sub/deeper".into()],
        };
        let json = serde_json::to_string(&state).unwrap();
        let back: VaultState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, state);
    }

    // ------ A1.5 — Config with vault_states round-trips ------
    #[test]
    fn config_with_vault_states_round_trips() {
        let mut cfg = Config::default();
        cfg.vault_states.insert(
            "vault-id-1".into(),
            VaultState {
                expanded_folders: vec!["a".into(), "a/b".into()],
            },
        );
        let json = serde_json::to_string_pretty(&cfg).unwrap();
        let back: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(back, cfg);
    }

    // ------ A1.6 — Old configs (without vaultStates) still load ------
    #[test]
    fn config_without_vault_states_field_still_deserializes() {
        let legacy_json = r#"{
            "version": 1,
            "vaults": [],
            "lastOpenedFile": null,
            "settings": { "autoSaveDelayMs": 1500, "theme": "system" }
        }"#;
        let cfg: Config = serde_json::from_str(legacy_json).unwrap();
        assert!(cfg.vault_states.is_empty());
    }
}
