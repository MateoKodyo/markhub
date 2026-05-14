import { expect, type Page } from '@playwright/test';

/**
 * Navigate to a visual fixture and wait until the editor is fully painted:
 *   1. BlockNote has produced its `.bn-container` (`.ProseMirror` lives
 *      inside, but BlockNote also wraps it with its own root).
 *   2. The contenteditable has rendered the body content.
 *   3. Web fonts (Geist Sans / Geist Mono) have loaded — otherwise the
 *      first screenshot captures the fallback typeface and is unstable.
 *   4. A short settle frame for ProseMirror's internal layout to commit.
 */
export async function gotoFixture(
	page: Page,
	fixture: string,
	theme?: 'light' | 'dark' | 'markhub-light' | 'markhub-dark' | 'cocoa' | 'forest'
): Promise<void> {
	// Resolve to a catalog id. The legacy `light`/`dark` shortcuts map to the
	// Markhub defaults so older specs keep working without edits.
	const themeId =
		theme === 'light' || theme === 'markhub-light'
			? 'markhub-light'
			: theme === 'cocoa'
				? 'cocoa'
				: theme === 'forest'
					? 'forest'
					: 'markhub-dark';
	await page.goto(`/_visual?fixture=${fixture}&theme=${themeId}`);
	// Force the theme attribute via Playwright too — onMount of the fixture
	// page also does this, but setting it from the test side guarantees the
	// attribute is in place even if Svelte's hydration runs in an order where
	// the screenshot would otherwise capture the dark fallback.
	await page.evaluate((id) => {
		document.documentElement.setAttribute('data-theme', id);
	}, themeId);
	// BlockNote (post-bascule) renders blocks under `.bn-container` /
	// `.bn-editor` with the ProseMirror surface inside. Match the deepest
	// container that exists in both modes so we wait for actual paint.
	await page.waitForSelector('.bn-editor.ProseMirror', { state: 'attached' });
	await page.waitForFunction(() => {
		const pm = document.querySelector('.bn-editor.ProseMirror');
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
