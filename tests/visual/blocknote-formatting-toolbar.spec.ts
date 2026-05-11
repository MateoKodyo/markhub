import { test, expect, type Page } from '@playwright/test';

// C1 / Étape 2.5.b — formatting toolbar Svelte UI on top of BlockNote's
// FormattingToolbar plugin. The plugin reports show/hide via a boolean
// store; we anchor the toolbar from window.getSelection() and apply marks
// through editor.toggleStyles().

const SAMPLE = 'Hello formatting toolbar';

async function typeAndSelect(page: Page, text: string) {
	// Land the caret at the end of the existing doc.
	const lastBlock = page.locator('.bn-interactive .bn-block').last();
	await lastBlock.click();
	await page.keyboard.press('End');
	// Two enters → start a fresh empty paragraph after the rich fixture so
	// the FormattingToolbar plugin's `n()` calculator (which rejects code
	// blocks) sees a plain text selection.
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type(text, { delay: 10 });
	// Select the line we just typed. Plain Shift+Home was unreliable in
	// BlockNote's contenteditable, so we walk the caret backwards with
	// Shift+ArrowLeft once per character — equivalent and deterministic.
	await page.keyboard.down('Shift');
	for (let i = 0; i < text.length; i++) {
		await page.keyboard.press('ArrowLeft');
	}
	await page.keyboard.up('Shift');
}

test('selecting text in the smoke editor shows the formatting toolbar', async ({ page }) => {
	await page.goto('/_blocknote-test');
	await expect(page.locator('.bn-interactive[data-ready="true"]')).toBeVisible();

	await typeAndSelect(page, SAMPLE);

	const toolbar = page.locator('[data-testid="bn-formatting-toolbar"]');
	await expect(toolbar).toBeVisible({ timeout: 5_000 });

	// 5 buttons: Bold, Italic, Strikethrough, Inline code, Link.
	await expect(toolbar.getByRole('button', { name: /bold/i })).toBeVisible();
	await expect(toolbar.getByRole('button', { name: /italic/i })).toBeVisible();
	await expect(toolbar.getByRole('button', { name: /strike/i })).toBeVisible();
	await expect(toolbar.getByRole('button', { name: /code/i })).toBeVisible();
	await expect(toolbar.getByRole('button', { name: /link|lien/i })).toBeVisible();
});

test('clicking the bold button wraps the selection in <strong>', async ({ page }) => {
	await page.goto('/_blocknote-test');
	await expect(page.locator('.bn-interactive[data-ready="true"]')).toBeVisible();

	await typeAndSelect(page, 'boldly typed');

	const toolbar = page.locator('[data-testid="bn-formatting-toolbar"]');
	await expect(toolbar).toBeVisible({ timeout: 5_000 });

	const strongBefore = await page.locator('.bn-interactive strong').count();
	// Our component preventDefaults mousedown to keep editor focus, so we
	// dispatch mousedown directly (same pattern as the slash menu spec).
	await toolbar.getByRole('button', { name: /bold/i }).dispatchEvent('mousedown');

	await expect
		.poll(async () => page.locator('.bn-interactive strong').count())
		.toBeGreaterThan(strongBefore);
});

test('clicking the italic button wraps the selection in <em>', async ({ page }) => {
	await page.goto('/_blocknote-test');
	await expect(page.locator('.bn-interactive[data-ready="true"]')).toBeVisible();

	await typeAndSelect(page, 'italic me');

	const toolbar = page.locator('[data-testid="bn-formatting-toolbar"]');
	await expect(toolbar).toBeVisible({ timeout: 5_000 });

	const emBefore = await page.locator('.bn-interactive em').count();
	await toolbar.getByRole('button', { name: /italic/i }).dispatchEvent('mousedown');

	await expect
		.poll(async () => page.locator('.bn-interactive em').count())
		.toBeGreaterThan(emBefore);
});
