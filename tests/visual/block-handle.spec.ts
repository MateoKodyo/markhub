import { test, expect } from '@playwright/test';
import { gotoFixture } from './_helpers';

// Crepe paints both `+` (functional) and `⋮⋮` (decorative — no handler
// attached upstream) inside .milkdown-block-handle. We hide the second
// .operation-item (⋮⋮) so the affordance no longer lies to users; the
// `+` stays clickable and useful (insert below + slash menu).
test('block handle hides the ⋮⋮ icon, keeps the + clickable', async ({ page }) => {
	await gotoFixture(page, 'headings');

	// Trigger the block handle by hovering the H1 line.
	const h1 = page.locator('.milkdown .ProseMirror h1').first();
	await h1.hover();
	// Crepe positions the handle async; wait for it to flip data-show.
	await page.waitForFunction(
		() =>
			document
				.querySelector('.milkdown-block-handle')
				?.getAttribute('data-show') === 'true'
	);

	const probes = await page.evaluate(() => {
		const handle = document.querySelector('.milkdown-block-handle');
		if (!handle) return null;
		const items = Array.from(handle.querySelectorAll('.operation-item'));
		return {
			itemCount: items.length,
			firstDisplay: items[0] ? getComputedStyle(items[0]).display : null,
			secondDisplay: items[1] ? getComputedStyle(items[1]).display : null
		};
	});

	expect(probes).not.toBeNull();
	// Crepe still ships two children (it's their template).
	expect(probes!.itemCount).toBe(2);
	// The `+` (first child) must remain visible.
	expect(probes!.firstDisplay).not.toBe('none');
	// The decorative ⋮⋮ (second child) must be hidden.
	expect(probes!.secondDisplay).toBe('none');
});
