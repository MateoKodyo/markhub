import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Mock the Tauri API surface — settingsStore.load() touches it on first
// render. We never use the real `invoke` in vitest.
vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: vi.fn().mockResolvedValue({
		version: 2,
		appearance: {
			themeMode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark',
			editorFont: 'Geist Sans',
			editorFontSize: 16,
			editorLineHeight: 1.6,
			editorContentWidth: 60
		},
		editor: { autosaveDelayMs: 1500, spellCheck: true },
		source: { monoFont: 'geist-mono' },
		files: { confirmDelete: true }
	}),
	settingsWrite: vi.fn().mockResolvedValue(undefined)
}));

// Mock themeManager so the modal's hydration doesn't touch matchMedia.
vi.mock('../../src/lib/theming/manager.svelte', () => ({
	themeManager: {
		init: vi.fn(),
		setPreference: vi.fn(),
		preference: {
			mode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark'
		}
	}
}));

import SettingsModal from '../../src/lib/components/SettingsModal.svelte';
import { settingsStore } from '../../src/lib/stores/settings.svelte';

describe('SettingsModal', () => {
	beforeEach(() => {
		settingsStore.resetForTest();
	});

	// ------ S3.1 — not rendered when closed ------
	it('renders nothing when settingsStore.isOpen is false', () => {
		render(SettingsModal);
		expect(screen.queryByTestId('settings-modal')).toBeNull();
		expect(screen.queryByTestId('settings-backdrop')).toBeNull();
	});

	// ------ S3.2 — renders the dialog when open ------
	it('renders the dialog with all sections when open', async () => {
		settingsStore.open();
		render(SettingsModal);
		expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
		expect(screen.getByTestId('settings-backdrop')).toBeInTheDocument();
		// 5 sections present in the left rail (behavior was retired 2026-05-14).
		expect(screen.getByTestId('settings-rail-appearance')).toBeInTheDocument();
		expect(screen.getByTestId('settings-rail-editor')).toBeInTheDocument();
		expect(screen.getByTestId('settings-rail-source')).toBeInTheDocument();
		expect(screen.getByTestId('settings-rail-files')).toBeInTheDocument();
		expect(screen.getByTestId('settings-rail-advanced')).toBeInTheDocument();
		expect(screen.queryByTestId('settings-rail-behavior')).toBeNull();
	});

	// ------ S3.3 — Appearance is the default active section ------
	it('defaults to Appearance as the active section', () => {
		settingsStore.open();
		render(SettingsModal);
		const appearance = screen.getByTestId('settings-rail-appearance');
		expect(appearance.getAttribute('aria-current')).toBe('true');
	});

	// ------ S3.4 — clicking a rail item switches the active section ------
	it('switches the active section when a rail item is clicked', async () => {
		settingsStore.open();
		render(SettingsModal);
		await fireEvent.click(screen.getByTestId('settings-rail-editor'));
		expect(settingsStore.activeSection).toBe('editor');
		expect(screen.getByTestId('settings-rail-editor').getAttribute('aria-current')).toBe(
			'true'
		);
		expect(
			screen.getByTestId('settings-rail-appearance').getAttribute('aria-current')
		).toBeNull();
	});

	// ------ S3.5 — open(section) deep-links to a specific section ------
	it('open(section) deep-links to the requested section', () => {
		settingsStore.open('advanced');
		render(SettingsModal);
		expect(screen.getByTestId('settings-rail-advanced').getAttribute('aria-current')).toBe(
			'true'
		);
	});

	// ------ S3.6 — clicking the close button closes ------
	it('closes when the close button is clicked', async () => {
		settingsStore.open();
		render(SettingsModal);
		await fireEvent.click(screen.getByLabelText('Fermer les paramètres'));
		expect(settingsStore.isOpen).toBe(false);
	});

	// ------ S3.7 — clicking the backdrop closes ------
	it('closes when the backdrop is clicked (but not when the modal panel is)', async () => {
		settingsStore.open();
		render(SettingsModal);

		// Clicking inside the modal panel does NOT close (event.target !==
		// currentTarget on the backdrop click handler).
		await fireEvent.click(screen.getByTestId('settings-modal'));
		expect(settingsStore.isOpen).toBe(true);

		// Clicking directly on the backdrop closes.
		await fireEvent.click(screen.getByTestId('settings-backdrop'));
		expect(settingsStore.isOpen).toBe(false);
	});

	// ------ S3.8 — Escape closes ------
	it('closes on Escape', async () => {
		settingsStore.open();
		render(SettingsModal);
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(settingsStore.isOpen).toBe(false);
	});

	// ------ S3.9 — Escape is a no-op when modal is already closed ------
	it('Escape does nothing when the modal is closed', async () => {
		// modal is closed by default
		render(SettingsModal);
		await fireEvent.keyDown(window, { key: 'Escape' });
		// no error, still closed
		expect(settingsStore.isOpen).toBe(false);
	});

	// ------ S3.10 — accessible attributes are correct ------
	it('declares role=dialog and aria-modal=true', () => {
		settingsStore.open();
		render(SettingsModal);
		const modal = screen.getByTestId('settings-modal');
		expect(modal.getAttribute('role')).toBe('dialog');
		expect(modal.getAttribute('aria-modal')).toBe('true');
		expect(modal.getAttribute('aria-labelledby')).toBe('settings-title');
	});
});
