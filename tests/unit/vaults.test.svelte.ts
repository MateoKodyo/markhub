import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Tauri API wrapper. The store talks to api.ts only.
vi.mock('$lib/tauri/api', () => ({
	configLoad: vi.fn(),
	configSave: vi.fn().mockResolvedValue(undefined),
	vaultAdd: vi.fn(),
	vaultRemove: vi.fn().mockResolvedValue(undefined),
	vaultUpdate: vi.fn(),
	vaultPickDirectory: vi.fn()
}));

import * as api from '$lib/tauri/api';
import { vaultsStore } from '../../src/lib/stores/vaults.svelte';
import type { Config, Vault } from '$lib/tauri/types';

const editVault: Vault = {
	id: 'v1',
	name: 'Notes',
	path: '/tmp/notes',
	mode: 'edit',
	color: '#7C3AED'
};
const readonlyVault: Vault = {
	id: 'v2',
	name: 'Skills',
	path: '/tmp/skills',
	mode: 'readonly',
	color: '#0EA5E9'
};

const fixtureConfig: Config = {
	version: 1,
	vaults: [editVault, readonlyVault],
	lastOpenedFile: null,
	settings: { autoSaveDelayMs: 1500, theme: 'system' }
};

describe('vaultsStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store between tests — using internal state setters.
		vaultsStore.vaults = [];
		vaultsStore.activeVaultId = null;
	});

	// ------ B3.1 — initial state ------
	it('starts with empty vaults and no active id', () => {
		expect(vaultsStore.vaults).toEqual([]);
		expect(vaultsStore.activeVaultId).toBeNull();
	});

	// ------ B3.2 — load() calls config_load and hydrates ------
	it('load() hydrates vaults from configLoad', async () => {
		vi.mocked(api.configLoad).mockResolvedValue(fixtureConfig);
		await vaultsStore.load();
		expect(api.configLoad).toHaveBeenCalledOnce();
		expect(vaultsStore.vaults).toEqual([editVault, readonlyVault]);
	});

	// ------ B3.3 — addVault() calls vault_add and appends ------
	it('addVault() calls vaultAdd with color then appends to local state', async () => {
		const newVault: Vault = {
			id: 'v3',
			name: 'New',
			path: '/tmp/new',
			mode: 'edit',
			color: '#A78BFA'
		};
		vi.mocked(api.vaultAdd).mockResolvedValue(newVault);

		const result = await vaultsStore.addVault('New', '/tmp/new', 'edit', '#A78BFA');

		expect(api.vaultAdd).toHaveBeenCalledWith('New', '/tmp/new', 'edit', '#A78BFA');
		expect(result).toEqual(newVault);
		expect(vaultsStore.vaults).toContainEqual(newVault);
	});

	// ------ B3.3b — addVaultFromPicker: cancelled picker is a no-op ------
	it('addVaultFromPicker() returns null and does not call vault_add when picker cancels', async () => {
		vi.mocked(api.vaultPickDirectory).mockResolvedValue(null);
		const result = await vaultsStore.addVaultFromPicker();
		expect(result).toBeNull();
		expect(api.vaultAdd).not.toHaveBeenCalled();
		expect(vaultsStore.vaults).toEqual([]);
		expect(vaultsStore.activeVaultId).toBeNull();
	});

	// ------ B3.3c — addVaultFromPicker: picked path triggers vault_add with derived params ------
	it('addVaultFromPicker() derives name=basename, mode=edit, color from palette', async () => {
		vi.mocked(api.vaultPickDirectory).mockResolvedValue('/Users/x/Documents/Notes');
		const created: Vault = {
			id: 'v-new',
			name: 'Notes',
			path: '/Users/x/Documents/Notes',
			mode: 'edit',
			color: '#A78BFA'
		};
		vi.mocked(api.vaultAdd).mockResolvedValue(created);

		const result = await vaultsStore.addVaultFromPicker();

		expect(api.vaultAdd).toHaveBeenCalledWith(
			'Notes',
			'/Users/x/Documents/Notes',
			'edit',
			expect.stringMatching(/^#[0-9A-Fa-f]{6}$/)
		);
		expect(result).toEqual(created);
		expect(vaultsStore.vaults).toContainEqual(created);
		expect(vaultsStore.activeVaultId).toBe('v-new');
	});

	// ------ B3.3d — removeVault: removes from state + clears activeVaultId if active ------
	it('removeVault() removes the vault and clears activeVaultId when removing the active vault', async () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		vaultsStore.activeVaultId = 'v1';

		await vaultsStore.removeVault('v1');

		expect(api.vaultRemove).toHaveBeenCalledWith('v1');
		expect(vaultsStore.vaults).toEqual([readonlyVault]);
		expect(vaultsStore.activeVaultId).toBeNull();
	});

	it('removeVault() leaves activeVaultId untouched when removing a non-active vault', async () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		vaultsStore.activeVaultId = 'v1';

		await vaultsStore.removeVault('v2');

		expect(vaultsStore.activeVaultId).toBe('v1');
	});

	// ------ B3.3e — updateVault: reflects new fields in state ------
	it('updateVault() patches the vault and reflects the change in the local state', async () => {
		vaultsStore.vaults = [editVault];
		const renamed: Vault = { ...editVault, name: 'Renamed' };
		vi.mocked(api.vaultUpdate).mockResolvedValue(renamed);

		const result = await vaultsStore.updateVault('v1', { name: 'Renamed' });

		expect(api.vaultUpdate).toHaveBeenCalledWith('v1', 'Renamed', undefined);
		expect(result).toEqual(renamed);
		expect(vaultsStore.vaults[0].name).toBe('Renamed');
	});

	// ------ B3.4 — selectVault sets activeVaultId ------
	it('selectVault() sets activeVaultId', () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		vaultsStore.selectVault('v2');
		expect(vaultsStore.activeVaultId).toBe('v2');
	});

	// ------ B3.5 — activeVault derived ------
	it('activeVault returns the matching vault', () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		vaultsStore.selectVault('v1');
		expect(vaultsStore.activeVault).toEqual(editVault);
	});

	it('activeVault returns undefined when no selection', () => {
		vaultsStore.vaults = [editVault];
		expect(vaultsStore.activeVault).toBeUndefined();
	});

	// ------ B3.6 — isActiveVaultReadonly derived ------
	it('isActiveVaultReadonly is true when active vault is readonly', () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		vaultsStore.selectVault('v2');
		expect(vaultsStore.isActiveVaultReadonly).toBe(true);
	});

	it('isActiveVaultReadonly is false for an edit vault', () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		vaultsStore.selectVault('v1');
		expect(vaultsStore.isActiveVaultReadonly).toBe(false);
	});

	it('isActiveVaultReadonly is false when no active selection', () => {
		vaultsStore.vaults = [editVault, readonlyVault];
		expect(vaultsStore.isActiveVaultReadonly).toBe(false);
	});
});
