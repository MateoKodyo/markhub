import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import VaultList from '../../src/lib/components/VaultList.svelte';
import type { Vault } from '$lib/tauri/types';

const editVault: Vault = {
	id: 'v1',
	name: 'Notes perso',
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

describe('VaultList', () => {
	// ------ C1.1 — name + color dot ------
	it('renders each vault with its name', () => {
		render(VaultList, { vaults: [editVault, readonlyVault] });
		expect(screen.getByText('Notes perso')).toBeInTheDocument();
		expect(screen.getByText('Skills')).toBeInTheDocument();
	});

	it('renders a color dot for each vault using its color', () => {
		const { container } = render(VaultList, { vaults: [editVault] });
		const dot = container.querySelector('[data-testid="vault-color-dot"]');
		expect(dot).toBeInTheDocument();
		// jsdom normalises inline hex to rgb(); read the original via data-color.
		expect(dot?.getAttribute('data-color')).toBe(editVault.color);
	});

	// ------ C1.2 — readonly lock indicator ------
	it('renders a lock indicator for readonly vaults only', () => {
		render(VaultList, { vaults: [editVault, readonlyVault] });
		const locks = screen.getAllByLabelText(/lecture seule|read.?only|readonly/i);
		expect(locks).toHaveLength(1);
	});

	// ------ C1.3 — click invokes onSelect with the right id ------
	it('calls onSelect with the vault id when clicked', async () => {
		const onSelect = vi.fn();
		render(VaultList, { vaults: [editVault, readonlyVault], onSelect });
		await fireEvent.click(screen.getByText('Skills'));
		expect(onSelect).toHaveBeenCalledWith('v2');
	});

	// ------ C1.4 — active vault has is-active class ------
	it('marks the active vault with the is-active class', () => {
		const { container } = render(VaultList, {
			vaults: [editVault, readonlyVault],
			activeVaultId: 'v2'
		});
		const items = container.querySelectorAll('[data-testid="vault-item"]');
		const active = Array.from(items).filter((el) => el.classList.contains('is-active'));
		expect(active).toHaveLength(1);
		expect(active[0].textContent).toContain('Skills');
	});

	// ------ C5 — emits onContextMenu on right-click with vault + coords ------
	it('emits onContextMenu with the vault and the cursor coords on right-click', async () => {
		const onContextMenu = vi.fn();
		render(VaultList, { vaults: [editVault], onContextMenu });
		await fireEvent.contextMenu(screen.getByText('Notes perso'), {
			clientX: 120,
			clientY: 84
		});
		expect(onContextMenu).toHaveBeenCalledTimes(1);
		const [vault, x, y] = onContextMenu.mock.calls[0];
		expect(vault).toEqual(editVault);
		expect(x).toBe(120);
		expect(y).toBe(84);
	});

	it('still emits onContextMenu for readonly vaults (parent decides what to show)', async () => {
		const onContextMenu = vi.fn();
		render(VaultList, { vaults: [readonlyVault], onContextMenu });
		await fireEvent.contextMenu(screen.getByText('Skills'));
		expect(onContextMenu).toHaveBeenCalledTimes(1);
		expect(onContextMenu.mock.calls[0][0]).toEqual(readonlyVault);
	});
});
