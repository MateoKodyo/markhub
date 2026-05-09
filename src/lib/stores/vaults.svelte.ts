import * as api from '$lib/tauri/api';
import { getFileName } from '$lib/utils/path';
import { pickNextColor } from '$lib/utils/palette';
import type { LastOpenedFile, Settings, Vault, VaultMode } from '$lib/tauri/types';

class VaultsStore {
	vaults = $state<Vault[]>([]);
	activeVaultId = $state<string | null>(null);
	lastOpenedFile = $state<LastOpenedFile | null>(null);
	settings = $state<Settings>({ autoSaveDelayMs: 1500, theme: 'system' });

	activeVault = $derived(this.vaults.find((v) => v.id === this.activeVaultId));
	isActiveVaultReadonly = $derived(this.activeVault?.mode === 'readonly');

	async load(): Promise<void> {
		const cfg = await api.configLoad();
		this.vaults = cfg.vaults;
		this.lastOpenedFile = cfg.lastOpenedFile;
		this.settings = cfg.settings;
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
		try {
			await api.configSave({
				version: 1,
				vaults: this.vaults,
				lastOpenedFile: lof,
				settings: this.settings
			});
		} catch (e) {
			// Persistence failures shouldn't break the open flow.
			console.warn('[vaultsStore] Failed to persist lastOpenedFile', e);
		}
	}
}

export const vaultsStore = new VaultsStore();
