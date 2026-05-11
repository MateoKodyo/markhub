import { test, expect, type Page } from '@playwright/test';

/**
 * Visual baseline for the launch screen (no file open).
 *
 * The EmptyState fixture renders the brand wordmark, the 4 action cards
 * (Open / Create / Clone / Sample), and a recent-vaults list. It is the
 * first thing Matheo sees when launching the app, so we lock its visual
 * identity here. PLAN-DESIGN-DEFAULTS §STEP 9.
 *
 * Unlike the editor-centric fixtures, EmptyState does not mount a
 * BlockNote instance, so we wait on its own testid instead of
 * `.bn-editor.ProseMirror`.
 */
async function gotoEmptyState(
	page: Page,
	fixture: 'empty-state' | 'empty-state-no-recents',
	theme: 'light' | 'dark' = 'dark'
): Promise<void> {
	const themeQS = theme === 'light' ? '&theme=light' : '';
	await page.goto(`/_visual?fixture=${fixture}${themeQS}`);
	await page.evaluate((t) => {
		if (t === 'light') {
			document.documentElement.setAttribute('data-theme', 'light');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}, theme);
	await page.waitForSelector('[data-testid="empty-state"]', { state: 'visible' });
	await page.evaluate(() => document.fonts.ready);
	await page.evaluate(
		() =>
			new Promise<void>((r) =>
				requestAnimationFrame(() => requestAnimationFrame(() => r()))
			)
	);
}

test('empty state — dark theme with recent vaults', async ({ page }) => {
	await gotoEmptyState(page, 'empty-state', 'dark');
	await expect(page.getByTestId('empty-state')).toBeVisible();
	await expect(page.getByTestId('recent-vaults')).toBeVisible();
	await expect(page).toHaveScreenshot('empty-state-dark.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: false,
		maxDiffPixelRatio: 0.01
	});
});

test('empty state — dark theme, no recent vaults', async ({ page }) => {
	await gotoEmptyState(page, 'empty-state-no-recents', 'dark');
	await expect(page.getByTestId('empty-state')).toBeVisible();
	await expect(page.getByTestId('recent-vaults')).toHaveCount(0);
	await expect(page).toHaveScreenshot('empty-state-dark-no-recents.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: false,
		maxDiffPixelRatio: 0.01
	});
});

test('empty state — light theme with recent vaults', async ({ page }) => {
	await gotoEmptyState(page, 'empty-state', 'light');
	await expect(page.getByTestId('empty-state')).toBeVisible();
	await expect(page).toHaveScreenshot('empty-state-light.png', {
		animations: 'disabled',
		caret: 'hide',
		fullPage: false,
		maxDiffPixelRatio: 0.01
	});
});
