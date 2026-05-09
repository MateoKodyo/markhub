import { test } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

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
