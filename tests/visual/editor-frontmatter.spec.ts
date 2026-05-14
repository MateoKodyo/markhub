import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

/**
 * Visual baselines for the FrontmatterBlock states (PLAN-FRONTMATTER-UI
 * STEP 7). Captures every meaningful state on the dark default so the
 * polish work has a stable reference. Light-mode variants live in
 * `light-mode.spec.ts` so the dark/light suites can be run independently.
 */

test('FrontmatterBlock — read mode, collapsed (default)', async ({ page }) => {
	await gotoFixture(page, 'frontmatter');
	// The new block exposes a stable test id; the old `<details>` selector
	// is gone with the STEP 2 replacement.
	const block = page.getByTestId('frontmatter-read');
	await expect(block).toBeVisible();
	await expect(block).toHaveAttribute('data-collapsed', 'true');
	await snap(page, 'editor-frontmatter-collapsed.png');
});

test('FrontmatterBlock — read mode, expanded with chips + date + booleans', async ({
	page
}) => {
	await gotoFixture(page, 'frontmatter');
	await page.getByTestId('frontmatter-toggle').click();
	const block = page.getByTestId('frontmatter-read');
	await expect(block).toHaveAttribute('data-collapsed', 'false');
	// Tag chips render visually.
	await expect(page.getByTestId('frontmatter-read-chips')).toBeVisible();
	await snap(page, 'editor-frontmatter-expanded.png');
});

test('FrontmatterBlock — structured edit mode with typed controls', async ({
	page
}) => {
	await gotoFixture(page, 'frontmatter');
	await page.getByTestId('frontmatter-toggle').click();
	await page.getByTestId('frontmatter-edit-btn').click();
	const editor = page.getByTestId('frontmatter-edit-structured');
	await expect(editor).toBeVisible();
	// Sanity: each typed control has a row rendered for it.
	await expect(page.getByTestId('frontmatter-edit-toggle')).toBeVisible();
	await expect(page.getByTestId('frontmatter-edit-value-number')).toBeVisible();
	await expect(page.getByTestId('frontmatter-edit-value-date')).toBeVisible();
	await expect(page.getByTestId('frontmatter-edit-value-tags')).toBeVisible();
	await snap(page, 'editor-frontmatter-edit-structured.png');
});

test('FrontmatterBlock — raw YAML edit mode', async ({ page }) => {
	await gotoFixture(page, 'frontmatter');
	await page.getByTestId('frontmatter-toggle').click();
	await page.getByTestId('frontmatter-edit-btn').click();
	await page.getByTestId('frontmatter-to-raw-btn').click();
	const raw = page.getByTestId('frontmatter-edit-raw');
	await expect(raw).toBeVisible();
	const textarea = page.getByTestId('frontmatter-raw-textarea');
	await expect(textarea).toBeVisible();
	await snap(page, 'editor-frontmatter-edit-raw.png');
});

test('FrontmatterBlock — empty state (file without frontmatter)', async ({
	page
}) => {
	await gotoFixture(page, 'frontmatter-empty');
	// No frontmatter → the block renders nothing in the canvas wrapper.
	// In Editor.svelte the block is only mounted when data !== null OR
	// parseError !== null; this fixture therefore has no block at all.
	await expect(page.getByTestId('frontmatter-empty')).toHaveCount(0);
	await snap(page, 'editor-frontmatter-no-block.png');
});

test('FrontmatterBlock — error state (malformed YAML)', async ({ page }) => {
	await gotoFixture(page, 'frontmatter-error');
	const banner = page.getByTestId('frontmatter-error');
	await expect(banner).toBeVisible();
	await expect(banner).toContainText(/invalide/i);
	await expect(page.getByTestId('frontmatter-edit-raw-btn')).toBeVisible();
	await snap(page, 'editor-frontmatter-error.png');
});
