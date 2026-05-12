import * as api from '$lib/tauri/api';
import { settingsStore } from './settings.svelte';
import { vaultsStore } from './vaults.svelte';

export type SaveStatus = 'idle' | 'loading' | 'modified' | 'saving' | 'saved' | 'error';

export type ActiveFile = {
	vaultId: string;
	relativePath: string;
};

/**
 * Fallback debounce — used until the user settings have been loaded from
 * disk. After hydration, the real value comes from
 * `settingsStore.current.editor.autosaveDelayMs`.
 */
const DEFAULT_DEBOUNCE_MS = 1500;

function autosaveDelayMs(): number {
	return settingsStore.current?.editor?.autosaveDelayMs ?? DEFAULT_DEBOUNCE_MS;
}

class ActiveFileStore {
	activeFile = $state<ActiveFile | null>(null);
	content = $state<string>('');
	status = $state<SaveStatus>('idle');
	lastSavedAt = $state<number | null>(null);

	#saveTimer: ReturnType<typeof setTimeout> | null = null;

	// Monotonic open-request counter. Each call to `openFile` claims a fresh ID;
	// when the awaited fileRead resolves, the result is only applied if no newer
	// call has been issued in the meantime. Without this, A→B→C rapid clicks
	// could end up showing A or B when C's read happens to finish first.
	#openRequestId = 0;

	async openFile(vaultId: string, relativePath: string): Promise<void> {
		const myRequestId = ++this.#openRequestId;
		this.#cancelPendingSave();
		this.status = 'loading';
		try {
			const newContent = await api.fileRead(vaultId, relativePath);
			// Stale: a newer openFile call has started since this one began.
			if (myRequestId !== this.#openRequestId) return;
			// Atomic update — activeFile and content move together, AFTER the read,
			// so the {#key editorKey} in +page.svelte remounts Editor with the
			// correct content already in place. Fixes the race where the editor
			// captured stale content via untrack() at mount.
			this.activeFile = { vaultId, relativePath };
			this.content = newContent;
			this.status = 'saved';
			this.lastSavedAt = Date.now();
			void vaultsStore.setLastOpenedFile({ vaultId, relativePath });
		} catch (e) {
			// Same staleness guard for errors: only the latest request controls UI.
			if (myRequestId !== this.#openRequestId) return;
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
		}, autosaveDelayMs());
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
