import { test, expect } from '@playwright/test';
import { gotoFixture } from './_helpers';

// C1 / Étape 2.5.e — Svelte UI for BlockNote's LinkToolbar plugin.
// Tested through the /_visual?fixture=link route which loads a doc with
// a single inline link. The linkToolbar plugin is query-only (no store);
// Editor.svelte polls `getLinkAtSelection()` on every onSelectionChange.

test('clicking inside an existing link shows the link toolbar', async ({ page }) => {
	await gotoFixture(page, 'link');
	const link = page.locator('.bn-editor.ProseMirror a').first();
	await expect(link).toBeVisible({ timeout: 5_000 });
	await link.click();

	const toolbar = page.locator('[data-testid="bn-link-toolbar"]');
	await expect(toolbar).toBeVisible({ timeout: 5_000 });
	const input = toolbar.getByLabel('URL');
	await expect(input).toBeVisible();
	// Input is pre-filled with the link's current href.
	await expect(input).toHaveValue('https://example.com');
});

test('editing the URL and pressing Enter updates the link in the editor', async ({ page }) => {
	await gotoFixture(page, 'link');
	const link = page.locator('.bn-editor.ProseMirror a').first();
	await expect(link).toBeVisible({ timeout: 5_000 });
	await link.click();

	const toolbar = page.locator('[data-testid="bn-link-toolbar"]');
	await expect(toolbar).toBeVisible({ timeout: 5_000 });
	const input = toolbar.getByLabel('URL');
	await input.fill('https://updated.example.com');
	await input.press('Enter');

	// The link's href should have updated.
	await expect
		.poll(async () => page.locator('.bn-editor.ProseMirror a').first().getAttribute('href'))
		.toBe('https://updated.example.com');
});

test('clicking the trash button removes the link, keeping the text', async ({ page }) => {
	await gotoFixture(page, 'link');
	const link = page.locator('.bn-editor.ProseMirror a').first();
	await expect(link).toBeVisible({ timeout: 5_000 });
	const linkText = await link.textContent();
	await link.click();

	const toolbar = page.locator('[data-testid="bn-link-toolbar"]');
	await expect(toolbar).toBeVisible({ timeout: 5_000 });
	const trash = toolbar.getByRole('button', { name: /supprimer/i });
	// `mousedown.preventDefault()` blocks the actionability check.
	await trash.dispatchEvent('mousedown');

	await expect.poll(async () => page.locator('.bn-editor.ProseMirror a').count()).toBe(0);
	// The text remains.
	await expect(page.locator('.bn-editor.ProseMirror')).toContainText(linkText ?? '');
});
