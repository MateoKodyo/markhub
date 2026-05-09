import { defineConfig } from '@playwright/test';

// E2E config: Tauri runs via tauri-driver (WebDriver protocol).
// The driver is launched per-test in tests/e2e/* helpers — see Phase 5.
// This config wires the test directory and standard reporters.
export default defineConfig({
	testDir: './tests/e2e',
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [['list']]
});
