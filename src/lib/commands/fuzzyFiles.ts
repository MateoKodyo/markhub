/**
 * Fuzzy ranking for File mode (Cmd+P). Same shape as `fuzzy.ts` for
 * commands, but the input is a flat list of files (already extracted
 * from the vault scan tree) and the ranking rules differ:
 *
 *   - empty query → recent files first (composite vaultId::relativePath
 *     match against the MRU), then registration order.
 *   - non-empty   → fuzzysort against the filename first (higher score
 *     since it's the human-meaningful part), and the relative path as a
 *     secondary key. Whichever scores best wins; both indices arrays
 *     are returned so the UI can highlight matches in name AND path.
 *
 * An optional `exclude` set drops files by composite key (used for the
 * currently-open file so it doesn't show up in its own switcher).
 */

import fuzzysort from 'fuzzysort';
import type { LastOpenedFile } from '$lib/tauri/types';

export interface FilePaletteEntry {
	vaultId: string;
	relativePath: string;
	/** Filename only (no directory). */
	name: string;
}

export interface RankedFile {
	entry: FilePaletteEntry;
	matchInName?: number[];
	matchInPath?: number[];
}

const keyOf = (e: { vaultId: string; relativePath: string }) =>
	`${e.vaultId}::${e.relativePath}`;

export function rankFiles(
	files: FilePaletteEntry[],
	query: string,
	recentKeys: LastOpenedFile[],
	exclude: Set<string> = new Set()
): RankedFile[] {
	const visible = files.filter((f) => !exclude.has(keyOf(f)));

	if (!query.trim()) {
		const byKey = new Map(visible.map((f) => [keyOf(f), f]));
		const seen = new Set<string>();
		const out: RankedFile[] = [];
		for (const recent of recentKeys) {
			const f = byKey.get(keyOf(recent));
			if (!f) continue;
			out.push({ entry: f });
			seen.add(keyOf(f));
		}
		for (const f of visible) {
			if (seen.has(keyOf(f))) continue;
			out.push({ entry: f });
		}
		return out;
	}

	// Non-empty query: score against both `name` and `relativePath`. We
	// call fuzzysort.go twice (once per key) and merge by entry, keeping
	// the best score. Matched indices for each key are preserved for the
	// UI to highlight separately in the filename vs the path tail.
	const byName = fuzzysort.go(query, visible, {
		key: 'name',
		threshold: -10000
	});
	const byPath = fuzzysort.go(query, visible, {
		key: 'relativePath',
		threshold: -10000
	});

	const merged = new Map<
		string,
		{
			entry: FilePaletteEntry;
			score: number;
			matchInName?: number[];
			matchInPath?: number[];
		}
	>();
	for (const r of byName) {
		const f = r.obj as FilePaletteEntry;
		const k = keyOf(f);
		merged.set(k, {
			entry: f,
			// Filename hits are weighted above bare path hits — boost the score.
			score: r.score + 1000,
			matchInName: r.indexes ? Array.from(r.indexes) : undefined
		});
	}
	for (const r of byPath) {
		const f = r.obj as FilePaletteEntry;
		const k = keyOf(f);
		const existing = merged.get(k);
		if (existing) {
			existing.matchInPath = r.indexes ? Array.from(r.indexes) : undefined;
		} else {
			merged.set(k, {
				entry: f,
				score: r.score,
				matchInPath: r.indexes ? Array.from(r.indexes) : undefined
			});
		}
	}

	return Array.from(merged.values())
		.sort((a, b) => b.score - a.score)
		.map((r) => ({
			entry: r.entry,
			matchInName: r.matchInName,
			matchInPath: r.matchInPath
		}));
}
