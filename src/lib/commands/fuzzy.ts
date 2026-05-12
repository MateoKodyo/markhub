/**
 * Fuzzy ranking for command/file palettes — wraps `fuzzysort` so the rest
 * of the app stays library-agnostic (swap to Fuse.js or a custom scorer
 * later by changing this file only).
 *
 * Two modes:
 *   - empty query → return every visible command, with the IDs listed in
 *     `recentIds` floated to the top in their recent order. No score.
 *   - non-empty   → fuzzysort against the `label`, return scored matches
 *     with the matched-char indices for highlighting.
 *
 * `when` guards always filter out — both in empty and queried paths.
 * Recent IDs that point to guarded-out commands are silently dropped.
 */

import fuzzysort from 'fuzzysort';
import type { Command } from './registry.svelte';

export interface RankedCommand {
	command: Command;
	matchIndices?: number[];
}

export function rankCommands(
	commands: Command[],
	query: string,
	recentIds: string[]
): RankedCommand[] {
	const visible = commands.filter((c) => !c.when || c.when());

	if (!query.trim()) {
		const byId = new Map(visible.map((c) => [c.id, c]));
		const seen = new Set<string>();
		const out: RankedCommand[] = [];
		// 1. Recents first, in given order, dropping any that are gone or
		//    guarded out. Dedup against the rest.
		for (const id of recentIds) {
			const c = byId.get(id);
			if (!c) continue;
			out.push({ command: c });
			seen.add(id);
		}
		// 2. Everything else in registration order.
		for (const c of visible) {
			if (seen.has(c.id)) continue;
			out.push({ command: c });
		}
		return out;
	}

	// Non-empty query: fuzzysort against the label. `key: 'label'` is the
	// supported way to keep the original object in `.obj`.
	const results = fuzzysort.go(query, visible, { key: 'label', threshold: -10000 });
	return results.map((r) => ({
		command: r.obj as Command,
		matchIndices: r.indexes ? Array.from(r.indexes) : undefined
	}));
}
