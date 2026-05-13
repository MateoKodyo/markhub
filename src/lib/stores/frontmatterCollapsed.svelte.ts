/**
 * Per-file collapsed state for the FrontmatterBlock.
 *
 * Lightweight localStorage-backed map of `fileKey -> collapsed:boolean`.
 * The fileKey is composed by the caller — typically `vaultId::relativePath`
 * — to ensure collisions across vaults don't share state.
 *
 * Default when a file has no recorded state: collapsed (true) — quiet by
 * default. Toggling persists immediately (no debounce — the write is a
 * single small object).
 *
 * STEP 6 of PLAN-FRONTMATTER-UI moves persistence to the Tauri app config
 * dir alongside other per-file state. For now localStorage is sufficient
 * — single-user desktop, no sync.
 */

const STORAGE_KEY = 'markhub.frontmatter.collapsed.v1';

let cache: Record<string, boolean> | null = null;

function load(): Record<string, boolean> {
	if (cache !== null) return cache;
	if (typeof localStorage === 'undefined') {
		cache = {};
		return cache;
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			cache = {};
			return cache;
		}
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			cache = parsed as Record<string, boolean>;
			return cache;
		}
	} catch {
		// Corrupt JSON — discard, start over.
	}
	cache = {};
	return cache;
}

function persist(): void {
	if (typeof localStorage === 'undefined' || cache === null) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
	} catch {
		// Quota exceeded or storage disabled — silently drop.
	}
}

/** Return the recorded collapsed state for a file, or `true` (default). */
export function getCollapsed(fileKey: string): boolean {
	const map = load();
	return map[fileKey] ?? true;
}

/** Persist the collapsed state for a file. Default-equal writes are kept
 *  so a user that explicitly re-collapses doesn't get the entry pruned
 *  (which would silently change semantics if the default ever flips). */
export function setCollapsed(fileKey: string, value: boolean): void {
	const map = load();
	if (map[fileKey] === value) return;
	map[fileKey] = value;
	persist();
}

/** Test-only: reset both the in-memory cache and localStorage. */
export function resetForTest(): void {
	cache = {};
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* ignore */
		}
	}
}
