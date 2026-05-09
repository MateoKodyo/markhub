use std::ffi::OsStr;
use std::fs;
use std::path::{Component, Path, PathBuf};

use tauri::AppHandle;

use crate::commands::config;
use crate::models::{FileEntry, Vault, VaultMode};

const PATH_OUTSIDE_VAULT: &str = "Path outside vault";
const VAULT_IS_READONLY: &str = "Vault is readonly";

/// Resolve a safe absolute path inside the vault root from a relative path.
/// Rejects absolute paths and any traversal that escapes the vault root.
/// Cleans `.` and `..` components conceptually (without filesystem canonicalization
/// of the leaf, since the leaf may not exist for write/create operations).
pub fn resolve_safe_path(vault: &Vault, relative: &str) -> Result<PathBuf, String> {
    let cleaned = clean_relative(relative)?;
    Ok(Path::new(&vault.path).join(cleaned))
}

/// Walk components and resolve `.` / `..` without touching the filesystem.
/// Returns Err if the path is absolute, contains a prefix, or `..` escapes the root.
fn clean_relative(relative: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    let mut segments: Vec<&OsStr> = Vec::new();
    for comp in path.components() {
        match comp {
            Component::CurDir => continue,
            Component::ParentDir => {
                if segments.pop().is_none() {
                    return Err(PATH_OUTSIDE_VAULT.to_string());
                }
            }
            Component::Normal(s) => segments.push(s),
            // RootDir, Prefix → absolute or platform-specific. Reject.
            _ => return Err(PATH_OUTSIDE_VAULT.to_string()),
        }
    }
    let mut result = PathBuf::new();
    for s in segments {
        result.push(s);
    }
    Ok(result)
}

fn ensure_writable(vault: &Vault) -> Result<(), String> {
    if vault.mode == VaultMode::Readonly {
        Err(VAULT_IS_READONLY.to_string())
    } else {
        Ok(())
    }
}

fn ensure_parent_dir(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {e}"))?;
        }
    }
    Ok(())
}

/// Read the file at `relative` inside `vault` as UTF-8.
pub fn read_file(vault: &Vault, relative: &str) -> Result<String, String> {
    let path = resolve_safe_path(vault, relative)?;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {relative}: {e}"))
}

/// Write `content` to `relative` inside `vault`. Creates parent dirs if needed.
/// Refuses if the vault is readonly.
pub fn write_file(vault: &Vault, relative: &str, content: &str) -> Result<(), String> {
    ensure_writable(vault)?;
    let path = resolve_safe_path(vault, relative)?;
    ensure_parent_dir(&path)?;
    fs::write(&path, content).map_err(|e| format!("Failed to write {relative}: {e}"))
}

/// Create an empty file at `relative` inside `vault`.
/// Errors if the file already exists. Refuses on readonly vaults.
pub fn create_file(vault: &Vault, relative: &str) -> Result<(), String> {
    ensure_writable(vault)?;
    let path = resolve_safe_path(vault, relative)?;
    if path.exists() {
        return Err(format!("File already exists: {relative}"));
    }
    ensure_parent_dir(&path)?;
    fs::write(&path, "").map_err(|e| format!("Failed to create {relative}: {e}"))
}

/// Delete the file at `relative` inside `vault`. Refuses on readonly vaults.
pub fn delete_file(vault: &Vault, relative: &str) -> Result<(), String> {
    ensure_writable(vault)?;
    let path = resolve_safe_path(vault, relative)?;
    fs::remove_file(&path).map_err(|e| format!("Failed to delete {relative}: {e}"))
}

/// Create an empty directory at `relative` inside `vault`. Idempotent for
/// already-existing directories (no error). Refuses on readonly vaults.
pub fn create_folder(vault: &Vault, relative: &str) -> Result<(), String> {
    ensure_writable(vault)?;
    let path = resolve_safe_path(vault, relative)?;
    if path.exists() {
        if path.is_dir() {
            return Ok(());
        }
        return Err(format!(
            "Cannot create folder — a file already exists at {relative}"
        ));
    }
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create folder {relative}: {e}"))
}

/// Rename `old_relative` to `new_relative` inside `vault`.
/// Both paths must stay inside the vault. Refuses on readonly vaults.
pub fn rename_file(vault: &Vault, old_relative: &str, new_relative: &str) -> Result<(), String> {
    ensure_writable(vault)?;
    let old_path = resolve_safe_path(vault, old_relative)?;
    let new_path = resolve_safe_path(vault, new_relative)?;
    ensure_parent_dir(&new_path)?;
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename {old_relative} → {new_relative}: {e}"))
}

