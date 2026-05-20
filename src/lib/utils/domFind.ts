/**
 * Rendered-DOM text search — used by the preview-mode find engine.
 *
 * Walks the text nodes under `root` and returns a `Range` for every
 * case-insensitive occurrence of `query`, in document order. The Ranges
 * feed the CSS Custom Highlight API so matches are painted without
 * mutating the document.
 *
 * Limitation: a match is only found when it lies within a single text
 * node. A query split across inline formatting (e.g. "wor" + "**ld**")
 * is missed — acceptable for v1, the common case is plain runs of text.
 */

export function findRangesInElement(root: Element, query: string): Range[] {
	const ranges: Range[] = [];
	const needle = query.toLowerCase();
	if (needle.length === 0) return ranges;

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		const text = node.nodeValue ?? '';
		const hay = text.toLowerCase();
		let i = 0;
		while (i <= hay.length - needle.length) {
			const idx = hay.indexOf(needle, i);
			if (idx < 0) break;
			const range = document.createRange();
			range.setStart(node, idx);
			range.setEnd(node, idx + needle.length);
			ranges.push(range);
			i = idx + needle.length;
		}
		node = walker.nextNode();
	}
	return ranges;
}
