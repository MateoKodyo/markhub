import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// Round 2 chantier 2 — selection highlight must be visible. Default browser
// blue is too bright on the warm-dark canvas; we use the accent at ~32%
// opacity. This spec asserts that the resolved ::selection background
// matches our token AND captures a screenshot of an active selection.

test('preview-mode selection uses the accent-tinted highlight', async ({ page }) => {
	await gotoFixture(page, 'toolbar');
	const editor = page.locator('.milkdown .ProseMirror');
	await editor.click();

	// Select the body paragraph. (Triple-click selects a paragraph in PM.)
	await page.evaluate(() => {
		const pm = document.querySelector('.milkdown .ProseMirror');
		if (!pm) return;
		const para = pm.querySelector('p');
		if (!para) return;
		const range = document.createRange();
		range.selectNodeContents(para);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	});
	await page.waitForTimeout(150);

	// Resolved selection background must be our token, BOTH on a body element
	// AND on a ProseMirror descendant where Crepe also injects a rule.
	const selBgs = await page.evaluate(() => {
		const probe = document.createElement('span');
		probe.textContent = 'x';
		document.body.appendChild(probe);
		const bodyBg = getComputedStyle(probe, '::selection').backgroundColor;
		probe.remove();
		const pmEl = document.querySelector('.milkdown .ProseMirror p');
		const pmBg = pmEl
			? getComputedStyle(pmEl, '::selection').backgroundColor
			: null;
		return { bodyBg, pmBg };
	});
	// Tolerant: any rgba with the blue accent components, alpha > 0.
	expect(selBgs.bodyBg).toMatch(/rgba?\(\s*59,\s*130,\s*246/);
	expect(selBgs.pmBg).toMatch(/rgba?\(\s*59,\s*130,\s*246/);

	await snap(page, 'text-selection-preview.png');
});
