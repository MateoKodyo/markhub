// Typed wrappers around Tauri invoke. ALL frontend access to Rust commands
// goes through this module — components/stores never call invoke() directly.

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { Config, FileEntry, Vault, VaultMode } from './types';

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

/** Duplicate a file with " copie" / " copie 2" / … suffix. Returns the new relative path. */
export const fileDuplicate = (
	vaultId: string,
	relativePath: string
): Promise<string> => invoke('file_duplicate', { vaultId, relativePath });

/** Reveal a file or folder in the macOS Finder (no plugin dependency). */
export const fileRevealInFinder = (
	vaultId: string,
	relativePath: string
): Promise<void> => invoke('file_reveal_in_finder', { vaultId, relativePath });
