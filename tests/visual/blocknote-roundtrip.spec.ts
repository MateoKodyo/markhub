import { test, expect } from '@playwright/test';

// C1 / Étape 2 — round-trip probe.
// Visit the dev-only route and read the auto-computed status badges.
// We don't fail on diffs here (some are expected: cosmetic reformat).
// The job is to capture the exact diff per fixture and report it.

const FIXTURES = [
	{ id: '01-frontmatter', label: '01 frontmatter + headings + lists' },
	{ id: '02-rich', label: '02 table + code + tasks + quote' },
	{ id: '03-inline', label: '03 links + emphases + hr' }
];

test('BlockNote round-trip — capture body diffs per fixture', async ({ page }) => {
	await page.goto('/_blocknote-test');
	// Wait until each fixture has produced its status badge.
	for (const fx of FIXTURES) {
		await page.waitForSelector(`[data-testid="fixture-${fx.id}-status"]`, {
			state: 'visible',
			timeout: 30_000
		});
	}

	const report: Array<{
		fixture: string;
		bodyIdentical: boolean;
		statusText: string;
		fullOutput: string;
	}> = [];

	for (const fx of FIXTURES) {
		const status = await page.locator(`[data-testid="fixture-${fx.id}-status"]`).innerText();
		const out = await page.locator(`[data-testid="fixture-${fx.id}-output"]`).innerText();
		report.push({
			fixture: fx.label,
			statusText: status,
			bodyIdentical: status.includes('OK'),
			fullOutput: out
		});
	}

	// The smoke editor must be ready too (interactive panel mounted).
	await expect(page.locator('.bn-interactive[data-ready="true"]')).toBeVisible();

	// Print full outputs so the test log is the actual report.
	for (const r of report) {
		console.log('═══════════════════════════════════════════════');
		console.log(`Fixture: ${r.fixture}`);
		console.log(`Status:  ${r.statusText}`);
		console.log('--- ROUND-TRIP OUTPUT ---');
		console.log(r.fullOutput);
		console.log('--- END ---\n');
	}

	// Capture a screenshot of the full probe page for the record.
	await page.screenshot({
		path: 'tests/visual/blocknote-roundtrip.spec.ts-snapshots/probe-fullpage.png',
		fullPage: true
	});

	// All three fixtures must have produced an output (status badge resolved).
	expect(report.length).toBe(3);
	for (const r of report) expect(r.statusText).not.toBe('…');
});
