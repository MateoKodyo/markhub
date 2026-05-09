import { test, expect } from '@playwright/test';
import { gotoFixture } from './_helpers';

// Round 2 chantier 1 — verify the three-tier grayscale hierarchy renders
// distinct, OKLCH-coherent backgrounds (sidebar darkest → content medium →
// popovers lightest). Without this differentiation, the warm-dark UI feels
// like a flat single-tone surface and loses the IDE-pro spatial cues.

function parseRgb(s: string): [number, number, number] {
	const m = s.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
	if (!m) throw new Error(`Cannot parse rgb: ${s}`);
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luma([r, g, b]: [number, number, number]): number {
	// Rough perceptual luminance — enough to assert ordering on a dark scale.
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('sidebar background is darker than the editor canvas', async ({ page }) => {
	await gotoFixture(page, 'sidebar-overflow');

	const samples = await page.evaluate(() => {
		const cs = (sel: string) => {
			const el = document.querySelector(sel);
			return el ? getComputedStyle(el).backgroundColor : null;
		};
		return {
			sidebar: cs('.sidebar-mirror'),
			content: cs('.content-mirror'),
			body: getComputedStyle(document.body).backgroundColor
		};
	});

	expect(samples.sidebar).not.toBeNull();

	const sidebarLuma = luma(parseRgb(samples.sidebar!));
	// Body fallback when content is transparent.
	const contentBg = samples.content && samples.content !== 'rgba(0, 0, 0, 0)'
		? samples.content
		: samples.body;
	const contentLuma = luma(parseRgb(contentBg));

	// Sidebar must be visibly darker (> 1 unit on the 0-255 luma scale —
	// not just a 1-bit difference that could vanish on different monitors).
	expect(sidebarLuma).toBeLessThan(contentLuma);
	expect(contentLuma - sidebarLuma).toBeGreaterThanOrEqual(2);
});
