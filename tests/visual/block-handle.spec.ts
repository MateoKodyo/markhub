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
