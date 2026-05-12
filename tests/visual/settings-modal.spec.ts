import { test, expect, type Page } from '@playwright/test';

/**
 * Visual baselines for the Settings modal shell (PLAN-SETTINGS STEP 2).
 *
 * STEP 2 ships the shell only: backdrop, modal panel, header with title and
 * close button, left-rail navigation across 6 sections, and a placeholder
 * right pane. STEP 3+ will fill the right pane with actual controls and
 * regenerate these baselines.
 */
async function gotoSettings(
	page: Page,
	theme: 'light' | 'dark' = 'dark',
	section: 'appearance' | 'editor' | 'source' | 'files' | 'behavior' | 'advanced' = 'appearance'
): Promise<void> {
	const themeQS = theme === 'light' ? '&theme=light' : '';
	await page.goto(`/_visual?fixture=settings-modal&section=${section}${themeQS}`);
	await page.evaluate((t) => {
		if (t === 'light') {
			document.documentElement.setAttribute('data-theme', 'light');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}, theme);
	await page.waitForSelector('[data-testid="settings-modal"]', { state: 'visible' });
	await page.evaluate(() => document.fonts.ready);
}

test.describe('settings modal — shell baseline', () => {
	test('dark theme', async ({ page }) => {
		await gotoSettings(page, 'dark', 'appearance');
		await expect(page).toHaveScreenshot('settings-modal-dark.png', {
			maxDiffPixelRatio: 0.01
		});
	});

	test('light theme', async ({ page }) => {
		await gotoSettings(page, 'light', 'appearance');
		await expect(page).toHaveScreenshot('settings-modal-light.png', {
			maxDiffPixelRatio: 0.01
		});
	});

	test('deep-link to advanced section', async ({ page }) => {
		// Asserts that ?section=advanced wires straight into the rail's active
		// state — the same mechanism PLAN-COMMAND-SYSTEM will use for
		// `settings.open.advanced`.
		await gotoSettings(page, 'dark', 'advanced');
		const advanced = page.getByTestId('settings-rail-advanced');
		await expect(advanced).toHaveAttribute('aria-current', 'true');
		const appearance = page.getByTestId('settings-rail-appearance');
		await expect(appearance).not.toHaveAttribute('aria-current', 'true');
	});

	test('escape closes the modal', async ({ page }) => {
		await gotoSettings(page);
		await page.keyboard.press('Escape');
		await expect(page.getByTestId('settings-modal')).toHaveCount(0);
	});

	test('editor section — dark theme', async ({ page }) => {
		await gotoSettings(page, 'dark', 'editor');
		await expect(page).toHaveScreenshot('settings-modal-editor-dark.png', {
			maxDiffPixelRatio: 0.01
		});
	});

	test('editor section — light theme', async ({ page }) => {
		await gotoSettings(page, 'light', 'editor');
		await expect(page).toHaveScreenshot('settings-modal-editor-light.png', {
			maxDiffPixelRatio: 0.01
		});
	});

	test('clicking the backdrop closes the modal', async ({ page }) => {
		await gotoSettings(page);
		const backdrop = page.getByTestId('settings-backdrop');
		// Click the corner — well outside the centered modal panel.
		const box = await backdrop.boundingBox();
		if (!box) throw new Error('backdrop has no bounding box');
		await page.mouse.click(box.x + 10, box.y + 10);
		await expect(page.getByTestId('settings-modal')).toHaveCount(0);
	});
});