/// Recursively scan a vault, returning a tree of FileEntry.
/// Filters: only `.md` / `.markdown` files; ignores entries starting with `.`.
/// Sorts: directories first, then alphabetical within each group.
pub fn scan_vault(vault: &Vault) -> Result<FileEntry, String> {
    let root = Path::new(&vault.path);
    if !root.exists() {
        return Err(format!("Vault root not found: {}", vault.path));
    }
    if !root.is_dir() {
        return Err(format!("Vault root is not a directory: {}", vault.path));
    }
    let children = scan_dir(root, "")?;
    Ok(FileEntry {
        name: String::new(),
        relative_path: String::new(),
        is_directory: true,
        children: Some(children),
    })
}

fn scan_dir(absolute: &Path, relative: &str) -> Result<Vec<FileEntry>, String> {
    let mut directories: Vec<FileEntry> = Vec::new();
    let mut files: Vec<FileEntry> = Vec::new();
    let read = fs::read_dir(absolute)
        .map_err(|e| format!("Failed to read directory {}: {e}", absolute.display()))?;
    for entry in read {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("Failed to read metadata for {name}: {e}"))?;
        let child_rel = if relative.is_empty() {
            name.clone()
        } else {
            format!("{relative}/{name}")
        };
        if metadata.is_dir() {
            let nested = scan_dir(&entry.path(), &child_rel)?;
            directories.push(FileEntry {
                name,
                relative_path: child_rel,
                is_directory: true,
                children: Some(nested),
            });
        } else if metadata.is_file() {
            let lower = name.to_lowercase();
            if lower.ends_with(".md") || lower.ends_with(".markdown") {
                files.push(FileEntry {
                    name,
                    relative_path: child_rel,
                    is_directory: false,
                    children: None,
                });
            }
        }
    }
    directories.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));
    let mut result = directories;
    result.extend(files);
    Ok(result)
}

// ============================================================
// Tauri command wrappers — look up vault from config, delegate.
// ============================================================

fn vault_for(app: &AppHandle, id: &str) -> Result<Vault, String> {
    let cfg_path = config::resolve_config_path(app)?;
    let cfg = config::load_config_from_path(&cfg_path)?;
    cfg.vaults
        .into_iter()
        .find(|v| v.id == id)
        .ok_or_else(|| format!("Vault not found: {id}"))
}

