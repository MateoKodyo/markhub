// Typed wrappers around Tauri invoke. ALL frontend access to Rust commands
// goes through this module — components/stores never call invoke() directly.

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
	Config,
	FileEntry,
	SearchMatch,
	SearchOptions,
	UserSettings,
	Vault,
	VaultMode
} from './types';

export const configLoad = (): Promise<Config> => invoke('config_load');

export const configSave = (config: Config): Promise<void> =>
	invoke('config_save', { config });

export const vaultAdd = (
	name: string,
	path: string,
	mode: VaultMode,
	color: string
): Promise<Vault> => invoke('vault_add', { name, path, mode, color });

export const vaultRemove = (id: string): Promise<void> => invoke('vault_remove', { id });

export const vaultUpdate = (
	id: string,
	name?: string,
	mode?: VaultMode
): Promise<Vault> => invoke('vault_update', { id, name, mode });

/**
 * Use the official JS dialog plugin directly — bypasses our Rust wrapper which
 * had main-thread / async issues on macOS. This is the canonical Tauri 2 way.
 */
export const vaultPickDirectory = async (): Promise<string | null> => {
	const result = await open({ directory: true, multiple: false });
	if (typeof result === 'string') return result;
	return null;
};

/** Create a new empty directory at `parentDir/name` and register it as a vault. */
export const vaultCreate = (
	parentDir: string,
	name: string,
	mode: VaultMode,
	color: string
): Promise<Vault> => invoke('vault_create', { parentDir, name, mode, color });

/** Create a vault and seed it with welcome markdown files for onboarding. */
export const vaultCreateSample = (
	parentDir: string,
	name: string,
	mode: VaultMode,
	color: string
): Promise<Vault> => invoke('vault_create_sample', { parentDir, name, mode, color });

/** Clone a remote git repository into `parentDir/<derived-name>` and register it. */
export const vaultCloneGit = (
	parentDir: string,
	repoUrl: string,
	mode: VaultMode,
	color: string
): Promise<Vault> => invoke('vault_clone_git', { parentDir, repoUrl, mode, color });

export const vaultScan = (vaultId: string): Promise<FileEntry> =>
	invoke('vault_scan', { vaultId });

export const fileRead = (vaultId: string, relativePath: string): Promise<string> =>
	invoke('file_read', { vaultId, relativePath });

export const fileWrite = (
	vaultId: string,
	relativePath: string,
	content: string
): Promise<void> => invoke('file_write', { vaultId, relativePath, content });

export const fileCreate = (vaultId: string, relativePath: string): Promise<void> =>
	invoke('file_create', { vaultId, relativePath });

export const fileDelete = (vaultId: string, relativePath: string): Promise<void> =>
	invoke('file_delete', { vaultId, relativePath });

export const fileRename = (
	vaultId: string,
	oldPath: string,
	newPath: string
): Promise<void> => invoke('file_rename', { vaultId, oldPath, newPath });

export const folderCreate = (vaultId: string, relativePath: string): Promise<void> =>
	invoke('folder_create', { vaultId, relativePath });

/** Recursively delete a folder inside the vault. Refused on the vault root and on readonly vaults. */
export const folderDelete = (vaultId: string, relativePath: string): Promise<void> =>
	invoke('folder_delete', { vaultId, relativePath });

/** Duplicate a file with " copie" / " copie 2" / … suffix. Returns the new relative path. */
export const fileDuplicate = (
	vaultId: string,
	relativePath: string
): Promise<string> => invoke('file_duplicate', { vaultId, relativePath });

/**
 * Import external markdown files into the vault under `targetParent`
 * (empty string = vault root). Only `.md` / `.markdown` extensions are
 * accepted; collisions in the target directory get a " copie" / " copie 2"
 * suffix. Returns the list of new relative paths.
 */
export const fileImport = (
	vaultId: string,
	sourcePaths: string[],
	targetParent: string
): Promise<string[]> =>
	invoke('file_import', { vaultId, sourcePaths, targetParent });

/** Reveal a file or folder in the macOS Finder (no plugin dependency). */
export const fileRevealInFinder = (
	vaultId: string,
	relativePath: string
): Promise<void> => invoke('file_reveal_in_finder', { vaultId, relativePath });

/** Open an http/https URL in the system default browser. */
export const urlOpen = (url: string): Promise<void> => invoke('url_open', { url });

/**
 * Read user settings from `settings.json`. Returns defaults if the file is
 * missing; the Rust side falls back to defaults on malformed JSON too (and
 * backs the broken file up to `.bak` — see `commands::settings::load_settings_from_path`).
 */
export const settingsRead = (): Promise<UserSettings> => invoke('settings_read');

/**
 * Persist user settings atomically (write to .tmp, rename). Rust returns Err
 * only on a real filesystem failure — schema validation happens at the type
 * boundary on the JS side, so a well-typed `UserSettings` always serializes.
 */
export const settingsWrite = (settings: UserSettings): Promise<void> =>
	invoke('settings_write', { settings });

/** Compile-time version baked into the Rust binary (matches Cargo.toml). */
export const appVersion = (): Promise<string> => invoke('app_version');

/**
 * Read the per-file frontmatter collapsed-state map from disk
 * (`<config-dir>/frontmatter-state.json`). Returns an empty object when
 * missing / unreadable / malformed — collapsed state is cosmetic so a
 * failure here must never block the app.
 */
export const frontmatterStateRead = (): Promise<Record<string, boolean>> =>
	invoke('frontmatter_state_read');

/**
 * Atomically persist the per-file frontmatter collapsed-state map. The
 * caller debounces writes; the Rust side does an atomic tmp+rename.
 */
export const frontmatterStateWrite = (
	state: Record<string, boolean>
): Promise<void> => invoke('frontmatter_state_write', { state });

/** Open the on-disk config directory in Finder (creates it if missing). */
export const settingsConfigFolderReveal = (): Promise<void> =>
	invoke('settings_config_folder_reveal');

/** Export the supplied settings to an arbitrary path (atomic write). */
export const settingsExport = (
	targetPath: string,
	settings: UserSettings
): Promise<void> => invoke('settings_export', { targetPath, settings });

/** Import a settings JSON from an arbitrary path. Strict: surfaces parse
 *  errors so the user sees what failed (unlike the regular load path,
 *  which silently falls back to defaults on a corrupt file). */
export const settingsImport = (sourcePath: string): Promise<UserSettings> =>
	invoke('settings_import', { sourcePath });

/**
 * Vault-wide content search backing Cmd+Shift+F. Walks the vault with
 * .gitignore + hidden-dir filters, scans .md / .markdown files only,
 * caps the result at 200 files / 100 hits per file. Returns matches
 * grouped by file. An empty query short-circuits to `[]`.
 */
export const searchInVault = (
	vaultId: string,
	query: string,
	options: SearchOptions
): Promise<SearchMatch[]> =>
	invoke('search_in_vault', { vaultId, query, options });
