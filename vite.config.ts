import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

// Tauri expects a fixed port and to be able to fail early if it's not free.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [sveltekit(), svelteTesting()],

	// Tauri-friendly dev server config.
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 1421
				}
			: undefined,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},

	// Vitest config (jsdom + alias resolved via SvelteKit plugin)
	// Svelte 5 requires .test.svelte.ts for files that use runes outside .svelte components.
	test: {
		environment: 'jsdom',
		globals: true,
		include: [
			'tests/unit/**/*.{test,spec}.{js,ts}',
			'tests/unit/**/*.{test,spec}.svelte.ts',
			'tests/component/**/*.{test,spec}.{js,ts}',
			'tests/component/**/*.{test,spec}.svelte.ts'
		],
		setupFiles: ['./tests/setup.ts']
	}
});
