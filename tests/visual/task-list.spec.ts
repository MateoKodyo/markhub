import { test } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// Round 2 chantier 3 — task list checkboxes need a clear checked vs unchecked
// distinction. Crepe ships .checked and .unchecked SVG icons in
// .label-wrapper, both filled with --crepe-color-outline (one gray tone).
// We restyle: unchecked stays muted/empty; checked turns accent-blue with
// the check icon contrasted.
test('task list checkboxes are visibly differentiated', async ({ page }) => {
	await gotoFixture(page, 'task-list');
	await snap(page, 'task-list.png');
});
