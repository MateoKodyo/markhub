import { test } from '@playwright/test';
import { gotoFixture, snap } from './_helpers';

// Task list checkboxes need a clear checked vs unchecked distinction.
// BlockNote ships native checkboxes inside .bn-block-content[data-content-
// type="checkListItem"]; we tint the accent color via editor-blocknote.css
// so the checked state matches the Markhub design system.
test('task list checkboxes are visibly differentiated', async ({ page }) => {
	await gotoFixture(page, 'task-list');
	await snap(page, 'task-list.png');
});
