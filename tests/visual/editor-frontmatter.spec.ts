import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

test('frontmatter renders as a collapsed monospace <details> block (P0 bug #2)', async ({
	page
}) => {
	await gotoFixture(page, 'frontmatter');
	// Sanity check: the Svelte wrapper renders the <details> block ABOVE the editor.
	const details = page.locator('details[data-frontmatter]');
	await expect(details).toBeVisible();
	await snap(page, 'editor-frontmatter-collapsed.png');

	// Open it to capture the expanded monospace YAML rendering.
	await details.locator('summary').click();
	await snap(page, 'editor-frontmatter-open.png');
});
