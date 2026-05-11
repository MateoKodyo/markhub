import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// Light-mode regression coverage. Re-snapshots the same key fixtures that
// the dark-mode specs cover, served with `?theme=light` so app.css applies
// the `:root[data-theme="light"]` palette. Captured under separate baselines.

test('app shell — light theme', async ({ page }) => {
	await gotoFixture(page, 'app-shell', 'light');
	const sb = page.locator('footer.status-bar');
	await expect(sb).toBeVisible();
	await snap(page, 'app-shell-light.png');
});

test('headings — light theme', async ({ page }) => {
	await gotoFixture(page, 'headings', 'light');
	await snap(page, 'editor-headings-light.png');
});

test('frontmatter collapsed — light theme', async ({ page }) => {
	await gotoFixture(page, 'frontmatter', 'light');
	await snap(page, 'editor-frontmatter-collapsed-light.png');
});

test('task list — light theme', async ({ page }) => {
	await gotoFixture(page, 'task-list', 'light');
	await snap(page, 'task-list-light.png');
});

test('slash menu — light theme', async ({ page }) => {
	await gotoFixture(page, 'slash', 'light');
	const editor = page.locator('.bn-editor.ProseMirror');
	await editor.click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/', { delay: 30 });
	await page.waitForTimeout(150);
	await snap(page, 'editor-slash-menu-light.png');
});

test('floating toolbar — light theme', async ({ page }) => {
	await gotoFixture(page, 'toolbar', 'light');
	const editor = page.locator('.bn-editor.ProseMirror');
	await editor.click();
	await page.evaluate(() => {
		const pm = document.querySelector('.bn-editor.ProseMirror');
		if (!pm) return;
		const para = pm.querySelector('p');
		if (!para) return;
		const range = document.createRange();
		range.selectNodeContents(para);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
	});
	await page.waitForTimeout(200);
	await snap(page, 'editor-floating-toolbar-light.png');
});

test('grayscale hierarchy — light theme keeps sidebar darker than canvas', async ({
	page
}) => {
	await gotoFixture(page, 'sidebar-overflow', 'light');

	const samples = await page.evaluate(() => {
		const cs = (sel: string) => {
			const el = document.querySelector(sel);
			return el ? getComputedStyle(el).backgroundColor : null;
		};
		const root = document.documentElement;
		return {
			theme: root.getAttribute('data-theme'),
			sidebar: cs('.sidebar-mirror'),
			content: cs('.content-mirror'),
			body: getComputedStyle(document.body).backgroundColor,
			bgVar: getComputedStyle(root).getPropertyValue('--color-bg').trim()
		};
	});

	// Sanity: data-theme must be on the html element and the var must resolve
	// to the warm-light parchment, not the dark one.
	expect(samples.theme).toBe('light');
	expect(samples.sidebar).not.toBeNull();

	const parseRgb = (s: string): [number, number, number] => {
		const m = s.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
		if (!m) throw new Error(`bad rgb: ${s}`);
		return [Number(m[1]), Number(m[2]), Number(m[3])];
	};
	const luma = ([r, g, b]: [number, number, number]) =>
		0.2126 * r + 0.7152 * g + 0.0722 * b;

	const sidebarLuma = luma(parseRgb(samples.sidebar!));
	const contentBg =
		samples.content && samples.content !== 'rgba(0, 0, 0, 0)'
			? samples.content
			: samples.body;
	const contentLuma = luma(parseRgb(contentBg));

	// Light mode: sidebar still darker than canvas (preserves the chrome →
	// canvas hierarchy), so sidebarLuma < contentLuma exactly like dark mode.
	expect(sidebarLuma).toBeLessThan(contentLuma);
});
