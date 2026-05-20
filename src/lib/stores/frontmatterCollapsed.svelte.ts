/**
 * Per-file collapsed state for the FrontmatterBlock.
 *
 * Map of `fileKey -> collapsed:boolean` persisted to disk under the Tauri
 * app config dir (`frontmatter-state.json`). The fileKey is composed by the
 * caller — typically `vaultId::relativePath` — to avoid collisions across
 * vaults.
 *
 * Default when a file has no recorded state: collapsed (true) — quiet by
 * default. Toggling writes synchronously to the in-memory cache + schedules
 * a debounced flush to disk (300ms), matching the autosave rhythm so a
 * burst of toggles produces a single write.
 *
 * PLAN-FRONTMATTER-UI STEP 6 migrated this from localStorage to disk.
 * On the first `init()` after the upgrade, any existing localStorage data
 * is read and migrated into the disk map, then the legacy key is removed.
 */

import * as api from '$lib/tauri/api';

// Legacy localStorage key from BEFORE the disk-backed migration
// (PLAN-FRONTMATTER-UI STEP 6). Deliberately keeps the `markhub.` prefix
// — it is a historical key read once to drain pre-disk data; renaming it
// would break that one-way bridge. Not an active storage key.
const LEGACY_LOCALSTORAGE_KEY = 'markhub.frontmatter.collapsed.v1';
const PERSIST_DEBOUNCE_MS = 300;

let cache: Record<string, boolean> = {};
let initialized = false;
let initInFlight: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isPlainBoolMap(value: unknown): value is Record<string, boolean> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	for (const v of Object.values(value)) {
		if (typeof v !== 'boolean') return false;
	}
	return true;
}

function readLocalStorageLegacy(): Record<string, boolean> | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isPlainBoolMap(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function clearLocalStorageLegacy(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
	} catch {
		/* ignore */
	}
}

/**
 * Hydrate the in-memory cache from disk. Safe to call multiple times — the
 * second call resolves to the same in-flight promise. Must be awaited at
 * app boot so the FrontmatterBlock's synchronous `getCollapsed` reads the
 * persisted state instead of every file starting collapsed-by-default.
 */
export function init(): Promise<void> {
	if (initialized) return Promise.resolve();
	if (initInFlight) return initInFlight;
	initInFlight = (async () => {
		try {
			const fromDisk = await api.frontmatterStateRead();
			if (isPlainBoolMap(fromDisk)) {
				cache = fromDisk;
			}
		} catch (e) {
			console.warn('[frontmatter-state] failed to load — empty map', e);
		}
		// One-shot migration: an upgrading user has their old localStorage
		// data; copy it into the disk map and remove the legacy key. Disk
		// data wins on conflict — if both exist the user has already used
		// the new version at least once and the disk reflects intent.
		const legacy = readLocalStorageLegacy();
		if (legacy) {
			let copied = false;
			for (const [k, v] of Object.entries(legacy)) {
				if (!(k in cache)) {
					cache[k] = v;
					copied = true;
				}
			}
			clearLocalStorageLegacy();
			if (copied) schedulePersist();
		}
		initialized = true;
		initInFlight = null;
	})();
	return initInFlight;
}

function schedulePersist(): void {
	if (persistTimer !== null) clearTimeout(persistTimer);
	persistTimer = setTimeout(() => {
		persistTimer = null;
		api.frontmatterStateWrite({ ...cache }).catch((e) =>
			console.warn('[frontmatter-state] persist failed', e)
		);
	}, PERSIST_DEBOUNCE_MS);
}

/** Return the recorded collapsed state for a file, or `true` (default). */
export function getCollapsed(fileKey: string): boolean {
	return cache[fileKey] ?? true;
}

/** Persist the collapsed state for a file. Default-equal writes are kept
 *  so a user that explicitly re-collapses doesn't get the entry pruned. */
export function setCollapsed(fileKey: string, value: boolean): void {
	if (cache[fileKey] === value) return;
	cache[fileKey] = value;
	schedulePersist();
}

/** Test-only: flush any pending persist and reset the cache. */
export async function flushForTest(): Promise<void> {
	if (persistTimer !== null) {
		clearTimeout(persistTimer);
		persistTimer = null;
		await api.frontmatterStateWrite({ ...cache });
	}
}

/** Test-only: reset cache + init flag + clear any pending persist. */
export function resetForTest(): void {
	if (persistTimer !== null) {
		clearTimeout(persistTimer);
		persistTimer = null;
	}
	cache = {};
	initialized = false;
	initInFlight = null;
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
		} catch {
			/* ignore */
		}
	}
}
