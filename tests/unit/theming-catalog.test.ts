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
	it('exposes all catalog themes (STEP 2 adds Solar to the 2 defaults)', () => {
		const ids = THEMES.map((t) => t.id).sort();
		expect(ids).toEqual(['markhub-dark', 'markhub-light', 'solar']);
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
		// STEP 2 puts both Markhub Light + Solar in the light family.
		expect(light.map((t) => t.id).sort()).toEqual(['markhub-light', 'solar']);
		expect(dark.length).toBeGreaterThan(0);
	});

	// ------ TC.6 — isThemeId narrows arbitrary strings ------
	it('isThemeId returns true for catalog ids, false otherwise', () => {
		expect(isThemeId('markhub-light')).toBe(true);
		expect(isThemeId('markhub-dark')).toBe(true);
		expect(isThemeId('solar')).toBe(true); // added in STEP 2
		expect(isThemeId('tokyo')).toBe(false); // STEP 3 adds Tokyo
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
