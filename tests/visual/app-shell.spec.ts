import { test, expect } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// End-to-end shell screenshot: sidebar (darker tier) + editor canvas + status
// bar pinned to the bottom. Validates the full chrome layout in one shot.
test('app shell renders sidebar, editor and status bar', async ({ page }) => {
	await gotoFixture(page, 'app-shell');

	// Status bar present and shows word count + save status.
	const statusBar = page.locator('footer.status-bar');
	await expect(statusBar).toBeVisible();
	await expect(statusBar).toContainText('Notes perso');
	await expect(statusBar).toContainText('subfolder/architecture.md');
	await expect(statusBar).toContainText(/mots/);
	await expect(statusBar).toContainText('Sauvegardé');

	await snap(page, 'app-shell.png');
});
