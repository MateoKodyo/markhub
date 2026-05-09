import { test } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

test('floating toolbar appears above the selection (P0 bug #4)', async ({ page }) => {
	await gotoFixture(page, 'toolbar');
	const editor = page.locator('.milkdown .ProseMirror');
	await editor.click();

	// Select the second paragraph entirely via DOM range — more deterministic
	// than triple-click for a screenshot test.
	await page.evaluate(() => {
		const pm = document.querySelector('.milkdown .ProseMirror');
		if (!pm) return;
		const paragraphs = pm.querySelectorAll('p');
		if (paragraphs.length === 0) return;
		const target = paragraphs[0];
		const range = document.createRange();
		range.selectNodeContents(target);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	});
	await page.waitForTimeout(200);
	await snap(page, 'editor-floating-toolbar.png');
});
