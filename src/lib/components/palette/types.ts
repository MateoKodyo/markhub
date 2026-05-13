/**
 * Public types shared between the palette mode components and their
 * parent. Kept here (rather than co-located in each .svelte file) so
 * +page.svelte can import them without doing the `<script module>`
 * Svelte 5 dance just to re-export a single shape.
 */

export type SearchActivation = {
	relativePath: string;
	lineNumber: number;
};
