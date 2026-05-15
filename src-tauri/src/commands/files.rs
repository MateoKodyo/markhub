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

/// Recursively delete the directory at `relative` inside `vault`.
/// Refuses on readonly vaults. Refuses to delete the vault root itself
/// (i.e. when `relative` resolves to an empty path) — that guard is what
/// keeps a slip-of-the-keyboard from nuking the whole vault.
///
/// Uses `remove_dir_all` (not `remove_file`): on macOS `unlink(2)` on a
/// directory returns EPERM (errno 1, "Operation not permitted"), which is
/// what was surfacing to users as "Failed to delete X: Operation not
/// permitted (os error 1)".
pub fn delete_folder(vault: &Vault, relative: &str) -> Result<(), String> {
    ensure_writable(vault)?;
    let cleaned = clean_relative(relative)?;
    if cleaned.as_os_str().is_empty() {
        return Err("Cannot delete vault root".to_string());
    }
    let path = Path::new(&vault.path).join(cleaned);
    fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete {relative}: {e}"))
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

/// Duplicate the file at `relative` inside `vault`. The new file is placed
/// in the same directory with a " copie" / " copie 2" / … suffix, picked
/// to avoid collisions. Returns the new relative path.
/// Refuses on readonly vaults; refuses on directories (only files duplicate).
pub fn duplicate_file(vault: &Vault, relative: &str) -> Result<String, String> {
    ensure_writable(vault)?;
    let src = resolve_safe_path(vault, relative)?;
    if !src.exists() {
        return Err(format!("File not found: {relative}"));
    }
    if src.is_dir() {
        return Err(format!("Cannot duplicate a directory: {relative}"));
    }

    let stem = src
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = src
        .extension()
        .map(|s| format!(".{}", s.to_string_lossy()))
        .unwrap_or_default();
    let parent_rel = match relative.rsplit_once('/') {
        Some((p, _)) => p.to_string(),
        None => String::new(),
    };

    // Try "{stem} copie{ext}", then "{stem} copie 2{ext}", etc.
    let mut attempt = 1u32;
    let new_rel = loop {
        let suffix = if attempt == 1 {
            " copie".to_string()
        } else {
            format!(" copie {attempt}")
        };
        let candidate_name = format!("{stem}{suffix}{ext}");
        let candidate_rel = if parent_rel.is_empty() {
            candidate_name.clone()
        } else {
            format!("{parent_rel}/{candidate_name}")
        };
        let candidate_abs = resolve_safe_path(vault, &candidate_rel)?;
        if !candidate_abs.exists() {
            break candidate_rel;
        }
        attempt += 1;
        if attempt > 100 {
            return Err("Too many duplicates — clean up the directory first".to_string());
        }
    };

    let dst = resolve_safe_path(vault, &new_rel)?;
    fs::copy(&src, &dst)
        .map_err(|e| format!("Failed to duplicate {relative}: {e}"))?;
    Ok(new_rel)
}

/// Import external markdown files into `vault` under `target_parent`.
///
/// Each source must already exist on disk and have a `.md` / `.markdown`
/// extension; anything else is rejected upfront so the call is all-or-
/// nothing (no partial imports leaving the user guessing which file
/// landed).
///
/// Naming collisions in the target directory get a ` copie` / ` copie 2`
/// suffix (same algorithm as `duplicate_file`) so the original file in
/// the vault is never silently overwritten.
///
/// Refused on readonly vaults; the target parent must already exist
/// and be a directory inside the vault.
///
/// Returns the list of new relative paths (one per imported file), in the
/// same order as the input.
pub fn import_files(
    vault: &Vault,
    source_paths: &[String],
    target_parent: &str,
) -> Result<Vec<String>, String> {
    ensure_writable(vault)?;

    let parent_abs = resolve_safe_path(vault, target_parent)?;
    if !parent_abs.exists() {
        return Err(format!("Target directory not found: {target_parent}"));
    }
    if !parent_abs.is_dir() {
        return Err(format!("Target is not a directory: {target_parent}"));
    }

    // Pre-validate every source before copying anything — we don't want a
    // partial import where the 4th file errored after the first 3 landed.
    for src_str in source_paths {
        let src = Path::new(src_str);
        if !src.exists() {
            return Err(format!("Source not found: {src_str}"));
        }
        if !src.is_file() {
            return Err(format!("Source is not a file: {src_str}"));
        }
        let ext_lower = src
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if ext_lower != "md" && ext_lower != "markdown" {
            let name = src
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            return Err(format!(
                "Only markdown files can be imported (got .{ext_lower}): {name}"
            ));
        }
    }

    // Track names taken DURING this import so the same input twice doesn't
    // collide with itself (collision detection has to look at both
    // disk-existing names AND names we just claimed in this loop).
    let mut taken: Vec<String> = Vec::new();
    let mut imported: Vec<String> = Vec::new();

    for src_str in source_paths {
        let src = Path::new(src_str);
        let stem = src
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let ext_lower = src
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let ext = format!(".{ext_lower}");

        let mut attempt = 0u32;
        let new_name = loop {
            let candidate_name = if attempt == 0 {
                format!("{stem}{ext}")
            } else if attempt == 1 {
                format!("{stem} copie{ext}")
            } else {
                format!("{stem} copie {attempt}{ext}")
            };
            let candidate_abs = parent_abs.join(&candidate_name);
            if !candidate_abs.exists() && !taken.contains(&candidate_name) {
                break candidate_name;
            }
            attempt += 1;
            if attempt > 100 {
                return Err(format!(
                    "Too many name collisions for {} — clean up the target directory",
                    src.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default()
                ));
            }
        };

        let dst = parent_abs.join(&new_name);
        fs::copy(src, &dst).map_err(|e| format!("Failed to import {src_str}: {e}"))?;

        let new_rel = if target_parent.is_empty() {
            new_name.clone()
        } else {
            format!("{target_parent}/{new_name}")
        };
        taken.push(new_name);
        imported.push(new_rel);
    }

    Ok(imported)
}

/// Reveal the file at `relative` inside `vault` in the macOS Finder.
/// Uses `open -R` directly (no extra Tauri plugin dependency). Read-only
/// operation: works regardless of the vault's readonly flag.
pub fn reveal_in_finder(vault: &Vault, relative: &str) -> Result<(), String> {
    let abs = resolve_safe_path(vault, relative)?;
    if !abs.exists() {
        return Err(format!("Path not found: {relative}"));
    }
    let abs_str = abs
        .to_str()
        .ok_or_else(|| "Path is not valid UTF-8".to_string())?;
    std::process::Command::new("open")
        .args(["-R", abs_str])
        .spawn()
        .map_err(|e| format!("Failed to invoke Finder: {e}"))?;
    Ok(())
}

/// Recursively scan a vault, returning a tree of FileEntry.
/// Returns *all* files; sidebar-level filtering decides what is shown.
/// Ignores entries starting with `.`.
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
            files.push(FileEntry {
                name,
                relative_path: child_rel,
                is_directory: false,
                children: None,
            });
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

pub fn vault_for(app: &AppHandle, id: &str) -> Result<Vault, String> {
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
pub fn folder_delete(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    delete_folder(&v, &relative_path)
}

#[tauri::command]
pub fn vault_scan(app: AppHandle, vault_id: String) -> Result<FileEntry, String> {
    let v = vault_for(&app, &vault_id)?;
    scan_vault(&v)
}

#[tauri::command]
pub fn file_duplicate(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<String, String> {
    let v = vault_for(&app, &vault_id)?;
    duplicate_file(&v, &relative_path)
}

#[tauri::command]
pub fn file_import(
    app: AppHandle,
    vault_id: String,
    source_paths: Vec<String>,
    target_parent: String,
) -> Result<Vec<String>, String> {
    let v = vault_for(&app, &vault_id)?;
    import_files(&v, &source_paths, &target_parent)
}

#[tauri::command]
pub fn file_reveal_in_finder(
    app: AppHandle,
    vault_id: String,
    relative_path: String,
) -> Result<(), String> {
    let v = vault_for(&app, &vault_id)?;
    reveal_in_finder(&v, &relative_path)
}

/// Validate that `url` is safe to hand to the system `open` helper.
/// On success, returns the trimmed string that should actually be spawned
/// (so the validation and the syscall always agree on the exact bytes).
fn validate_open_url(url: &str) -> Result<&str, String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("Refused to open empty URL".to_string());
    }
    if trimmed.chars().any(|c| c.is_control()) {
        return Err(format!("Refused to open URL with control characters: {url}"));
    }
    let lower = trimmed.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(format!("Refused to open non-http(s) URL: {url}"));
    }
    Ok(trimmed)
}

