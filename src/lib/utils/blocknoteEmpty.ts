/**
 * Empty-paragraph preservation across BlockNote's lossy markdown round-trip.
 *
 * The problem: BlockNote's `blocksToMarkdownLossy()` drops empty paragraph
 * blocks. Two consecutive paragraphs separated by N empty paragraph blocks
 * round-trip as if N == 0, so the visual breathing room the user adds with
 * the Enter key disappears the moment the file is reloaded.
 *
 * The fix: a marker round-trip. On serialize, every block that BlockNote
 * would treat as visually empty is given a non-breaking space (U+00A0) as
 * its content. That paragraph then survives the markdown serializer AND
 * BlockNote's own parser (NBSP is just text). On parse, paragraphs that
 * contain only the marker are stripped back to empty so the user sees a
 * truly blank line in the UI — no leading NBSP appears when they start
 * typing into a previously-empty paragraph.
 *
 * The marker is a single U+00A0. It has no visible glyph, holds line
 * height, and most external editors (VS Code, Vim, GitHub) render it as
 * either invisible or a faint dot — acceptable trade-off for keeping the
 * file readable.
 */

/** Marker character used to keep an empty paragraph alive through the
 *  markdown round-trip. Non-breaking space — invisible but indelible. */
export const EMPTY_PARAGRAPH_MARKER = ' ';

/**
 * Inline text/styled node shape produced by BlockNote. We only care about
 * the `text` field for emptiness detection. Other fields exist (styles,
 * type=link with `content` of its own, …) and are passed through untouched.
 */
type InlineContent = { type: string; text?: string; [k: string]: unknown };

/**
 * Loose Block shape — mirrors what `editor.document` returns. We type just
 * the fields we touch; everything else is preserved verbatim. The full
 * BlockNote `Block` type is huge and tied to schema generics, which adds
 * friction for what is fundamentally a JSON-shape transform.
 */
type LooseBlock = {
	type: string;
	content?: InlineContent[] | string;
	children?: LooseBlock[];
	[k: string]: unknown;
};

/** Detect a paragraph block whose visible content is empty. Covers the
 *  three shapes BlockNote uses in practice: missing content, an empty
 *  array, and an array of text nodes whose `text` are all empty. */
function isEmptyParagraph(block: LooseBlock): boolean {
	if (block.type !== 'paragraph') return false;
	const c = block.content;
	if (c === undefined || c === null) return true;
	if (typeof c === 'string') return c.length === 0;
	if (!Array.isArray(c) || c.length === 0) return true;
	return c.every(
		(node) => node.type === 'text' && (node.text === '' || node.text === undefined)
	);
}

/** Detect a paragraph block whose content is exactly the single empty
 *  marker — created by `wrapEmptyParagraphs` on a previous round-trip.
 *  Multi-character or styled NBSP content does NOT match (the user might
 *  have typed `  foo` intentionally). */
function isMarkerOnlyParagraph(block: LooseBlock): boolean {
	if (block.type !== 'paragraph') return false;
	const c = block.content;
	if (!Array.isArray(c) || c.length !== 1) return false;
	const node = c[0];
	if (node.type !== 'text' || node.text !== EMPTY_PARAGRAPH_MARKER) return false;
	const styles = (node as { styles?: Record<string, unknown> }).styles;
	if (styles && Object.keys(styles).length > 0) return false;
	return true;
}

/**
 * Returns a deep-cloned blocks array where every empty paragraph block has
 * its content replaced with the single-NBSP marker. Pass the result to
 * `editor.blocksToMarkdownLossy(blocks)` to preserve blank lines through
 * the markdown round-trip. Non-paragraph blocks pass through untouched.
 *
 * The input array is NOT mutated — BlockNote's `editor.document` is live
 * state and any in-place mutation would leak into the UI.
 *
 * Generic on the block element type so the call site keeps its precise
 * BlockNote typing (Block, PartialBlock, …). Internally we treat blocks
 * as a structural JSON shape via `LooseBlock`.
 */
export function wrapEmptyParagraphs<T>(blocks: T[]): T[] {
	// Structural clone is cheap here (the doc is JSON-serializable) and
	// avoids the typing dance of walking the tree by hand.
	const cloned = JSON.parse(JSON.stringify(blocks)) as LooseBlock[];
	walk(cloned, (block) => {
		if (isEmptyParagraph(block)) {
			block.content = [{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }];
		}
	});
	return cloned as unknown as T[];
}

/**
 * In-place strip: every paragraph block whose content is exactly the
 * marker has its content reset to an empty array, so the UI renders an
 * actual blank line (no leading NBSP at the cursor when the user starts
 * typing). Apply to the output of `editor.tryParseMarkdownToBlocks`.
 *
 * Idempotent — calling twice is a no-op.
 *
 * Generic on the block element type so the call site keeps its precise
 * BlockNote typing.
 */
export function unwrapEmptyParagraphs<T>(blocks: T[]): T[] {
	walk(blocks as unknown as LooseBlock[], (block) => {
		if (isMarkerOnlyParagraph(block)) {
			block.content = [];
		}
	});
	return blocks;
}

function walk(blocks: LooseBlock[], visit: (block: LooseBlock) => void): void {
	for (const block of blocks) {
		visit(block);
		if (Array.isArray(block.children) && block.children.length > 0) {
			walk(block.children, visit);
		}
	}
}
