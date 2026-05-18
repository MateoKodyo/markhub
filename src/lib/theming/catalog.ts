/**
 * Theme catalog — the curated set of Markhub themes (12 total: 6 light + 6 dark).
 *
 * Light family (PLAN-LIGHT-THEMES STEP 1, May 2026):
 *   markhub-light (sage signature), terracotta, rose, amber, ink, plum.
 * Dark family:
 *   markhub-dark, forest, kodyo, markus, terminal, editor.
 *
 * The CSS for each theme lives in `src/styles/themes/<id>.css`, scoped to
 * `[data-theme="<id>"]`. The manager (`./manager.svelte`) writes the
 * attribute on `<html>` — this module just describes WHAT exists.
 *
 * Adding a theme: drop in `src/styles/themes/<id>.css`, add an `@import`
 * to `src/app.css`, extend the pre-hydration whitelist in `src/app.html`,
 * register the entry below. The `ThemeId` union below is re-exported by
 * `src/lib/tauri/types.ts` (single source of truth — no parallel list).
 */

export type ThemeId =
	| 'markhub-light'
	| 'markhub-dark'
	| 'forest'
	| 'kodyo'
	| 'markus'
	| 'terminal'
	| 'editor'
	| 'terracotta'
	| 'rose'
	| 'amber'
	| 'ink'
	| 'plum';

export type ThemeFamily = 'light' | 'dark';

export interface ThemeMeta {
	id: ThemeId;
	/** User-facing display name (settings picker, command palette). */
	name: string;
	/** Whether this theme is shown in the light slot or the dark slot. */
	family: ThemeFamily;
	/** One-line tagline shown under the name in the theme picker. */
	description: string;
	/** Short accent label (e.g. "Indigo", "Cream") rendered as caption. */
	accentName: string;
}

export const THEMES: readonly ThemeMeta[] = [
	{
		id: 'markhub-light',
		name: 'Markhub Light',
		family: 'light',
		description: 'Sage signature — Markhub\'s canonical day theme.',
		accentName: 'Sage'
	},
	{
		id: 'markhub-dark',
		name: 'Markhub Dark',
		family: 'dark',
		description: 'Warm near-black canvas, IDE-friendly density.',
		accentName: 'Blue'
	},
	{
		id: 'forest',
		name: 'Forest',
		family: 'dark',
		description: 'Mossy forest floor with a refined dark-khaki accent.',
		accentName: 'Khaki'
	},
	{
		id: 'kodyo',
		name: 'Kodyo',
		family: 'dark',
		description: 'Velours Bordeaux palette from Kodyo brand — mahogany with signature orange.',
		accentName: 'Kodyo Orange'
	},
	{
		id: 'markus',
		name: 'Markus',
		family: 'dark',
		description: 'Landing-page palette: neutral near-black with a sage accent.',
		accentName: 'Sage'
	},
	{
		id: 'terminal',
		name: 'Terminal',
		family: 'dark',
		description: 'Warp-inspired: cool-neutral dark with indigo tonic accent.',
		accentName: 'Indigo'
	},
	{
		id: 'editor',
		name: 'Editor',
		family: 'dark',
		description: 'Cursor-inspired: flat near-pure-black with a cool blue accent.',
		accentName: 'Cursor Blue'
	},
	{
		id: 'terracotta',
		name: 'Terracotta',
		family: 'light',
		description: 'Anthropic-inspired cream with a warm terracotta accent.',
		accentName: 'Terracotta'
	},
	{
		id: 'rose',
		name: 'Rosé',
		family: 'light',
		description: 'Rosé Pine Dawn lineage: dusty pink paper, plum text, muted rose.',
		accentName: 'Rose'
	},
	{
		id: 'amber',
		name: 'Amber',
		family: 'light',
		description: 'Solarized Light cream with the signature amber accent.',
		accentName: 'Amber'
	},
	{
		id: 'ink',
		name: 'Ink',
		family: 'light',
		description: 'Bone white with a deep editorial red — newspaper feel.',
		accentName: 'Editorial Red'
	},
	{
		id: 'plum',
		name: 'Plum',
		family: 'light',
		description: 'Pale lavender greys with a sober violet accent.',
		accentName: 'Violet'
	}
] as const;

const THEME_IDS: ReadonlySet<string> = new Set(THEMES.map((t) => t.id));

export function isThemeId(value: unknown): value is ThemeId {
	return typeof value === 'string' && THEME_IDS.has(value);
}

export function getThemeMeta(id: ThemeId): ThemeMeta {
	const meta = THEMES.find((t) => t.id === id);
	if (!meta) {
		// Catalog is a static, exhaustive enum — a miss means the caller
		// passed an unchecked string. Surface it loudly in dev so the bug
		// doesn't hide behind a silent fallback.
		throw new Error(`[theming] unknown theme id: ${id}`);
	}
	return meta;
}

export function getThemesByFamily(family: ThemeFamily): ThemeMeta[] {
	return THEMES.filter((t) => t.family === family);
}

/** Default fallback theme for each family — used by migration and bootstrap. */
export const DEFAULT_LIGHT_THEME: ThemeId = 'markhub-light';
export const DEFAULT_DARK_THEME: ThemeId = 'markhub-dark';
