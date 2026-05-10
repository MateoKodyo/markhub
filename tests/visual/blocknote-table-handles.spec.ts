import { test, expect } from '@playwright/test';
import { gotoFixture } from './_helpers';

// C1 / Étape 2.5.d — Svelte UI for BlockNote's TableHandles plugin.
// We exercise the real Editor.svelte through the /_visual route with a
// table-only fixture so the affordances are easy to target.

test('hovering a table cell shows the row + col drag handles', async ({ page }) => {
	await gotoFixture(page, 'table');
	// Wait for the table to render with cells.
	const firstCell = page
		.locator('.bn-editor.ProseMirror [data-content-type="table"] td')
		.first();
	await expect(firstCell).toBeVisible({ timeout: 5_000 });
	await firstCell.hover();

	// The wrapper uses display:contents (no box), so we assert the
	// children directly — they are position:fixed elements with real
	// bounding boxes.
	await expect(page.locator('[data-testid="bn-table-row-handle"]')).toBeVisible({
		timeout: 5_000
	});
	await expect(page.locator('[data-testid="bn-table-col-handle"]')).toBeVisible();
});

test('row and col handles expose draggable="true"', async ({ page }) => {
	await gotoFixture(page, 'table');
	const firstCell = page
		.locator('.bn-editor.ProseMirror [data-content-type="table"] td')
		.first();
	await expect(firstCell).toBeVisible({ timeout: 5_000 });
	await firstCell.hover();

	const row = page.locator('[data-testid="bn-table-row-handle"]');
	const col = page.locator('[data-testid="bn-table-col-handle"]');
	await expect(row).toBeVisible({ timeout: 5_000 });
	await expect(col).toBeVisible();
	await expect(row).toHaveAttribute('draggable', 'true');
	await expect(col).toHaveAttribute('draggable', 'true');
});

test('clicking the add-row + appends a new row to the hovered row', async ({ page }) => {
	await gotoFixture(page, 'table');
	// Plugin shows the `+row` button only when the hovered cell is in the
	// LAST row (extensions-CkLT--Nc.js:1235). Hover any cell of the last
	// data row.
	const lastRowCell = page
		.locator('.bn-editor.ProseMirror [data-content-type="table"] tr')
		.last()
		.locator('td')
		.first();
	await expect(lastRowCell).toBeVisible({ timeout: 5_000 });
	await lastRowCell.hover();

	const rowsBefore = await page
		.locator('.bn-editor.ProseMirror [data-content-type="table"] tr')
		.count();

	const addRowBtn = page.locator('[data-testid="bn-table-add-row"]');
	await expect(addRowBtn).toBeVisible({ timeout: 5_000 });
	await addRowBtn.click({ force: true });

	await expect
		.poll(async () =>
			page.locator('.bn-editor.ProseMirror [data-content-type="table"] tr').count()
		)
		.toBe(rowsBefore + 1);
});

test('clicking the add-col + appends a new column to the hovered column', async ({ page }) => {
	await gotoFixture(page, 'table');
	// Plugin shows the `+col` button only when the hovered cell is in the
	// LAST column (extensions-CkLT--Nc.js:1234). Hover any cell of the
	// last column.
	const lastColCell = page
		.locator('.bn-editor.ProseMirror [data-content-type="table"] tr')
		.first()
		.locator('th, td')
		.last();
	await expect(lastColCell).toBeVisible({ timeout: 5_000 });
	await lastColCell.hover();

	// Count cells in the first row to assert column count grew by 1.
	const cellsInFirstRowBefore = await page
		.locator(
			'.bn-editor.ProseMirror [data-content-type="table"] tr:first-child td, .bn-editor.ProseMirror [data-content-type="table"] tr:first-child th'
		)
		.count();

	const addColBtn = page.locator('[data-testid="bn-table-add-col"]');
	await expect(addColBtn).toBeVisible({ timeout: 5_000 });
	await addColBtn.click({ force: true });

	await expect
		.poll(async () =>
			page
				.locator(
					'.bn-editor.ProseMirror [data-content-type="table"] tr:first-child td, .bn-editor.ProseMirror [data-content-type="table"] tr:first-child th'
				)
				.count()
		)
		.toBe(cellsInFirstRowBefore + 1);
});
