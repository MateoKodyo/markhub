import { test } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// SUSPENDED — Crepe slash-menu screenshot. After PLAN-BLOCKNOTE étape 4,
// the main editor uses BlockNote and the Svelte slash menu is exercised
// by tests/visual/blocknote-slash-menu.spec.ts. We keep this skipped
// (rather than deleted) until step 5 cleanup so the diff stays minimal.
test.describe.skip('Crepe slash menu screenshot (suspended — replaced by blocknote-slash-menu.spec.ts)', () => {
test('slash menu opens at caret without double-rendering (P0 bug #1)', async ({ page }) => {
	await gotoFixture(page, 'slash');
	// Click into Crepe so ProseMirror takes focus, then move to a fresh empty line.
	const editor = page.locator('.milkdown .ProseMirror');
	await editor.click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/', { delay: 30 });
	// Give the menu time to mount + position.
	await page.waitForTimeout(150);
	await snap(page, 'editor-slash-menu.png');
});
});
