import * as api from '$lib/tauri/api';
import { getFileName } from '$lib/utils/path';
import { pickNextColor } from '$lib/utils/palette';
import { toggleExpanded } from '$lib/utils/tree';
import type {
	LastOpenedFile,
	Settings,
	Vault,
	VaultMode,
	VaultState
} from '$lib/tauri/types';

class VaultsStore {
	vaults = $state<Vault[]>([]);
	activeVaultId = $state<string | null>(null);
	lastOpenedFile = $state<LastOpenedFile | null>(null);
	settings = $state<Settings>({ autoSaveDelayMs: 1500, theme: 'system' });
	vaultStates = $state<Record<string, VaultState>>({});

	activeVault = $derived(this.vaults.find((v) => v.id === this.activeVaultId));
	isActiveVaultReadonly = $derived(this.activeVault?.mode === 'readonly');

	async load(): Promise<void> {
		const cfg = await api.configLoad();
		this.vaults = cfg.vaults;
		this.lastOpenedFile = cfg.lastOpenedFile;
		this.settings = cfg.settings;
		// Tauri's serde may emit `null` for missing maps when older configs are loaded.
		this.vaultStates = cfg.vaultStates ?? {};
	}

	async addVault(
		name: string,
		path: string,
		mode: VaultMode,
		color: string
	): Promise<Vault> {
		const v = await api.vaultAdd(name, path, mode, color);
		this.vaults.push(v);
		return v;
	}

	/**
	 * Direct add-vault flow (Phase 5 redesign):
	 * native picker → if cancelled, no-op. If picked, derive name = basename(path),
	 * mode = 'edit', color = next palette slot, then create the vault and select it.
	 */
	async addVaultFromPicker(): Promise<Vault | null> {
		const path = await api.vaultPickDirectory();
		if (!path) return null;
		const name = getFileName(path);
		const color = pickNextColor(this.vaults.length);
		const v = await this.addVault(name, path, 'edit', color);
		this.selectVault(v.id);
		return v;
	}

	async removeVault(id: string): Promise<void> {
		await api.vaultRemove(id);
		this.vaults = this.vaults.filter((v) => v.id !== id);
		if (this.activeVaultId === id) {
			this.activeVaultId = null;
		}
		// Clean orphaned UI state for the removed vault.
		if (id in this.vaultStates) {
			const next = { ...this.vaultStates };
			delete next[id];
			this.vaultStates = next;
		}
	}

	expandedFoldersFor(vaultId: string): Set<string> {
		const list = this.vaultStates[vaultId]?.expandedFolders ?? [];
		return new Set(list);
	}

	/**
	 * Toggle a folder's expansion in the active vault and persist immediately.
	 * Persisting on every toggle is fine for MVP: the config is small JSON.
	 */
	async toggleFolderExpansion(vaultId: string, relativePath: string): Promise<void> {
		const current = this.vaultStates[vaultId]?.expandedFolders ?? [];
		const next = toggleExpanded(current, relativePath);
		this.vaultStates = {
			...this.vaultStates,
			[vaultId]: { expandedFolders: next }
		};
		await this.#persistConfig();
	}

	/**
	 * Replace the expanded list for a vault — used by the prune step that runs
	 * after a scan to remove paths that no longer exist on disk.
	 */
	async setExpandedFolders(vaultId: string, paths: string[]): Promise<void> {
		const current = this.vaultStates[vaultId]?.expandedFolders ?? [];
		// Skip the write if nothing changed (avoids a useless config_save).
		if (current.length === paths.length && current.every((p, i) => p === paths[i])) {
			return;
		}
		this.vaultStates = {
			...this.vaultStates,
			[vaultId]: { expandedFolders: paths }
		};
		await this.#persistConfig();
	}

	async #persistConfig(): Promise<void> {
		try {
			await api.configSave({
				version: 1,
				vaults: this.vaults,
				lastOpenedFile: this.lastOpenedFile,
				settings: this.settings,
				vaultStates: this.vaultStates
			});
		} catch (e) {
			console.warn('[vaultsStore] Failed to persist config', e);
		}
	}

	async updateVault(
		id: string,
		patch: { name?: string; mode?: VaultMode }
	): Promise<Vault> {
		const updated = await api.vaultUpdate(id, patch.name, patch.mode);
		const idx = this.vaults.findIndex((v) => v.id === id);
		if (idx >= 0) {
			this.vaults[idx] = updated;
		}
		return updated;
	}

	selectVault(id: string): void {
		this.activeVaultId = id;
	}

	/**
	 * Persist the current last-opened file. Saves the whole config since that's
	 * the only Rust command we have for writing config (config_save).
	 */
	async setLastOpenedFile(lof: LastOpenedFile | null): Promise<void> {
		this.lastOpenedFile = lof;
		await this.#persistConfig();
	}
}

export const vaultsStore = new VaultsStore();
