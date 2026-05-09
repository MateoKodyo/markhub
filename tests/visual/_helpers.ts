import { expect, type Page } from '@playwright/test';

/**
 * Navigate to a visual fixture and wait until the editor is fully painted:
 *   1. Crepe has produced its `.milkdown` wrapper.
 *   2. The ProseMirror contenteditable has rendered the body content.
 *   3. Web fonts (Geist Sans / Geist Mono) have loaded — otherwise the
 *      first screenshot captures the fallback typeface and is unstable.
 *   4. A short settle frame for ProseMirror's internal layout to commit.
 */
export async function gotoFixture(page: Page, fixture: string): Promise<void> {
	await page.goto(`/_visual?fixture=${fixture}`);
	await page.waitForSelector('.milkdown .ProseMirror', { state: 'attached' });
	await page.waitForFunction(() => {
		const pm = document.querySelector('.milkdown .ProseMirror');
		return !!pm && pm.children.length > 0;
	});
	await page.evaluate(() => document.fonts.ready);
	// Two frames: ProseMirror finalizes layout on the next animation tick.
	await page.evaluate(
		() =>
			new Promise<void>((r) =>
				requestAnimationFrame(() => requestAnimationFrame(() => r()))
			)
	);
}

/**
 * Take a stabilized screenshot of the editor area.
 * Animations are disabled to avoid flicker between baseline and run.
 */
export async function snap(page: Page, name: string): Promise<void> {
	await expect(page).toHaveScreenshot(name, {
		animations: 'disabled',
		caret: 'hide',
		fullPage: false,
		maxDiffPixelRatio: 0.01
	});
}
