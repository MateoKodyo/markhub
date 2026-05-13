/**
 * In-document find state — driver for Cmd+F. Lives at the store level
 * (not inside `<FindBar>`) so the keybinding (which sits in the global
 * keymap registry) and the consumer Editor can both reach it.
 *
 * One bar at a time, always against the active tab's content. The
 * Editor listens to the active match offsets and applies the visual
 * cue (source-mode textarea selection for V1).
 */

import { activeFileStore } from './activeFile.svelte';

class FindStore {
	/** Bar visibility — toggled by Cmd+F. */
	isOpen = $state(false);
	/** Current query (raw — case-insensitive matching). */
	query = $state('');
	/** Zero-based byte/char offsets of every match in the active tab's
	 *  content. Recomputed on `setQuery` or on tab/content change. */
	matches = $state<number[]>([]);
	/** Index into `matches` of the currently-focused hit. -1 means no
	 *  active match (empty query or no hits). */
	activeIndex = $state(-1);

	open(): void {
		this.isOpen = true;
		// Recompute against the current active tab so the bar opens with
		// a fresh count even if the tab changed since last close.
		this.#recompute();
	}

	close(): void {
		this.isOpen = false;
		this.query = '';
		this.matches = [];
		this.activeIndex = -1;
	}

	setQuery(q: string): void {
		this.query = q;
		this.#recompute();
	}

	next(): void {
		if (this.matches.length === 0) return;
		this.activeIndex = (this.activeIndex + 1) % this.matches.length;
	}

	previous(): void {
		if (this.matches.length === 0) return;
		this.activeIndex =
			this.activeIndex <= 0 ? this.matches.length - 1 : this.activeIndex - 1;
	}

	/** Re-run the match scan — called when the underlying content
	 *  changes (caller's responsibility) or when the query is updated. */
	#recompute(): void {
		const q = this.query;
		if (q.length === 0) {
			this.matches = [];
			this.activeIndex = -1;
			return;
		}
		const content = activeFileStore.content;
		this.matches = computeMatches(content, q);
		this.activeIndex = this.matches.length > 0 ? 0 : -1;
	}

	/** Public for the Editor to recompute when the active tab changes
	 *  (the store can't observe that itself without coupling reactively
	 *  to the tabs store). */
	refresh(): void {
		this.#recompute();
	}
}

/**
 * Pure helper: return every starting offset of `query` in `content`
 * using a case-insensitive scan. Overlapping matches are NOT returned
 * — we advance past each hit so "aa" in "aaaa" yields 2 matches
 * (positions 0 and 2), not 3.
 */
export function computeMatches(content: string, query: string): number[] {
	if (!query) return [];
	const out: number[] = [];
	const haystack = content.toLowerCase();
	const needle = query.toLowerCase();
	if (needle.length === 0) return out;
	let i = 0;
	while (i <= haystack.length - needle.length) {
		const idx = haystack.indexOf(needle, i);
		if (idx < 0) break;
		out.push(idx);
		i = idx + needle.length;
	}
	return out;
}

export const findStore = new FindStore();
