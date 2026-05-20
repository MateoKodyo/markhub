import * as api from '$lib/tauri/api';
import { aiAwareStore } from './aiAware.svelte';
import { settingsStore } from './settings.svelte';
import { toast } from './toast.svelte';
import { vaultsStore } from './vaults.svelte';

export type SaveStatus = 'idle' | 'loading' | 'modified' | 'saving' | 'saved' | 'error';

export type ActiveFile = {
	vaultId: string;
	relativePath: string;
};

export type Tab = {
	id: string;
	vaultId: string;
	relativePath: string;
	content: string;
	status: SaveStatus;
	lastSavedAt: number | null;
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

let nextTabId = 1;
function generateTabId(): string {
	return `tab-${nextTabId++}-${Date.now()}`;
}

/**
 * Tab-aware file store — what used to be a single-file singleton is now an
 * ordered list of open tabs with one active at a time. The historical API
 * (`activeFile`, `content`, `status`, `lastSavedAt`, `openFile`,
 * `updateContent`, `forceSave`, `close`) keeps its shape so existing
 * consumers (Sidebar, Editor, +page, palette, StatusBar) compile without
 * changes — the difference is that operations now flow through the active
 * tab. New API on top: `tabs`, `activeTabId`, `activateTab`, `closeTab`,
 * `closeActiveTab`, `reorderTabs`.
 *
 * Opening a file that's already in a tab activates that tab rather than
 * creating a duplicate (universal convention; "always-new-tab" only makes
 * sense when the file can carry independent state, which markdown can't).
 */
class TabsStore {
	tabs = $state<Tab[]>([]);
	activeTabId = $state<string | null>(null);

	#saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
	// Per-open request guard so A→B→C rapid clicks always resolve on the
	// latest target, not whichever fileRead happens to finish first.
	#openRequestId = 0;

	get activeTab(): Tab | null {
		return this.tabs.find((t) => t.id === this.activeTabId) ?? null;
	}

	get activeFile(): ActiveFile | null {
		const t = this.activeTab;
		return t ? { vaultId: t.vaultId, relativePath: t.relativePath } : null;
	}

	get content(): string {
		return this.activeTab?.content ?? '';
	}

	get status(): SaveStatus {
		return this.activeTab?.status ?? 'idle';
	}

	get lastSavedAt(): number | null {
		return this.activeTab?.lastSavedAt ?? null;
	}

	#findTab(vaultId: string, relativePath: string): Tab | null {
		return (
			this.tabs.find(
				(t) => t.vaultId === vaultId && t.relativePath === relativePath
			) ?? null
		);
	}

	#updateTab(id: string, patch: Partial<Tab>): void {
		this.tabs = this.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t));
	}

	async openFile(vaultId: string, relativePath: string): Promise<void> {
		const myRequestId = ++this.#openRequestId;

		// Same-file dedupe — activate the existing tab rather than spawning
		// a clone. Saves the user from accumulating identical tabs by
		// re-clicking the sidebar.
		const existing = this.#findTab(vaultId, relativePath);
		if (existing) {
			this.activeTabId = existing.id;
			void vaultsStore.setLastOpenedFile({ vaultId, relativePath });
			return;
		}

		// Flush any pending autosave on the CURRENTLY active tab before
		// the switch — otherwise an in-flight edit on the previous tab
		// would silently die when the timer is cancelled.
		const previouslyActive = this.activeTab;
		if (previouslyActive && previouslyActive.status === 'modified') {
			try {
				await this.#flushSave(previouslyActive.id);
			} catch (e) {
				console.warn('[activeFile] flush before tab switch failed', e);
			}
		}
		this.#cancelPendingSave(this.activeTabId);

		// Atomic open: we don't insert the new tab nor flip activeTabId
		// until fileRead resolves. This preserves the invariant that the
		// editor never sees `activeFile` pointing at a tab whose content
		// hasn't loaded — and the staleness guard handles A→B→C rapid
		// clicks (only the latest myRequestId wins).
		try {
			const newContent = await api.fileRead(vaultId, relativePath);
			if (myRequestId !== this.#openRequestId) return; // stale, dropped
			const newId = generateTabId();
			const newTab: Tab = {
				id: newId,
				vaultId,
				relativePath,
				content: newContent,
				status: 'saved',
				lastSavedAt: Date.now()
			};
			this.tabs = [...this.tabs, newTab];
			this.activeTabId = newId;
			void vaultsStore.setLastOpenedFile({ vaultId, relativePath });
		} catch (e) {
			if (myRequestId !== this.#openRequestId) return;
			throw e;
		}
	}

	updateContent(newContent: string): void {
		const t = this.activeTab;
		if (!t) return;
		if (vaultsStore.isActiveVaultReadonly) return;
		this.#updateTab(t.id, { content: newContent, status: 'modified' });
		this.#cancelPendingSave(t.id);
		const timer = setTimeout(() => {
			void this.#flushSave(t.id);
		}, autosaveDelayMs());
		this.#saveTimers.set(t.id, timer);
	}

	async forceSave(): Promise<void> {
		const id = this.activeTabId;
		if (!id) return;
		this.#cancelPendingSave(id);
		await this.#flushSave(id);
	}

	/**
	 * Close-all helper — kept for callers that historically wanted to
	 * "close the open file" (e.g. a vault being removed). Now closes
	 * every tab whose vault matches; with no arg, every tab.
	 */
	close(): void {
		for (const t of this.tabs) {
			this.#cancelPendingSave(t.id);
		}
		this.tabs = [];
		this.activeTabId = null;
	}

	closeTab(id: string): void {
		const idx = this.tabs.findIndex((t) => t.id === id);
		if (idx < 0) return;
		this.#cancelPendingSave(id);
		const next = this.tabs.filter((t) => t.id !== id);
		this.tabs = next;
		// Pick a sensible neighbour to activate if we just closed the
		// active tab — prefer the one to the left, fall back to the right.
		if (this.activeTabId === id) {
			if (next.length === 0) {
				this.activeTabId = null;
			} else {
				const fallback = next[Math.max(0, idx - 1)] ?? next[0];
				this.activeTabId = fallback.id;
			}
		}
	}

	closeActiveTab(): void {
		if (this.activeTabId) this.closeTab(this.activeTabId);
	}

	activateTab(id: string): void {
		if (this.tabs.some((t) => t.id === id)) {
			this.activeTabId = id;
			const t = this.activeTab;
			if (t) {
				void vaultsStore.setLastOpenedFile({
					vaultId: t.vaultId,
					relativePath: t.relativePath
				});
			}
		}
	}

	/** Activate the tab at the given 1-based index (used by Cmd+1..9). */
	activateTabAtIndex(oneBasedIndex: number): void {
		if (oneBasedIndex < 1) return;
		const t = this.tabs[oneBasedIndex - 1];
		if (t) this.activateTab(t.id);
	}

	/** Move the tab at `fromIdx` to `toIdx`. Indices are clamped. */
	reorderTabs(fromIdx: number, toIdx: number): void {
		if (fromIdx < 0 || fromIdx >= this.tabs.length) return;
		const clampedTo = Math.max(0, Math.min(toIdx, this.tabs.length - 1));
		if (fromIdx === clampedTo) return;
		const next = this.tabs.slice();
		const [moved] = next.splice(fromIdx, 1);
		next.splice(clampedTo, 0, moved);
		this.tabs = next;
	}

	#cancelPendingSave(id: string | null): void {
		if (!id) return;
		const timer = this.#saveTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.#saveTimers.delete(id);
		}
	}

	async #flushSave(id: string): Promise<void> {
		const t = this.tabs.find((x) => x.id === id);
		if (!t) return;
		if (vaultsStore.isActiveVaultReadonly) return;
		this.#updateTab(id, { status: 'saving' });
		try {
			await api.fileWrite(t.vaultId, t.relativePath, t.content);
			this.#updateTab(id, { status: 'saved', lastSavedAt: Date.now() });
			// A save mutates content without re-scanning the tree — re-detect
			// this file so an added/removed `audience:` marker is reflected.
			// Guarded to the active vault: aiAwareStore tracks one vault's scan.
			if (t.vaultId === vaultsStore.activeVaultId) {
				aiAwareStore.updateForFile(t.relativePath, t.content);
			}
		} catch (e) {
			this.#updateTab(id, { status: 'error' });
			// Sticky toast — auto-dismiss is too quiet for a write failure.
			toast.error('Sauvegarde échouée', {
				details: String(e),
				duration: 0
			});
			throw e;
		}
	}
}

export const activeFileStore = new TabsStore();
