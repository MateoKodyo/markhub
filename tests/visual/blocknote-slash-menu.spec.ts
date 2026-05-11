import { test, expect } from '@playwright/test';

// C1 / Étape 2.5.a — slash menu Svelte UI on top of BlockNote's
// SuggestionMenu plugin. The plugin owns the state; our component
// renders it. We test the integration end-to-end here on the dev
// route so the BlockNote default config + our wiring are exercised
// for real.

test('typing "/" in the smoke editor opens our slash menu with default items', async ({
	page
}) => {
	await page.goto('/_blocknote-test');
	// Wait for the smoke editor to be wired (mountInteractive ran).
	await expect(page.locator('.bn-interactive[data-ready="true"]')).toBeVisible();

	// BlockNote renders blocks under .bn-block-group inside the mount node.
	// Click on the last block to land the caret at end-of-doc, then type.
	const lastBlock = page.locator('.bn-interactive .bn-block').last();
	await lastBlock.click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/', { delay: 30 });

	// Our menu must be visible with default items (Heading 1, Bullet List, etc).
	const menu = page.locator('[data-testid="bn-slash-menu"]');
	await expect(menu).toBeVisible({ timeout: 5_000 });
	await expect(menu).toContainText(/heading/i);

	// Filter by typing "head" — should narrow to heading-related items.
	await page.keyboard.type('head', { delay: 30 });
	await expect(menu).toContainText(/heading/i);
	await expect(menu).not.toContainText(/bullet list/i);
});

test('selecting "Heading 1" transforms the current block into an H1', async ({ page }) => {
	await page.goto('/_blocknote-test');
	await expect(page.locator('.bn-interactive[data-ready="true"]')).toBeVisible();

	const lastBlock = page.locator('.bn-interactive .bn-block').last();
	await lastBlock.click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/h1', { delay: 20 });

	const menu = page.locator('[data-testid="bn-slash-menu"]');
	await expect(menu).toBeVisible({ timeout: 5_000 });

	// Count H1s already present, then click the heading item by visible label.
	const h1Before = await page.locator('.bn-interactive h1.bn-inline-content').count();
	const headingItem = menu.locator('button').filter({ hasText: /heading 1/i }).first();
	await expect(headingItem).toBeVisible();
	// Our component preventDefaults mousedown to keep editor focus, so a
	// synthesized click() may not "take" — fire mousedown directly.
	await headingItem.dispatchEvent('mousedown');

	// One additional H1 must now exist in the smoke editor.
	await expect.poll(async () =>
		page.locator('.bn-interactive h1.bn-inline-content').count()
	).toBeGreaterThan(h1Before);
});
