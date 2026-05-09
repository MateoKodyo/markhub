import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// P0-1 — both the sidebar files-section and the editor body must scroll
// vertically when their content exceeds the viewport. Without the body→app
// flex chain, neither container had a bounded height and the page itself
// overflowed instead.
test('sidebar files list scrolls when overflowing (P0 #1 sidebar)', async ({ page }) => {
	await gotoFixture(page, 'sidebar-overflow');

	const filesScroll = page.locator('[data-testid="files-scroll"]');
	const dims = await filesScroll.evaluate((el) => ({
		clientHeight: el.clientHeight,
		scrollHeight: el.scrollHeight
	}));

	expect(dims.clientHeight).toBeGreaterThan(0);
	expect(dims.scrollHeight).toBeGreaterThan(dims.clientHeight);

	// Functional: scroll down and verify scrollTop actually moved.
	await filesScroll.evaluate((el) => {
		el.scrollTop = 200;
	});
	const scrollTop = await filesScroll.evaluate((el) => el.scrollTop);
	expect(scrollTop).toBeGreaterThan(0);

	await snap(page, 'sidebar-overflow.png');
});

test('editor body scrolls when document is long (P0 #1 editor)', async ({ page }) => {
	await gotoFixture(page, 'sidebar-overflow');

	// In the mirror layout, .canvas-scroll inside Editor handles vertical scroll.
	const canvasScroll = page.locator('.canvas-scroll').first();
	const dims = await canvasScroll.evaluate((el) => ({
		clientHeight: el.clientHeight,
		scrollHeight: el.scrollHeight
	}));

	expect(dims.clientHeight).toBeGreaterThan(0);
	expect(dims.scrollHeight).toBeGreaterThan(dims.clientHeight);
});
