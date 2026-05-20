/**
 * Recent commands — small persistent MRU list of command IDs, used by
 * Command mode to surface frequently-invoked actions at the top when the
 * query is empty.
 *
 * Storage: a single JSON-encoded array under `markus.commands.recent.v1`.
 * Cap: 10. Dedupes on re-record so the same command bubbling back up
 * doesn't create duplicates. Hydration is tolerant — malformed payloads
 * silently reset to an empty list rather than throwing on boot.
 */

import { migrateLsKey } from '$lib/utils/migrateLsKey';

const LS_KEY = 'markus.commands.recent.v1';

// Markhub → Markus rename (2026-05-20): carry the MRU forward.
migrateLsKey('markhub.commands.recent.v1', LS_KEY);
const CAP = 10;

class RecentCommandsStore {
	#ids = $state<string[]>([]);

	hydrate(): void {
		this.#ids = [];
		if (typeof localStorage === 'undefined') return;
		const raw = localStorage.getItem(LS_KEY);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
				this.#ids = parsed.slice(0, CAP);
			}
		} catch {
			// Malformed payload — leave the list empty rather than blow up.
		}
	}

	record(id: string): void {
		this.#ids = [id, ...this.#ids.filter((x) => x !== id)].slice(0, CAP);
		this.#persist();
	}

	getRecent(): string[] {
		return this.#ids.slice();
	}

	clear(): void {
		this.#ids = [];
		if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_KEY);
	}

	#persist(): void {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(LS_KEY, JSON.stringify(this.#ids));
	}
}

export const recentCommandsStore = new RecentCommandsStore();
