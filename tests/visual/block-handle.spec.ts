import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// SUSPENDED — these specs target the Crepe block-handle (`.milkdown
// .operation-item`) and our custom transform/duplicate/delete menu, both
// removed at PLAN-BLOCKNOTE étape 4 (commit replacing Crepe with
// BlockNote). The native BlockNote SideMenu Svelte component lands at
// step 2.5.c — these specs will then be replaced by their BlockNote
// equivalents.
test.describe.skip('Crepe block handle (suspended — replaced by BlockNote SideMenu at step 2.5.c)', () => {
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

test('dragging the H1 ⋮⋮ down past H2 reorders the document', async ({ page }) => {
	await gotoFixture(page, 'headings');

	const initialOrder = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll('.milkdown .ProseMirror h1, .milkdown .ProseMirror h2')
		).map((el) => `${el.tagName.toLowerCase()}:${el.textContent}`)
	);
	expect(initialOrder[0]).toMatch(/^h1:H1 heading example/);
	expect(initialOrder[1]).toMatch(/^h2:H2 heading example/);

	await page.locator('.milkdown .ProseMirror h1').first().hover();
	await page.waitForFunction(
		() =>
			document.querySelector('.milkdown-block-handle')?.getAttribute('data-show') === 'true'
	);

	const handle = page.locator('.milkdown-block-handle .operation-item').nth(1);
	const handleBox = await handle.boundingBox();
	const h2Box = await page.locator('.milkdown .ProseMirror h2').first().boundingBox();
	if (!handleBox || !h2Box) throw new Error('missing bounding boxes');

	// Pointer events: mouse.move/down/up dispatches them natively in Chromium,
	// unlike native HTML5 drag-and-drop. Our impl is pointer-based, so this
	// drives the real flow end-to-end.
	await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(handleBox.x + 4, handleBox.y + handleBox.height / 2 + 30, { steps: 5 });
	await page.mouse.move(h2Box.x + h2Box.width / 2, h2Box.y + h2Box.height + 8, { steps: 10 });
	await page.mouse.up();
	await page.waitForTimeout(150);

	const finalOrder = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll('.milkdown .ProseMirror h1, .milkdown .ProseMirror h2')
		).map((el) => `${el.tagName.toLowerCase()}:${el.textContent}`)
	);
	// H1 was dropped below the H2 → H2 now comes first among headings.
	expect(finalOrder[0]).toMatch(/^h2:H2 heading example/);
});

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
});
