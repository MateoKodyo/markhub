import { describe, it, expect } from 'vitest';
import {
	THEMES,
	getThemeMeta,
	getThemesByFamily,
	isThemeId,
	type ThemeId,
	type ThemeMeta
} from '../../src/lib/theming/catalog';

describe('theming catalog', () => {
	// ------ TC.1 — catalog growth tracking ------
	it('exposes the 12 curated themes (6 light from PLAN-LIGHT-THEMES + 6 dark)', () => {
		const ids = THEMES.map((t) => t.id).sort();
		expect(ids).toEqual([
			'amber',
			'editor',
			'forest',
			'ink',
			'kodyo',
			'markhub-dark',
			'markhub-light',
			'markus',
			'plum',
			'rose',
			'terminal',
			'terracotta'
		]);
	});

	// ------ TC.2 — every theme entry carries the full metadata shape ------
	it('every theme entry has a complete ThemeMeta shape', () => {
		for (const t of THEMES) {
			expect(t.id).toMatch(/^[a-z][a-z0-9-]*$/);
			expect(typeof t.name).toBe('string');
			expect(t.name.length).toBeGreaterThan(0);
			expect(['light', 'dark']).toContain(t.family);
			expect(typeof t.description).toBe('string');
			expect(t.description.length).toBeGreaterThan(0);
			expect(typeof t.accentName).toBe('string');
			expect(t.accentName.length).toBeGreaterThan(0);
		}
	});

	// ------ TC.3 — the two defaults declare the right family ------
	it('markhub-light is family=light and markhub-dark is family=dark', () => {
		const light = THEMES.find((t) => t.id === 'markhub-light');
		const dark = THEMES.find((t) => t.id === 'markhub-dark');
		expect(light?.family).toBe('light');
		expect(dark?.family).toBe('dark');
	});

	// ------ TC.4 — getThemeMeta resolves by id ------
	it('getThemeMeta returns the meta for a known id', () => {
		const meta: ThemeMeta = getThemeMeta('markhub-dark');
		expect(meta.id).toBe('markhub-dark');
		expect(meta.family).toBe('dark');
	});

	// ------ TC.5 — getThemesByFamily filters correctly ------
	it('getThemesByFamily returns only themes of that family', () => {
		const light = getThemesByFamily('light');
		const dark = getThemesByFamily('dark');
		expect(light.every((t) => t.family === 'light')).toBe(true);
		expect(dark.every((t) => t.family === 'dark')).toBe(true);
		// Light family: 6 themes (PLAN-LIGHT-THEMES STEP 1 — markhub-light
		// sage + 5 siblings). Dark family: 6 themes (markhub-dark, forest,
		// kodyo, markus, terminal, editor).
		expect(light.map((t) => t.id).sort()).toEqual([
			'amber',
			'ink',
			'markhub-light',
			'plum',
			'rose',
			'terracotta'
		]);
		expect(dark.map((t) => t.id).sort()).toEqual([
			'editor',
			'forest',
			'kodyo',
			'markhub-dark',
			'markus',
			'terminal'
		]);
	});

	// ------ TC.6 — isThemeId narrows arbitrary strings ------
	it('isThemeId returns true for catalog ids, false otherwise', () => {
		expect(isThemeId('markhub-light')).toBe(true);
		expect(isThemeId('markhub-dark')).toBe(true);
		expect(isThemeId('forest')).toBe(true);
		expect(isThemeId('kodyo')).toBe(true);
		expect(isThemeId('markus')).toBe(true);
		expect(isThemeId('terminal')).toBe(true);
		expect(isThemeId('editor')).toBe(true);
		expect(isThemeId('terracotta')).toBe(true); // PLAN-LIGHT-THEMES STEP 1
		expect(isThemeId('rose')).toBe(true); // PLAN-LIGHT-THEMES STEP 1
		expect(isThemeId('amber')).toBe(true); // PLAN-LIGHT-THEMES STEP 1
		expect(isThemeId('ink')).toBe(true); // PLAN-LIGHT-THEMES STEP 1
		expect(isThemeId('plum')).toBe(true); // PLAN-LIGHT-THEMES STEP 1
		expect(isThemeId('cocoa')).toBe(false); // dropped in PLAN-LIGHT-THEMES STEP 1
		expect(isThemeId('light')).toBe(false); // legacy value — must NOT match
		expect(isThemeId('')).toBe(false);
		expect(isThemeId('nonsense')).toBe(false);
	});

	// ------ TC.7 — no duplicate ids in the catalog ------
	it('catalog ids are unique', () => {
		const ids = THEMES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	// Sanity: the exported ThemeId type covers the catalog ids at compile time.
	// (Pure type check — no runtime assertion needed.)
	const _typeCheck: ThemeId[] = THEMES.map((t) => t.id);
	void _typeCheck;
});
