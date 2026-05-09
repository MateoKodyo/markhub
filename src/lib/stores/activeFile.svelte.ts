import * as api from '$lib/tauri/api';
import { vaultsStore } from './vaults.svelte';

export type SaveStatus = 'idle' | 'loading' | 'modified' | 'saving' | 'saved' | 'error';

export type ActiveFile = {
	vaultId: string;
	relativePath: string;
};

const DEBOUNCE_MS = 1500;

class ActiveFileStore {
	activeFile = $state<ActiveFile | null>(null);
	content = $state<string>('');
	status = $state<SaveStatus>('idle');
	lastSavedAt = $state<number | null>(null);

	#saveTimer: ReturnType<typeof setTimeout> | null = null;

	async openFile(vaultId: string, relativePath: string): Promise<void> {
		this.#cancelPendingSave();
		this.status = 'loading';
		this.activeFile = { vaultId, relativePath };
		try {
			this.content = await api.fileRead(vaultId, relativePath);
			this.status = 'saved';
			this.lastSavedAt = Date.now();
			// Persist as last-opened — non-blocking, errors logged but swallowed.
			void vaultsStore.setLastOpenedFile({ vaultId, relativePath });
		} catch (e) {
			this.status = 'error';
			throw e;
		}
	}

	updateContent(newContent: string): void {
		this.content = newContent;
		// Readonly vaults silently swallow edits — no status change, no disk write.
		if (vaultsStore.isActiveVaultReadonly) return;

		this.status = 'modified';
		this.#cancelPendingSave();
		this.#saveTimer = setTimeout(() => {
			void this.#flushSave();
		}, DEBOUNCE_MS);
	}

	async forceSave(): Promise<void> {
		this.#cancelPendingSave();
		await this.#flushSave();
	}

	close(): void {
		this.#cancelPendingSave();
		this.activeFile = null;
		this.content = '';
		this.status = 'idle';
	}

	#cancelPendingSave(): void {
		if (this.#saveTimer !== null) {
			clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
		}
	}

	async #flushSave(): Promise<void> {
		if (!this.activeFile) return;
		if (vaultsStore.isActiveVaultReadonly) return;
		this.status = 'saving';
		try {
			await api.fileWrite(this.activeFile.vaultId, this.activeFile.relativePath, this.content);
			this.status = 'saved';
			this.lastSavedAt = Date.now();
		} catch (e) {
			this.status = 'error';
			throw e;
		}
	}
}

export const activeFileStore = new ActiveFileStore();
