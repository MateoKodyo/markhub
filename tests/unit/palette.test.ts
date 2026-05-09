import { describe, it, expect } from 'vitest';
import { pickNextColor, VAULT_PALETTE } from '../../src/lib/utils/palette';

describe('palette', () => {
	// ------ B5.1 — palette has at least 5 distinct hex colors ------
	it('exposes a palette of at least 5 distinct hex colors', () => {
		expect(VAULT_PALETTE.length).toBeGreaterThanOrEqual(5);
		const distinct = new Set(VAULT_PALETTE);
		expect(distinct.size).toBe(VAULT_PALETTE.length);
		for (const c of VAULT_PALETTE) {
			expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
		}
	});

	// ------ B5.2 — first call returns first color ------
	it('returns the first palette color for count = 0', () => {
		expect(pickNextColor(0)).toBe(VAULT_PALETTE[0]);
	});

	// ------ B5.3 — rotates by modulo ------
	it('rotates through the palette using modulo', () => {
		const len = VAULT_PALETTE.length;
		expect(pickNextColor(1)).toBe(VAULT_PALETTE[1]);
		expect(pickNextColor(len)).toBe(VAULT_PALETTE[0]);
		expect(pickNextColor(len + 2)).toBe(VAULT_PALETTE[2]);
	});

	// ------ B5.4 — defensive: negative / non-finite count ------
	it('falls back to the first color for invalid counts', () => {
		expect(pickNextColor(-1)).toBe(VAULT_PALETTE[0]);
		expect(pickNextColor(NaN)).toBe(VAULT_PALETTE[0]);
	});
});
