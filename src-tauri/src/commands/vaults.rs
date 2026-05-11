use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::config;
use crate::models::{Config, Vault, VaultMode};

/// Hard-coded welcome content shipped with `create_sample_vault`.
/// Kept short and in French to match the app's primary locale.
const SAMPLE_WELCOME_MD: &str = "# Bienvenue dans Markhub

Markhub est un éditeur Markdown pour développeurs : portable, lisible par les IA, ami du `git`.

## Quelques points clés

- Tes fichiers `.md` restent sur **ton disque**. Pas de base de données, pas de cloud propriétaire.
- L'éditeur respecte **strictement** la syntaxe markdown — ce que tu vois est ce qui est écrit sur disque.
- Un **vault** = un dossier. Tu peux le versionner avec `git` comme n'importe quel autre projet.
";

const SAMPLE_SYNTAX_MD: &str = "# Syntaxe markdown

## Titres

`# H1`, `## H2`, `### H3`.

## Inline

**gras**, *italique*, `code`, [lien](https://example.com).

## Listes

- item
- item
  - sous-item

1. ordonné
2. ordonné

## Code

```ts
const x = 42;
```

## Tableau

| col1 | col2 |
|------|------|
| a    | b    |
";

const SAMPLE_TIPS_MD: &str = "---
title: Astuces Markhub
tags: [tips, markhub]
---

# Astuces Markhub

## Raccourcis dans l'éditeur

- Tape `/` pour ouvrir la palette de blocs (slash menu).
- Sélectionne du texte → une **barre flottante** apparaît (gras, italique, lien…).
- Le toggle **Preview / Source** est en haut à droite de l'éditeur.

## Frontmatter

Markhub respecte le YAML en haut des fichiers — ce fichier en a un (les trois tirets ci-dessus). Il est rendu dans un bloc rétractable au-dessus du contenu.
";

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

/// Create a fresh empty vault directory at `parent_dir/name` and register
/// it. Errors if the target path already exists or the parent isn't a
/// directory. Used by the empty-state "Créer un vault" action.
pub fn create_vault(
    config: &mut Config,
    parent_dir: String,
    name: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let parent = Path::new(&parent_dir);
    if !parent.is_dir() {
        return Err(format!("Parent path is not a directory: {parent_dir}"));
    }
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Vault name cannot be empty".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Vault name cannot contain path separators".to_string());
    }
    let target = parent.join(trimmed);
    if target.exists() {
        return Err(format!(
            "A directory or file already exists at: {}",
            target.display()
        ));
    }
    std::fs::create_dir(&target)
        .map_err(|e| format!("Failed to create vault directory: {e}"))?;
    let target_str = target
        .to_str()
        .ok_or_else(|| "Vault path is not valid UTF-8".to_string())?
        .to_string();
    let vault = Vault::new(trimmed.to_string(), target_str, mode, color);
    config.vaults.push(vault.clone());
    Ok(vault)
}

/// Seed a freshly-created vault directory with welcome markdown files.
/// Caller must own the path; no overwriting is attempted.
fn write_sample_files(root: &Path) -> Result<(), String> {
    let files = [
        ("Bienvenue.md", SAMPLE_WELCOME_MD),
        ("Syntaxe markdown.md", SAMPLE_SYNTAX_MD),
        ("Astuces Markhub.md", SAMPLE_TIPS_MD),
    ];
    for (name, content) in files {
        std::fs::write(root.join(name), content)
            .map_err(|e| format!("Failed to write sample file {name}: {e}"))?;
    }
    Ok(())
}

/// Like `create_vault` but seeds the new directory with a few welcome
/// markdown files. The empty-state "Vault d'exemple" action.
pub fn create_sample_vault(
    config: &mut Config,
    parent_dir: String,
    name: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let vault = create_vault(config, parent_dir, name, mode, color)?;
    write_sample_files(Path::new(&vault.path))?;
    Ok(vault)
}

/// Derive a vault name from a git URL (`org/repo.git`, `org/repo`,
/// `git@host:org/repo.git`, `ssh://…/repo`). The tail segment minus a
/// trailing `.git` is the result. Errors if the tail is empty or
/// resolves to a value that wouldn't make a usable directory name.
pub fn derive_vault_name_from_git_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim().trim_end_matches('/').trim_end_matches(".git");
    let tail = trimmed
        .rsplit(|c| c == '/' || c == ':')
        .next()
        .unwrap_or(trimmed);
    // Reject names that aren't a valid sub-directory: empty, `.`/`..`, or
    // anything still containing a path separator (defensive — `rsplit`
    // should have stripped them). The hostname-only case (e.g. cloning
    // "https://x.com/" without a repo path) lands here too via the empty
    // tail check above, since `trim_end_matches('/')` reduces it to
    // "https://x.com" and rsplit yields "x.com" — which we then reject
    // below as a hostname-shaped name (contains a dot but no slash).
    if tail.is_empty() || tail == "." || tail == ".." {
        return Err(format!("Cannot derive a vault name from URL: {url}"));
    }
    if tail.contains('/') || tail.contains('\\') {
        return Err(format!("Cannot derive a vault name from URL: {url}"));
    }
    Ok(tail.to_string())
}

