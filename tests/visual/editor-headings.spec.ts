import { test } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

test('headings render with the IDE-density Geist scale (P0 bug #3)', async ({ page }) => {
	await gotoFixture(page, 'headings');
	await snap(page, 'editor-headings.png');
});
