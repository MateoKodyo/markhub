import { defineConfig, devices } from '@playwright/test';

// Two test projects:
//   - "e2e"    : reserved for Tauri real-binary E2E (Phase 5, never wired).
//   - "visual" : screenshot-based regression of the Editor / Crepe rendering,
//                served by `vite dev` on a route (/_visual) that mounts the
//                Editor in isolation. This is the only mechanism that can
//                actually observe Crepe's rendered styles — jsdom cannot
//                evaluate the cascaded CSS (see JOURNAL Étape 1).
export default defineConfig({
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: [['list']],

	// Boot vite dev server only for the "visual" project. The "e2e" project
	// is left untouched (it has its own driver wiring once Phase 5 lands).
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:1420/',
		reuseExistingServer: !process.env.CI,
		timeout: 60_000
	},

	projects: [
		{
			name: 'visual',
			testDir: './tests/visual',
			use: {
				...devices['Desktop Chrome'],
				baseURL: 'http://localhost:1420',
				viewport: { width: 1280, height: 800 }
			}
		},
		{
			name: 'e2e',
			testDir: './tests/e2e'
		}
	]
});
