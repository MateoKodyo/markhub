/**
 * In-document find state.
 *
 * The store is a thin state holder — query, active match index, total
 * match count, focus pulse. It does NOT do the matching itself: the
 * Editor runs a per-mode engine (markdown-string offsets in source mode,
 * rendered-DOM ranges in preview mode) and reports the count back via
 * `reportMatches`. This keeps the count honest to what the user actually
 * sees highlighted in the current mode.
 *
 * The horizontal FloatingBar hosts an always-present inline search field;
 * `isOpen` only gates the vertical-mode `FindBar` popover.
 */

class FindStore {
	/** Vertical-mode `FindBar` visibility. The inline search is always
	 *  present, so it does not depend on this flag. */
	isOpen = $state(false);
	/** Current query — case-insensitive matching. */
	query = $state('');
	/** Index of the focused match within the active mode's match set,
	 *  or -1 when there is none. */
	activeIndex = $state(-1);
	/** Total matches reported by the active editor mode's engine. */
	matchCount = $state(0);
	/** Bumped to ask the visible search input to take focus (Cmd+F). */
	focusSeq = $state(0);

	open(): void {
		this.isOpen = true;
		this.focusSeq++;
	}

	close(): void {
		this.isOpen = false;
		this.query = '';
		this.activeIndex = -1;
		this.matchCount = 0;
	}

	/** Cmd+F when the inline search is already visible — refocus it. */
	requestFocus(): void {
		this.focusSeq++;
	}

	setQuery(q: string): void {
		this.query = q;
		// New query — drop the active match; the engine's `reportMatches`
		// lands it back on the first hit.
		this.activeIndex = -1;
	}

	/** Called by the active editor mode after (re)scanning for matches. */
	reportMatches(count: number): void {
		this.matchCount = count;
		if (count === 0) {
			this.activeIndex = -1;
		} else if (this.activeIndex < 0 || this.activeIndex >= count) {
			this.activeIndex = 0;
		}
	}

	next(): void {
		if (this.matchCount === 0) return;
		this.activeIndex = (this.activeIndex + 1) % this.matchCount;
	}

	previous(): void {
		if (this.matchCount === 0) return;
		this.activeIndex =
			this.activeIndex <= 0 ? this.matchCount - 1 : this.activeIndex - 1;
	}
}

/**
 * Pure helper: return every starting offset of `query` in `content`
 * using a case-insensitive scan. Overlapping matches are NOT returned
 * — we advance past each hit so "aa" in "aaaa" yields 2 matches
 * (positions 0 and 2), not 3. Used by the source-mode find engine.
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
