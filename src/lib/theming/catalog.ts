/**
 * Theme catalog — the curated-and-closed set of Markhub themes.
 *
 * STEP 1 ships only the 2 default themes routed through the new
 * infrastructure. STEP 2 adds Solar, STEP 3 adds Tokyo. Beyond that, the
 * scope is locked (see PLAN-THEMING §SCOPE).
 *
 * The CSS for each theme lives in `src/styles/themes/<id>.css`, scoped to
 * `[data-theme="<id>"]`. The manager (`./manager.svelte`) is what writes
 * that attribute on `<html>` — this module just describes WHAT exists.
 */

export type ThemeId =
	| 'markhub-light'
	| 'markhub-dark'
	| 'cocoa'
	| 'forest'
	| 'toxic-orange'
	| 'grape-gatsby';

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
		description: 'Warm parchment with a calm indigo accent.',
		accentName: 'Indigo'
	},
	{
		id: 'markhub-dark',
		name: 'Markhub Dark',
		family: 'dark',
		description: 'Warm near-black canvas, IDE-friendly density.',
		accentName: 'Blue'
	},
	{
		id: 'cocoa',
		name: 'Cocoa',
		family: 'light',
		description: 'Warm ivory parchment with a soft terracotta accent.',
		accentName: 'Terracotta'
	},
	{
		id: 'forest',
		name: 'Forest',
		family: 'dark',
		description: 'Mossy forest floor with a refined dark-khaki accent.',
		accentName: 'Khaki'
	},
	{
		id: 'toxic-orange',
		name: 'Toxic Orange',
		family: 'dark',
		description: 'Black-kite canvas with a punchy burnt-orange accent.',
		accentName: 'Orange'
	},
	{
		id: 'grape-gatsby',
		name: 'Grape Gatsby',
		family: 'dark',
		description: 'Verdant abyss with a refined lavender accent.',
		accentName: 'Lavender'
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
