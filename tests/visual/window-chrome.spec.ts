import { test, expect, type Page } from '@playwright/test';

/**
 * Visual baseline for the macOS-overlay window chrome strip.
 *
 * STEP 7 of PLAN-DESIGN-DEFAULTS introduced a 44px chrome bar that
 * leaves an 80px gutter on the left for the traffic lights and places
 * a 24×24 PanelLeft toggle aligned to their vertical center.
 *
 * Playwright's browser does NOT render macOS traffic lights — what we
 * lock here is the strip layout: height, padding, toggle position +
 * visual style in both "sidebar open" and "sidebar collapsed" states.
 */
async function gotoChrome(
	page: Page,
	fixture: 'window-chrome' | 'window-chrome-collapsed',
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
	await page.waitForSelector('.window-chrome', { state: 'visible' });
	await page.evaluate(() => document.fonts.ready);
	await page.evaluate(
		() =>
			new Promise<void>((r) =>
				requestAnimationFrame(() => requestAnimationFrame(() => r()))
			)
	);
}

test('window chrome — sidebar open (toggle active)', async ({ page }) => {
	await gotoChrome(page, 'window-chrome', 'dark');
	const strip = page.locator('.window-chrome');
	await expect(strip).toBeVisible();
	await expect(page.locator('.chrome-toggle.is-active')).toBeVisible();
	// Crop to the chrome strip + first slice of the body so the diff
	// surfaces alignment regressions without re-locking the rest of the app.
	await expect(page).toHaveScreenshot('window-chrome-dark-open.png', {
		clip: { x: 0, y: 0, width: 1280, height: 80 },
		animations: 'disabled',
		caret: 'hide',
		maxDiffPixelRatio: 0.01
	});
});

test('window chrome — sidebar collapsed (toggle inactive)', async ({ page }) => {
	await gotoChrome(page, 'window-chrome-collapsed', 'dark');
	const strip = page.locator('.window-chrome');
	await expect(strip).toBeVisible();
	await expect(page.locator('.chrome-toggle.is-active')).toHaveCount(0);
	await expect(page).toHaveScreenshot('window-chrome-dark-collapsed.png', {
		clip: { x: 0, y: 0, width: 1280, height: 80 },
		animations: 'disabled',
		caret: 'hide',
		maxDiffPixelRatio: 0.01
	});
});