/// Open an http/https URL in the system default browser.
/// Restricted to those two schemes so this command can never be coerced into
/// running arbitrary `open`-able strings (local apps, files, etc.).
///
/// Defensive: we (a) reject any input that contains control characters
/// — including NUL bytes that could truncate the string downstream — and
/// (b) re-validate the prefix on the *same trimmed bytes we pass to
/// `open`, so the check and the syscall agree.
#[tauri::command]
pub fn url_open(url: String) -> Result<(), String> {
    let to_open = validate_open_url(&url)?;
    std::process::Command::new("open")
        .arg(to_open)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {e}"))?;
    Ok(())
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
    fn scan_returns_all_visible_files() {
        // Scan returns every file regardless of extension — the sidebar
        // applies the markdown/non-markdown visibility filter at render time.
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "");
        write_fixture(g.path(), "doc.markdown", "");
        write_fixture(g.path(), "page.mdx", "");
        write_fixture(g.path(), "notes.txt", "");
        write_fixture(g.path(), "image.png", "");
        write_fixture(g.path(), "script.py", "");
        write_fixture(g.path(), "README", "");

        let root = scan_vault(&v).expect("scan");
        assert!(root.is_directory, "scan returns root as directory");
        let children = root.children.expect("children present");
        let names: Vec<_> = children.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"note.md"));
        assert!(names.contains(&"doc.markdown"));
        assert!(names.contains(&"page.mdx"));
        assert!(names.contains(&"notes.txt"));
        assert!(names.contains(&"image.png"));
        assert!(names.contains(&"script.py"));
        assert!(names.contains(&"README"));
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

    // ============================================================
    // folder_delete (fix: EPERM on macOS when removing dirs with remove_file)
    // ============================================================

    #[test]
    fn folder_delete_removes_empty_folder() {
        let (g, v) = make_vault(VaultMode::Edit);
        create_folder(&v, "to-remove").expect("create empty folder");
        assert!(g.path().join("to-remove").is_dir());
        delete_folder(&v, "to-remove").expect("delete empty folder");
        assert!(!g.path().join("to-remove").exists());
    }

    #[test]
    fn folder_delete_removes_non_empty_folder_recursively() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "parent/note.md", "x");
        write_fixture(g.path(), "parent/sub/nested.md", "y");
        assert!(g.path().join("parent/sub/nested.md").exists());
        delete_folder(&v, "parent").expect("delete recursive");
        assert!(!g.path().join("parent").exists());
    }

    #[test]
    fn folder_delete_rejects_root_when_relative_is_empty() {
        let (g, v) = make_vault(VaultMode::Edit);
        let err = delete_folder(&v, "").expect_err("empty relative must error");
        assert!(
            err.contains("Cannot delete vault root"),
            "error must mention 'Cannot delete vault root' (got: {err})"
        );
        // Vault root must still exist after refusal.
        assert!(g.path().is_dir());
    }

    #[test]
    fn folder_delete_rejects_path_traversal() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err = delete_folder(&v, "../").expect_err("traversal must error");
        assert!(
            err.contains("Path outside vault") || err.contains("Cannot delete vault root"),
            "error must reject traversal or empty-after-clean (got: {err})"
        );
    }

    #[test]
    fn folder_delete_is_rejected_on_readonly_vault() {
        let (g, v_ro) = make_vault(VaultMode::Readonly);
        // Pre-create the folder via direct fs (bypass readonly).
        std::fs::create_dir_all(g.path().join("locked")).unwrap();
        let err = delete_folder(&v_ro, "locked").expect_err("readonly must reject");
        assert!(err.contains("Vault is readonly"));
        assert!(g.path().join("locked").is_dir(), "folder still there");
    }

    // ============================================================
    // Phase 5b — duplicate_file
    // ============================================================

    #[test]
    fn duplicate_creates_a_copy_with_copie_suffix() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "hello");
        let new_rel = duplicate_file(&v, "note.md").expect("duplicate ok");
        assert_eq!(new_rel, "note copie.md");
        assert!(g.path().join("note copie.md").exists());
        assert_eq!(fs::read_to_string(g.path().join("note copie.md")).unwrap(), "hello");
        // Source must remain.
        assert!(g.path().join("note.md").exists());
    }

    #[test]
    fn duplicate_in_subdir_keeps_parent_path() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "sub/note.md", "x");
        let new_rel = duplicate_file(&v, "sub/note.md").unwrap();
        assert_eq!(new_rel, "sub/note copie.md");
        assert!(g.path().join("sub/note copie.md").exists());
    }

    #[test]
    fn duplicate_increments_when_copy_already_exists() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "x");
        write_fixture(g.path(), "note copie.md", "x"); // pre-existing first copy
        let new_rel = duplicate_file(&v, "note.md").unwrap();
        assert_eq!(new_rel, "note copie 2.md");
        assert!(g.path().join("note copie 2.md").exists());
    }

    #[test]
    fn duplicate_rejects_on_readonly_vault() {
        let (g, v) = make_vault(VaultMode::Readonly);
        write_fixture(g.path(), "note.md", "x");
        let err = duplicate_file(&v, "note.md").expect_err("readonly must reject");
        assert!(err.contains("Vault is readonly"));
    }

    #[test]
    fn duplicate_rejects_when_source_does_not_exist() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err = duplicate_file(&v, "missing.md").expect_err("missing source must error");
        assert!(err.contains("File not found"));
    }

    #[test]
    fn duplicate_rejects_directories() {
        let (g, v) = make_vault(VaultMode::Edit);
        std::fs::create_dir(g.path().join("dir")).unwrap();
        let err = duplicate_file(&v, "dir").expect_err("directory must error");
        assert!(err.contains("Cannot duplicate a directory"));
    }

    #[test]
    fn duplicate_rejects_path_outside_vault() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err = duplicate_file(&v, "../escape.md").expect_err("traversal must error");
        assert!(err.contains("Path outside vault"));
    }

    // ============================================================
    // import_files
    // ============================================================

    /// Stage a fake "outside file" the way a Finder pick would land — in a
    /// temp dir distinct from the vault, so the source path is absolute and
    /// the vault doesn't already hold it.
    fn stage_source(content: &str, name: &str) -> (TempDir, String) {
        let dir = TempDir::new().unwrap();
        let p = dir.path().join(name);
        std::fs::write(&p, content).unwrap();
        let abs = p.to_string_lossy().to_string();
        (dir, abs)
    }

    #[test]
    fn import_copies_a_single_markdown_into_the_vault_root() {
        let (g, v) = make_vault(VaultMode::Edit);
        let (_src_dir, src_abs) = stage_source("hello", "note.md");
        let imported = import_files(&v, &[src_abs], "").expect("import ok");
        assert_eq!(imported, vec!["note.md".to_string()]);
        let dst = g.path().join("note.md");
        assert!(dst.exists());
        assert_eq!(fs::read_to_string(dst).unwrap(), "hello");
    }

    #[test]
    fn import_returns_one_relative_path_per_source_in_order() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let (_s1, a1) = stage_source("a", "alpha.md");
        let (_s2, a2) = stage_source("b", "bravo.markdown");
        let imported = import_files(&v, &[a1, a2], "").expect("import ok");
        assert_eq!(
            imported,
            vec!["alpha.md".to_string(), "bravo.markdown".to_string()]
        );
    }

    #[test]
    fn import_renames_on_collision_with_copie_suffix() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "existing");
        let (_src_dir, src_abs) = stage_source("imported", "note.md");
        let imported = import_files(&v, &[src_abs], "").unwrap();
        assert_eq!(imported, vec!["note copie.md".to_string()]);
        assert_eq!(fs::read_to_string(g.path().join("note.md")).unwrap(), "existing");
        assert_eq!(
            fs::read_to_string(g.path().join("note copie.md")).unwrap(),
            "imported"
        );
    }

    #[test]
    fn import_handles_repeated_collisions_with_incrementing_suffix() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "note.md", "0");
        write_fixture(g.path(), "note copie.md", "1");
        let (_src_dir, src_abs) = stage_source("new", "note.md");
        let imported = import_files(&v, &[src_abs], "").unwrap();
        assert_eq!(imported, vec!["note copie 2.md".to_string()]);
        assert!(g.path().join("note copie 2.md").exists());
    }

    #[test]
    fn import_avoids_same_name_collisions_within_one_call() {
        // Two sources with the same basename — the second must get a suffix
        // even though neither name existed on disk before the call started.
        let (_g, v) = make_vault(VaultMode::Edit);
        let (_s1, a1) = stage_source("first", "note.md");
        let (_s2, a2) = stage_source("second", "note.md");
        let imported = import_files(&v, &[a1, a2], "").unwrap();
        assert_eq!(
            imported,
            vec!["note.md".to_string(), "note copie.md".to_string()]
        );
    }

    #[test]
    fn import_into_a_subdirectory() {
        let (g, v) = make_vault(VaultMode::Edit);
        std::fs::create_dir(g.path().join("sub")).unwrap();
        let (_src_dir, src_abs) = stage_source("x", "note.md");
        let imported = import_files(&v, &[src_abs], "sub").unwrap();
        assert_eq!(imported, vec!["sub/note.md".to_string()]);
        assert!(g.path().join("sub/note.md").exists());
    }

    #[test]
    fn import_rejects_non_markdown_extensions() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let (_src_dir, src_abs) = stage_source("not markdown", "image.png");
        let err = import_files(&v, &[src_abs], "").expect_err("png rejected");
        assert!(err.contains("Only markdown files"));
    }

    #[test]
    fn import_rejects_missing_source() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err =
            import_files(&v, &["/tmp/does-not-exist-xyz.md".to_string()], "").expect_err("missing");
        assert!(err.contains("Source not found"));
    }

    #[test]
    fn import_rejects_when_target_parent_is_not_a_directory() {
        let (g, v) = make_vault(VaultMode::Edit);
        write_fixture(g.path(), "blocker", "x"); // file at the target path
        let (_src_dir, src_abs) = stage_source("x", "note.md");
        let err = import_files(&v, &[src_abs], "blocker").expect_err("not a dir");
        assert!(err.contains("not a directory"));
    }

    #[test]
    fn import_rejects_when_target_parent_does_not_exist() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let (_src_dir, src_abs) = stage_source("x", "note.md");
        let err = import_files(&v, &[src_abs], "does/not/exist").expect_err("missing target");
        assert!(err.contains("Target directory not found"));
    }

    #[test]
    fn import_is_rejected_on_readonly_vault() {
        let (_g, v) = make_vault(VaultMode::Readonly);
        let (_src_dir, src_abs) = stage_source("x", "note.md");
        let err = import_files(&v, &[src_abs], "").expect_err("readonly");
        assert!(err.contains("Vault is readonly"));
    }

    #[test]
    fn import_rejects_target_parent_path_traversal() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let (_src_dir, src_abs) = stage_source("x", "note.md");
        let err = import_files(&v, &[src_abs], "../escape").expect_err("traversal");
        assert!(err.contains("Path outside vault"));
    }

    #[test]
    fn import_is_atomic_on_validation_error_no_partial_copy() {
        // First source is fine, second has a bad extension. The pre-check
        // ensures NEITHER lands in the vault — the user gets a clean error
        // instead of "alpha.md got imported but image.png errored".
        let (g, v) = make_vault(VaultMode::Edit);
        let (_s1, a1) = stage_source("a", "alpha.md");
        let (_s2, a2) = stage_source("x", "image.png");
        let err = import_files(&v, &[a1, a2], "").expect_err("pre-validation");
        assert!(err.contains("Only markdown files"));
        assert!(!g.path().join("alpha.md").exists(), "partial copy must not happen");
    }

    #[test]
    fn reveal_rejects_path_outside_vault() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err = reveal_in_finder(&v, "../etc").expect_err("traversal must error");
        assert!(err.contains("Path outside vault"));
    }

    #[test]
    fn reveal_rejects_when_path_does_not_exist() {
        let (_g, v) = make_vault(VaultMode::Edit);
        let err = reveal_in_finder(&v, "missing.md").expect_err("missing must error");
        assert!(err.contains("Path not found"));
    }

    // ------ validate_open_url ------

    #[test]
    fn open_url_accepts_http_and_https() {
        assert_eq!(validate_open_url("http://example.com").unwrap(), "http://example.com");
        assert_eq!(validate_open_url("https://example.com").unwrap(), "https://example.com");
        // Mixed-case scheme — the lowercased prefix check passes, but we
        // return the original (case-preserved) trimmed bytes for `open`.
        assert_eq!(validate_open_url("HTTPS://Example.com").unwrap(), "HTTPS://Example.com");
    }

    #[test]
    fn open_url_trims_surrounding_whitespace_and_returns_trimmed_bytes() {
        // The validation result is what gets handed to `open`; the *same*
        // string is checked, so a leading-whitespace `http://...` is fine
        // (whitespace stripped) — but a leading-whitespace `file://` is not,
        // since after trim the scheme check rejects.
        let trimmed = validate_open_url("  https://safe.example.com  ").unwrap();
        assert_eq!(trimmed, "https://safe.example.com");
        validate_open_url("  file:///etc/passwd").expect_err("file:// must be rejected post-trim");
    }

    #[test]
    fn open_url_rejects_non_http_schemes() {
        validate_open_url("file:///etc/passwd").expect_err("file:// blocked");
        validate_open_url("javascript:alert(1)").expect_err("javascript: blocked");
        validate_open_url("ftp://example.com").expect_err("ftp: blocked");
        validate_open_url("data:text/plain;base64,SGVsbG8=").expect_err("data: blocked");
        validate_open_url("vscode://settings").expect_err("custom scheme blocked");
    }

    #[test]
    fn open_url_rejects_control_characters() {
        // NUL byte (would silently truncate downstream syscalls on some
        // platforms), as well as newlines / tabs that could let an attacker
        // inject a second URL or argument after the scheme check.
        validate_open_url("http://safe.com\u{0}file:///bad").expect_err("NUL blocked");
        validate_open_url("http://safe.com\nfile:///bad").expect_err("newline blocked");
        validate_open_url("http://safe.com\tfile:///bad").expect_err("tab blocked");
    }

    #[test]
    fn open_url_rejects_empty_input() {
        validate_open_url("").expect_err("empty blocked");
        validate_open_url("   ").expect_err("whitespace-only blocked");
    }
}