/// Clone a remote git repository into `parent_dir/<derived-name>` and
/// register the result as a vault. Shells out to the system `git`
/// binary (assumed present on macOS via Xcode CLI tools).
pub fn clone_git_vault(
    config: &mut Config,
    parent_dir: String,
    repo_url: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let parent = Path::new(&parent_dir);
    if !parent.is_dir() {
        return Err(format!("Parent path is not a directory: {parent_dir}"));
    }
    let trimmed_url = repo_url.trim();
    if trimmed_url.is_empty() {
        return Err("Repository URL cannot be empty".to_string());
    }
    let name = derive_vault_name_from_git_url(trimmed_url)?;
    let target = parent.join(&name);
    if target.exists() {
        return Err(format!(
            "A directory or file already exists at: {}",
            target.display()
        ));
    }
    // `Command::arg` does not invoke a shell, so the URL is safe from
    // shell-meta injection even when it contains arbitrary characters.
    let output = std::process::Command::new("git")
        .arg("clone")
        .arg(trimmed_url)
        .arg(&target)
        .output()
        .map_err(|e| format!("Failed to invoke git: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git clone failed: {}", stderr.trim()));
    }
    let target_str = target
        .to_str()
        .ok_or_else(|| "Cloned path is not valid UTF-8".to_string())?
        .to_string();
    let vault = Vault::new(name, target_str, mode, color);
    config.vaults.push(vault.clone());
    Ok(vault)
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
pub fn vault_create(
    app: AppHandle,
    parent_dir: String,
    name: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    let vault = create_vault(&mut cfg, parent_dir, name, mode, color)?;
    config::save_config_to_path(&cfg_path, &cfg)?;
    Ok(vault)
}

#[tauri::command]
pub fn vault_create_sample(
    app: AppHandle,
    parent_dir: String,
    name: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    let vault = create_sample_vault(&mut cfg, parent_dir, name, mode, color)?;
    config::save_config_to_path(&cfg_path, &cfg)?;
    Ok(vault)
}

#[tauri::command]
pub fn vault_clone_git(
    app: AppHandle,
    parent_dir: String,
    repo_url: String,
    mode: VaultMode,
    color: String,
) -> Result<Vault, String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    let vault = clone_git_vault(&mut cfg, parent_dir, repo_url, mode, color)?;
    config::save_config_to_path(&cfg_path, &cfg)?;
    Ok(vault)
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

    // ------ create_vault ------
    #[test]
    fn create_vault_makes_a_new_directory_and_registers_it() {
        let parent = vault_dir();
        let mut config = fixture_config();
        let v = create_vault(
            &mut config,
            parent.path().to_string_lossy().into_owned(),
            "Mon Vault".into(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        )
        .expect("create_vault should succeed");
        assert_eq!(v.name, "Mon Vault");
        assert!(Path::new(&v.path).is_dir(), "vault dir must exist on disk");
        assert_eq!(config.vaults.len(), 1);
    }

    #[test]
    fn create_vault_rejects_existing_target() {
        let parent = vault_dir();
        std::fs::create_dir(parent.path().join("Existing")).unwrap();
        let mut config = fixture_config();
        let err = create_vault(
            &mut config,
            parent.path().to_string_lossy().into_owned(),
            "Existing".into(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        )
        .expect_err("must refuse to overwrite existing directory");
        assert!(err.contains("already exists"), "got: {err}");
        assert!(config.vaults.is_empty());
    }

    #[test]
    fn create_vault_rejects_path_separators_in_name() {
        let parent = vault_dir();
        let mut config = fixture_config();
        let err = create_vault(
            &mut config,
            parent.path().to_string_lossy().into_owned(),
            "evil/../subdir".into(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        )
        .expect_err("path separators must be rejected");
        assert!(err.to_lowercase().contains("separator"), "got: {err}");
    }

    // ------ create_sample_vault ------
    #[test]
    fn create_sample_vault_seeds_welcome_files() {
        let parent = vault_dir();
        let mut config = fixture_config();
        let v = create_sample_vault(
            &mut config,
            parent.path().to_string_lossy().into_owned(),
            "Sample".into(),
            VaultMode::Edit,
            TEST_COLOR.into(),
        )
        .expect("sample vault");
        let root = Path::new(&v.path);
        assert!(root.join("Bienvenue.md").is_file());
        assert!(root.join("Syntaxe markdown.md").is_file());
        assert!(root.join("Astuces Markhub.md").is_file());
    }

    // ------ derive_vault_name_from_git_url ------
    #[test]
    fn derive_name_from_https_with_dot_git() {
        let n = derive_vault_name_from_git_url("https://github.com/org/markhub-plugin.git").unwrap();
        assert_eq!(n, "markhub-plugin");
    }

    #[test]
    fn derive_name_from_ssh_form() {
        let n = derive_vault_name_from_git_url("git@github.com:org/markhub-plugin.git").unwrap();
        assert_eq!(n, "markhub-plugin");
    }

    #[test]
    fn derive_name_strips_trailing_slash_and_no_dot_git() {
        let n = derive_vault_name_from_git_url("https://example.com/foo/bar/").unwrap();
        assert_eq!(n, "bar");
    }

    #[test]
    fn derive_name_rejects_empty_url() {
        let err = derive_vault_name_from_git_url("").expect_err("empty must error");
        assert!(err.to_lowercase().contains("cannot derive"), "got: {err}");
    }

    #[test]
    fn derive_name_rejects_dot_and_dotdot_tails() {
        // `.git` strip + odd input shape can collapse to `.` / `..`. Reject.
        derive_vault_name_from_git_url("https://example.com/./").expect_err("`.` must error");
        derive_vault_name_from_git_url("https://example.com/..").expect_err("`..` must error");
    }
}
