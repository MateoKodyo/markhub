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

/** Stable order of groups when the palette is at rest (no query). Mirrors
 *  the catalog's natural reading order (file work first, then app surface,
 *  then prefs). Tabs / Settings live at the bottom because they are less
 *  frequent. Any group not in this list is appended at the end in
 *  registration order. */
const GROUP_ORDER = ['File', 'View', 'Vault', 'Tabs', 'Settings'] as const;

export function rankCommands(
	commands: Command[],
	query: string,
	recentIds: string[]
): RankedCommand[] {
	const visible = commands.filter((c) => !c.hidden && (!c.when || c.when()));

	if (!query.trim()) {
		const byId = new Map(visible.map((c) => [c.id, c]));
		const seen = new Set<string>();
		const recentsFirst: Command[] = [];
		// 1. Recents first, in given order, dropping any that are gone or
		//    guarded out. Dedup against the rest.
		for (const id of recentIds) {
			const c = byId.get(id);
			if (!c) continue;
			recentsFirst.push(c);
			seen.add(id);
		}
		// 2. Everything else in registration order.
		for (const c of visible) {
			if (seen.has(c.id)) continue;
			recentsFirst.push(c);
		}
		// 3. Bucket by group following GROUP_ORDER. Within each group the
		//    recents-first ordering is preserved (a recently used "View"
		//    command lands at the top of the View bucket). Groups not in
		//    GROUP_ORDER are appended after the known ones, in first-seen
		//    order.
		const out: RankedCommand[] = [];
		const extraGroupsSeen: string[] = [];
		for (const g of GROUP_ORDER) {
			for (const c of recentsFirst) {
				if ((c.group ?? 'Other') === g) out.push({ command: c });
			}
		}
		for (const c of recentsFirst) {
			const g = c.group ?? 'Other';
			if (GROUP_ORDER.includes(g as (typeof GROUP_ORDER)[number])) continue;
			if (!extraGroupsSeen.includes(g)) extraGroupsSeen.push(g);
		}
		for (const g of extraGroupsSeen) {
			for (const c of recentsFirst) {
				if ((c.group ?? 'Other') === g) out.push({ command: c });
			}
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
