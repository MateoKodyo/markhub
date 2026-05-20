/**
 * Recent files — MRU of recently-opened files, scoped per vault by way
 * of a composite `vaultId::relativePath` key. Powers File mode's
 * "recent first when query is empty" ranking.
 *
 * Storage: a single JSON array under `markus.files.recent.v1`. Cap 20.
 * Dedupes on re-record. Hydration is tolerant — non-array payloads and
 * entries missing fields are silently dropped.
 */

import type { LastOpenedFile } from '$lib/tauri/types';
import { migrateLsKey } from '$lib/utils/migrateLsKey';

const LS_KEY = 'markus.files.recent.v1';

// Markhub → Markus rename (2026-05-20): carry the MRU forward.
migrateLsKey('markhub.files.recent.v1', LS_KEY);
const CAP = 20;

const keyOf = (e: LastOpenedFile) => `${e.vaultId}::${e.relativePath}`;

function isLastOpenedFile(x: unknown): x is LastOpenedFile {
	if (!x || typeof x !== 'object') return false;
	const o = x as Record<string, unknown>;
	return typeof o.vaultId === 'string' && typeof o.relativePath === 'string';
}

class RecentFilesStore {
	#entries = $state<LastOpenedFile[]>([]);

	hydrate(): void {
		this.#entries = [];
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				this.#entries = parsed.filter(isLastOpenedFile).slice(0, CAP);
			}
		} catch {
			/* silently reset on malformed payload */
		}
	}

	record(entry: LastOpenedFile): void {
		const k = keyOf(entry);
		this.#entries = [entry, ...this.#entries.filter((e) => keyOf(e) !== k)].slice(
			0,
			CAP
		);
		this.#persist();
	}

	getRecent(): LastOpenedFile[] {
		return this.#entries.slice();
	}

	clear(): void {
		this.#entries = [];
		if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
	}

	#persist(): void {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(LS_KEY, JSON.stringify(this.#entries));
	}
}

export const recentFilesStore = new RecentFilesStore();
