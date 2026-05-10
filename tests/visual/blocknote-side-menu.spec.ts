import { test, expect } from '@playwright/test';
import { gotoFixture } from './_helpers';

// C1 / Étape 2.5.c — Svelte UI for BlockNote's SideMenu plugin.
// Tested through the /_visual fixture route since it mounts the real
// Editor.svelte (which holds the wiring), but in an isolated page where
// the only block content is what the fixture defines — much easier to
// target than the live main route.

test('hovering a block shows the side menu with + and ⋮⋮', async ({ page }) => {
	await gotoFixture(page, 'headings');
	// First block of the fixture is the H1.
	const firstBlock = page.locator('.bn-editor.ProseMirror .bn-block').first();
	await firstBlock.hover();

	const sideMenu = page.locator('[data-testid="bn-side-menu"]');
	await expect(sideMenu).toBeVisible({ timeout: 5_000 });
	await expect(sideMenu.getByRole('button', { name: /add block/i })).toBeVisible();
	await expect(sideMenu.getByRole('button', { name: /drag/i })).toBeVisible();
});

test('the drag handle exposes draggable="true"', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const firstBlock = page.locator('.bn-editor.ProseMirror .bn-block').first();
	await firstBlock.hover();

	const handle = page.locator('[data-testid="bn-side-menu"]').getByRole('button', {
		name: /drag/i
	});
	await expect(handle).toBeVisible({ timeout: 5_000 });
	await expect(handle).toHaveAttribute('draggable', 'true');
});

test('clicking ⋮⋮ opens the transform sub-menu', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const firstBlock = page.locator('.bn-editor.ProseMirror .bn-block').first();
	await firstBlock.hover();

	const handle = page.locator('[data-testid="bn-side-menu"]').getByRole('button', {
		name: /drag/i
	});
	await expect(handle).toBeVisible({ timeout: 5_000 });
	await handle.click({ force: true });

	// Visible sub-menu is the existing ContextMenu (.ctx-menu) — assert it
	// shows the expected items.
	const menu = page.locator('.ctx-menu');
	await expect(menu).toBeVisible({ timeout: 5_000 });
	await expect(menu).toContainText(/transformer en/i);
	await expect(menu).toContainText(/titre 1/i);
	await expect(menu).toContainText(/liste à puces/i);
	await expect(menu).toContainText(/citation/i);
	await expect(menu).toContainText(/bloc de code/i);
});

test('selecting "Titre 2" transforms the hovered H1 into an H2', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const firstBlock = page.locator('.bn-editor.ProseMirror .bn-block').first();
	await firstBlock.hover();

	// Count H1s and H2s before the transform.
	const h1Before = await page.locator('.bn-editor.ProseMirror h1').count();
	const h2Before = await page.locator('.bn-editor.ProseMirror h2').count();

	const handle = page.locator('[data-testid="bn-side-menu"]').getByRole('button', {
		name: /drag/i
	});
	await expect(handle).toBeVisible({ timeout: 5_000 });
	await handle.click({ force: true });

	const menu = page.locator('.ctx-menu');
	await expect(menu).toBeVisible({ timeout: 5_000 });
	await menu.getByText('Titre 2', { exact: true }).click({ force: true });

	// One H1 should be gone, one H2 should be added.
	await expect.poll(async () => page.locator('.bn-editor.ProseMirror h2').count())
		.toBe(h2Before + 1);
	await expect.poll(async () => page.locator('.bn-editor.ProseMirror h1').count())
		.toBe(h1Before - 1);
});

test('clicking + inserts a new paragraph after the hovered block', async ({ page }) => {
	await gotoFixture(page, 'headings');
	const firstBlock = page.locator('.bn-editor.ProseMirror .bn-block').first();
	await firstBlock.hover();

	const blockCountBefore = await page
		.locator('.bn-editor.ProseMirror .bn-block-outer')
		.count();

	const addBtn = page.locator('[data-testid="bn-side-menu"]').getByRole('button', {
		name: /add block/i
	});
	await expect(addBtn).toBeVisible({ timeout: 5_000 });
	await addBtn.click({ force: true });

	await expect.poll(async () =>
		page.locator('.bn-editor.ProseMirror .bn-block-outer').count()
	).toBe(blockCountBefore + 1);
});