#[tauri::command]
pub fn file_read(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<String, String> {
    let v = vault_for(&app, &vault_id)?;
    read_file(&v, &relative_path)
}

#[tauri::command]
pub fn file_write(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    write_file(&v, &relative_path, &content)
}

#[tauri::command]
pub fn file_create(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    create_file(&v, &relative_path)
}

#[tauri::command]
pub fn file_delete(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    delete_file(&v, &relative_path)
}

#[tauri::command]
pub fn file_rename(
    app: AppHandle,
    vault_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    rename_file(&v, &old_path, &new_path)
}

#[tauri::command]
pub fn folder_create(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    create_folder(&v, &relative_path)
}

#[tauri::command]
pub fn vault_scan(app: AppHandle, vault_id: String) -> Result<FileEntry, String> {
    let v = vault_for(&app, &vault_id)?;
    scan_vault(&v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::VaultMode;
    use std::fs;
    use std::path::Path;
    use tempfile::TempDir;

    fn make_vault(mode: VaultMode) -> (TempDir, Vault) {
        let dir = TempDir::new().expect("temp dir");
        let path = dir.path().to_string_lossy().to_string();
        let v = Vault {
            id: "test-vault-id".to_string(),
            name: "Test".to_string(),
            path,
            mode,
            color: "#7C3AED".to_string(),
        };
        (dir, v)
    }

    fn write_fixture(root: &Path, rel: &str, content: &str) {
        let full = root.join(rel);
        if let Some(parent) = full.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(full, content).unwrap();
    }

    // ============================================================
    // A4 — Path traversal (CRITICAL SECURITY)
    // ============================================================

    #[test]
    fn read_rejects_relative_path_escaping_via_dotdot() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let result = read_file(&v, "../etc/passwd");
        let err = result.expect_err("traversal must error");
        assert!(
            err.contains("Path outside vault"),
            "error must mention 'Path outside vault' (got: {err})"
        );
    }

    #[test]
    fn read_rejects_absolute_relative_path() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let result = read_file(&v, "/etc/passwd");
        let err = result.expect_err("absolute path must error");
        assert!(
            err.contains("Path outside vault"),
            "error must mention 'Path outside vault' (got: {err})"
        );
    }

    #[test]
    fn write_rejects_relative_path_escaping_via_dotdot() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let result = write_file(&v, "../escape.md", "x");
        let err = result.expect_err("traversal must error on write");
        assert!(
            err.contains("Path outside vault"),
            "error must mention 'Path outside vault' (got: {err})"
        );
    }

    #[test]
    fn write_accepts_dotdot_that_resolves_inside_vault() {
        let (g, v) = make_vault(VaultMode::Edit);
        // Write subdir/note.md via the path "subdir/../note.md" — equivalent to "note.md".
        write_file(&v, "subdir/../note.md", "hello")
            .expect("dotdot that stays inside vault is allowed");
        let final_path = g.path().join("note.md");
        assert!(final_path.exists(), "note.md was written at vault root");
        assert_eq!(fs::read_to_string(final_path).unwrap(), "hello");
    }

    // ============================================================
    // A5 — Readonly enforcement
    // ============================================================

    #[test]
    fn write_is_rejected_on_readonly_vault() {
        let (_g, v) = make_vault(VaultMode::Readonly);
        let result = write_file(&v, "note.md", "x");
        let err = result.expect_err("readonly must reject write");
        assert!(
            err.contains("Vault is readonly"),
            "error must mention 'Vault is readonly' (got: {err})"
        );
    }

    #[test]
    fn create_is_rejected_on_readonly_vault() {
        let (_g, v) = make_vault(VaultMode::Readonly);
        let err = create_file(&v, "new.md").expect_err("readonly must reject create");
        assert!(err.contains("Vault is readonly"));
    }

    #[test]
    fn delete_is_rejected_on_readonly_vault() {
        let (_g, v) = make_vault(VaultMode::Readonly);
        let err = delete_file(&v, "any.md").expect_err("readonly must reject delete");
        assert!(err.contains("Vault is readonly"));
    }

    #[test]
    fn rename_is_rejected_on_readonly_vault() {
        let (_g, v) = make_vault(VaultMode::Readonly);
        let err = rename_file(&v, "old.md", "new.md").expect_err("readonly must reject rename");
        assert!(err.contains("Vault is readonly"));
    }

    #[test]
    fn create_folder_is_rejected_on_readonly_vault() {
        let (_g, v) = make_vault(VaultMode::Readonly);
        let err = create_folder(&v, "newdir").expect_err("readonly must reject folder create");
        assert!(err.contains("Vault is readonly"));
    }

    #[test]
    fn read_is_allowed_on_readonly_vault() {
        let (g, v) = make_vault(VaultMode::Readonly);
        write_fixture(g.path(), "note.md", "hello readonly");
        let content = read_file(&v, "note.md").expect("read allowed on readonly");
        assert_eq!(content, "hello readonly");
    }

    // ============================================================
    // A6 — vault_scan
    // ============================================================

    #[test]
    fn scan_returns_only_md_and_markdown_files() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "");
        write_fixture(g.path(), "doc.markdown", "");
        write_fixture(g.path(), "ignored.txt", "");
        write_fixture(g.path(), "image.png", "");

        let root = scan_vault(&v).expect("scan");
        assert!(root.is_directory, "scan returns root as directory");
        let children = root.children.expect("children present");
        let names: Vec<_> = children.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"note.md"));
        assert!(names.contains(&"doc.markdown"));
        assert!(!names.contains(&"ignored.txt"));
        assert!(!names.contains(&"image.png"));
    }

    #[test]
    fn scan_returns_recursive_tree_with_isDirectory() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "subdir/inner.md", "");
        write_fixture(g.path(), "subdir/deeper/note.md", "");

        let root = scan_vault(&v).unwrap();
        let children = root.children.as_ref().expect("children");
        let subdir = children
            .iter()
            .find(|c| c.name == "subdir")
            .expect("subdir present");
        assert!(subdir.is_directory);
        let subdir_children = subdir.children.as_ref().expect("subdir has children");
        let deeper = subdir_children
            .iter()
            .find(|c| c.name == "deeper")
            .expect("deeper present");
        assert!(deeper.is_directory);
        assert!(deeper
            .children
            .as_ref()
            .unwrap()
            .iter()
            .any(|c| c.name == "note.md"));
    }

    #[test]
    fn scan_ignores_hidden_entries() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), ".hidden.md", "");
        write_fixture(g.path(), ".hidden_dir/note.md", "");
        write_fixture(g.path(), "visible.md", "");

        let root = scan_vault(&v).unwrap();
        let names: Vec<_> = root
            .children
            .as_ref()
            .unwrap()
            .iter()
            .map(|c| c.name.as_str())
            .collect();
        assert_eq!(names, vec!["visible.md"]);
    }

    #[test]
    fn scan_sorts_directories_before_files_alphabetically() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "z.md", "");
        write_fixture(g.path(), "a.md", "");
        write_fixture(g.path(), "m_dir/inside.md", "");
        write_fixture(g.path(), "b_dir/inside.md", "");

        let root = scan_vault(&v).unwrap();
        let names: Vec<_> = root
            .children
            .as_ref()
            .unwrap()
            .iter()
            .map(|c| c.name.as_str())
            .collect();
        // Directories (b_dir, m_dir) before files (a.md, z.md), each group alphabetical
        assert_eq!(names, vec!["b_dir", "m_dir", "a.md", "z.md"]);
    }

    // ============================================================
    // A6 — file_read
    // ============================================================

    #[test]
    fn read_returns_utf8_content() {
        let (g, v) = make_vault(VaultMode::Edit);
        let payload = "héllo — markdown ✨";
        write_fixture(g.path(), "note.md", payload);
        let content = read_file(&v, "note.md").unwrap();
        assert_eq!(content, payload);
    }

    #[test]
    fn read_errors_when_file_does_not_exist() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let result = read_file(&v, "nope.md");
        assert!(result.is_err());
    }

    // ============================================================
    // A6 — file_write
    // ============================================================

    #[test]
    fn write_creates_parent_directories_as_needed() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_file(&v, "deep/nested/folder/note.md", "ok").unwrap();
        let full = g.path().join("deep/nested/folder/note.md");
        assert!(full.exists());
        assert_eq!(fs::read_to_string(full).unwrap(), "ok");
    }

    #[test]
    fn write_overwrites_existing_file() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "v1");
        write_file(&v, "note.md", "v2").unwrap();
        assert_eq!(fs::read_to_string(g.path().join("note.md")).unwrap(), "v2");
    }

    // ============================================================
    // A6 — file_create
    // ============================================================

    #[test]
    fn create_creates_an_empty_file() {
        let (g, v) = make_vault(VaultMode::Edit);
        create_file(&v, "fresh.md").unwrap();
        let full = g.path().join("fresh.md");
        assert!(full.exists());
        assert_eq!(fs::read_to_string(full).unwrap(), "");
    }

    #[test]
    fn create_errors_when_file_already_exists() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "exists.md", "x");
        let result = create_file(&v, "exists.md");
        assert!(result.is_err(), "create on existing file must error");
    }

    // ============================================================
    // A6 — file_delete
    // ============================================================

    #[test]
    fn delete_removes_file() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "x");
        delete_file(&v, "note.md").unwrap();
        assert!(!g.path().join("note.md").exists());
    }

    // ============================================================
    // A6 — file_rename
    // ============================================================

    #[test]
    fn rename_moves_file_inside_vault() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "old.md", "x");
        rename_file(&v, "old.md", "new.md").unwrap();
        assert!(!g.path().join("old.md").exists());
        assert!(g.path().join("new.md").exists());
        assert_eq!(fs::read_to_string(g.path().join("new.md")).unwrap(), "x");
    }

    #[test]
    fn rename_rejects_target_outside_vault() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "old.md", "x");
        let result = rename_file(&v, "old.md", "../leaked.md");
        let err = result.expect_err("traversal target must error");
        assert!(err.contains("Path outside vault"));
    }

    // ============================================================
    // A6 — folder_create
    // ============================================================

    #[test]
    fn create_folder_makes_a_directory() {
        let (g, v) = make_vault(VaultMode::Edit);
        create_folder(&v, "assets").unwrap();
        let p = g.path().join("assets");
        assert!(p.exists() && p.is_dir());
    }

    #[test]
    fn create_folder_creates_intermediate_parents() {
        let (g, v) = make_vault(VaultMode::Edit);
        create_folder(&v, "a/b/c").unwrap();
        assert!(g.path().join("a/b/c").is_dir());
    }

    #[test]
    fn create_folder_is_idempotent_when_already_exists() {
        let (g, v) = make_vault(VaultMode::Edit);
        std::fs::create_dir(g.path().join("existing")).unwrap();
        create_folder(&v, "existing").expect("idempotent");
    }

    #[test]
    fn create_folder_rejects_path_outside_vault() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err = create_folder(&v, "../outside").expect_err("traversal must error");
        assert!(err.contains("Path outside vault"));
    }

    #[test]
    fn create_folder_errors_when_a_file_exists_at_same_path() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "blocker", "x"); // a file, not a dir
        let result = create_folder(&v, "blocker");
        assert!(result.is_err());
    }
}
