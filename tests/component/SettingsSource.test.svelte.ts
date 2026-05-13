import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: vi.fn().mockResolvedValue(null),
	settingsWrite: vi.fn().mockResolvedValue(undefined)
}));

const { themeSetPreference, themeInit } = vi.hoisted(() => ({
	themeSetPreference: vi.fn(),
	themeInit: vi.fn()
}));
vi.mock('../../src/lib/theming/manager.svelte', () => ({
	themeManager: {
		init: themeInit,
		setPreference: themeSetPreference,
		preference: {
			mode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark'
		}
	}
}));

import SettingsSource from '../../src/lib/components/SettingsSource.svelte';
import { settingsStore } from '../../src/lib/stores/settings.svelte';

describe('SettingsSource', () => {
	beforeEach(() => {
		settingsStore.resetForTest();
	});

	it('renders the 3 monospace font options', () => {
		render(SettingsSource);
		expect(screen.getByTestId('source-mono-geist-mono')).toBeInTheDocument();
		expect(screen.getByTestId('source-mono-jetbrains-mono')).toBeInTheDocument();
		expect(screen.getByTestId('source-mono-fira-code')).toBeInTheDocument();
	});

	it('marks geist-mono as the default active', () => {
		render(SettingsSource);
		expect(
			screen.getByTestId('source-mono-geist-mono').getAttribute('aria-checked')
		).toBe('true');
	});

	it('selecting a different mono font updates the store', async () => {
		render(SettingsSource);
		await fireEvent.click(screen.getByTestId('source-mono-jetbrains-mono'));
		expect(settingsStore.current.source.monoFont).toBe('jetbrains-mono');
		expect(
			screen.getByTestId('source-mono-jetbrains-mono').getAttribute('aria-checked')
		).toBe('true');
	});

	it('the preview block uses the selected font family', async () => {
		render(SettingsSource);
		const preview = screen.getByTestId('source-preview') as HTMLElement;
		// Default → Geist Mono.
		expect(preview.style.fontFamily).toContain('Geist Mono');
		await fireEvent.click(screen.getByTestId('source-mono-fira-code'));
		expect(preview.style.fontFamily).toContain('Fira Code');
	});
});
