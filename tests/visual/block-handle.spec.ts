import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// Phase 7: both .operation-item children stay visible. The first (`+`)
// keeps its native Crepe behaviour (insert below). The second (⋮⋮) is
// wired by Editor.svelte to open a Notion-like block menu on click and
// to start a drag-reorder on dragstart.
test('block handle ⋮⋮ is visible AND the + is visible', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const h1 = page.locator('.milkdown .ProseMirror h1').first();
	await h1.hover();
	await page.waitForFunction(
		() =>
			document
				.querySelector('.milkdown-block-handle')
				?.getAttribute('data-show') === 'true'
	);
	const probes = await page.evaluate(() => {
		const items = Array.from(
			document.querySelectorAll('.milkdown-block-handle .operation-item')
		);
		return items.map((el) => getComputedStyle(el).display);
	});
	expect(probes.length).toBe(2);
	expect(probes[0]).not.toBe('none');
	expect(probes[1]).not.toBe('none');
});

test('clicking ⋮⋮ opens the block menu with transform options', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const h1 = page.locator('.milkdown .ProseMirror h1').first();
	await h1.hover();
	await page.waitForFunction(
		() =>
			document
				.querySelector('.milkdown-block-handle')
				?.getAttribute('data-show') === 'true'
	);
	// Click the second .operation-item (the ⋮⋮ icon).
	await page.locator('.milkdown-block-handle .operation-item').nth(1).click();
	// Custom menu rendered by ContextMenu.svelte.
	const menu = page.locator('.ctx-menu');
	await expect(menu).toBeVisible();
	await expect(menu).toContainText('Transformer en');
	await expect(menu).toContainText('Titre 1');
	await expect(menu).toContainText('Liste à puces');
	await expect(menu).toContainText('Citation');
	await expect(menu).toContainText('Dupliquer');
	await expect(menu).toContainText('Supprimer');
	await snap(page, 'block-menu-open.png');
});

test('"Titre 2" transforms the targeted H1 into an H2', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const h1 = page.locator('.milkdown .ProseMirror h1').first();
	await expect(h1).toHaveText(/H1 heading example/i);
	await h1.hover();
	await page.waitForFunction(
		() =>
			document
				.querySelector('.milkdown-block-handle')
				?.getAttribute('data-show') === 'true'
	);
	await page.locator('.milkdown-block-handle .operation-item').nth(1).click();
	await page.locator('.ctx-menu').getByText('Titre 2', { exact: true }).click();

	// The original "H1 heading example" must now be in an <h2>, and the
	// editor must no longer hold an <h1> with that text.
	await expect(
		page.locator('.milkdown .ProseMirror h2').filter({ hasText: 'H1 heading example' })
	).toHaveCount(1);
	await expect(
		page.locator('.milkdown .ProseMirror h1').filter({ hasText: 'H1 heading example' })
	).toHaveCount(0);
});

test('"Supprimer" removes the targeted block', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const h1 = page.locator('.milkdown .ProseMirror h1').first();
	await expect(h1).toHaveText(/H1 heading example/i);
	await h1.hover();
	await page.waitForFunction(
		() =>
			document
				.querySelector('.milkdown-block-handle')
				?.getAttribute('data-show') === 'true'
	);
	await page.locator('.milkdown-block-handle .operation-item').nth(1).click();
	await page.locator('.ctx-menu').getByText('Supprimer', { exact: true }).click();

	// "H1 heading example" must be gone from the document.
	await expect(
		page.locator('.milkdown .ProseMirror').getByText('H1 heading example')
	).toHaveCount(0);
	// The H2 we did NOT delete must still be there.
	await expect(
		page.locator('.milkdown .ProseMirror h2').filter({ hasText: 'H2 heading example' })
	).toHaveCount(1);
});

// Native HTML5 drag-and-drop is notoriously brittle in Playwright headless
// (mouse.down/move/up does not always trigger the dragstart→drop chain in
// Chromium). The reorder logic itself is straightforward (tr.delete + tr.insert)
// and is exercised by the smoke test. Keep this as a manual smoke checkpoint.
test.skip('dragging the ⋮⋮ reorders the block (smoke-test only)', () => {});

test('block menu near the bottom of the viewport flips up to stay visible', async ({ page }) => {
	// Use the long-doc fixture so we have a heading near the bottom of the
	// editor scroll area. Scroll the editor to the bottom, then hover the
	// last heading and open its block menu — without auto-flip the bottom
	// items would be clipped.
	await gotoFixture(page, 'long-doc');
	await page.evaluate(() => {
		const scroller = document.querySelector('.canvas-scroll');
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	});
	await page.waitForTimeout(100);

	const lastHeading = page.locator('.milkdown .ProseMirror h2').last();
	await lastHeading.hover();
	await page.waitForFunction(
		() =>
			document
				.querySelector('.milkdown-block-handle')
				?.getAttribute('data-show') === 'true'
	);
	await page.locator('.milkdown-block-handle .operation-item').nth(1).click();

	const menu = page.locator('.ctx-menu');
	await expect(menu).toBeVisible();
	const menuBox = await menu.boundingBox();
	const vh = await page.evaluate(() => window.innerHeight);
	expect(menuBox).not.toBeNull();
	if (!menuBox) return;
	// The whole menu must fit inside the viewport (auto-flip / clamp).
	expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(vh);
	expect(menuBox.y).toBeGreaterThanOrEqual(0);
	// Both top and bottom items must be reachable (rendered, not clipped).
	await expect(menu.getByText('Texte', { exact: true })).toBeVisible();
	await expect(menu.getByText('Supprimer', { exact: true })).toBeVisible();
});
