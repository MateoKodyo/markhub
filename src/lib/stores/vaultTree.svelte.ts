/**
 * VaultTree store — shared, reactive view of the active vault's file
 * tree. The palette's File mode needs a flat list of markdown files
 * without ferreting Sidebar's private state out, so we keep this scan
 * separate.
 *
 * The store re-scans whenever `vaultsStore.activeVaultId` changes (via a
 * consumer-side `$effect` set up at app boot — see `+layout.svelte`).
 * Mutations to the file system (create/delete/rename/import) call
 * `refresh()` so the palette sees fresh paths immediately.
 *
 * Today, both Sidebar and this store scan independently when the vault
 * switches — there's some redundant API work, but the cost is small
 * enough (a single tree walk) that we accept it rather than couple the
 * two surfaces. Consolidating them is a fair follow-up.
 */

import * as api from '$lib/tauri/api';
import type { FileEntry } from '$lib/tauri/types';
import { vaultsStore } from './vaults.svelte';
import type { FilePaletteEntry } from '$lib/commands/fuzzyFiles';

const MD_EXTENSIONS = new Set(['md', 'markdown']);

function flatten(
	vaultId: string,
	tree: FileEntry | null
): FilePaletteEntry[] {
	if (!tree) return [];
	const out: FilePaletteEntry[] = [];
	const walk = (entry: FileEntry) => {
		if (entry.isDirectory) {
			entry.children?.forEach(walk);
			return;
		}
		const dot = entry.name.lastIndexOf('.');
		const ext = dot >= 0 ? entry.name.slice(dot + 1).toLowerCase() : '';
		if (!MD_EXTENSIONS.has(ext)) return;
		out.push({
			vaultId,
			relativePath: entry.relativePath,
			name: entry.name
		});
	};
	walk(tree);
	return out;
}

class VaultTreeStore {
	#root = $state<FileEntry | null>(null);
	#scannedVaultId: string | null = null;
	#loading = $state(false);

	get root(): FileEntry | null {
		return this.#root;
	}

	get loading(): boolean {
		return this.#loading;
	}

	/** Flat list of markdown files in the active vault. */
	files = $derived.by<FilePaletteEntry[]>(() => {
		const id = vaultsStore.activeVaultId;
		if (!id) return [];
		return flatten(id, this.#root);
	});

	/** Re-scan if the active vault is set and the cached root is stale. */
	async refresh(): Promise<void> {
		const id = vaultsStore.activeVaultId;
		if (!id) {
			this.#root = null;
			this.#scannedVaultId = null;
			return;
		}
		this.#loading = true;
		try {
			this.#root = await api.vaultScan(id);
			this.#scannedVaultId = id;
		} catch {
			// Tolerate scan failures here — Sidebar surfaces them; the palette
			// just shows "no files" in that case.
			this.#root = null;
			this.#scannedVaultId = null;
		} finally {
			this.#loading = false;
		}
	}

	/** True when our cached root matches the current activeVaultId. */
	get fresh(): boolean {
		return this.#scannedVaultId === vaultsStore.activeVaultId;
	}
}

export const vaultTreeStore = new VaultTreeStore();
