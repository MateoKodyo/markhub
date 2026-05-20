import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmptyState from '../../src/lib/components/EmptyState.svelte';
import type { Vault } from '../../src/lib/tauri/types';

function makeVault(over: Partial<Vault> = {}): Vault {
	return {
		id: 'v1',
		name: 'Notes',
		path: '/Users/me/Notes',
		mode: 'edit',
		color: '#A78BFA',
		...over
	};
}

describe('EmptyState', () => {
	it('renders the brand block + 4 action cards with no vaults', () => {
		render(EmptyState);
		expect(screen.getByTestId('empty-state')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /markus/i, level: 1 })).toBeInTheDocument();
		expect(screen.getByTestId('action-open')).toBeInTheDocument();
		expect(screen.getByTestId('action-create')).toBeInTheDocument();
		expect(screen.getByTestId('action-clone')).toBeInTheDocument();
		expect(screen.getByTestId('action-sample')).toBeInTheDocument();
		// No recents section when vaults is empty.
		expect(screen.queryByTestId('recent-vaults')).toBeNull();
	});

	it('renders the recent vaults section when vaults are provided', () => {
		const vaults = [
			makeVault({ id: 'v1', name: 'Notes', path: '/a/b' }),
			makeVault({ id: 'v2', name: 'Skills', path: '/c/d' })
		];
		render(EmptyState, { vaults });
		expect(screen.getByTestId('recent-vaults')).toBeInTheDocument();
		expect(screen.getByText('Notes')).toBeInTheDocument();
		expect(screen.getByText('Skills')).toBeInTheDocument();
	});

	it('truncates the recent list to 5 by default and exposes "Voir tout (N)"', () => {
		const vaults = Array.from({ length: 7 }, (_, i) =>
			makeVault({ id: `v${i}`, name: `Vault ${i}`, path: `/p/${i}` })
		);
		render(EmptyState, { vaults });
		expect(screen.queryByText('Vault 0')).toBeInTheDocument();
		expect(screen.queryByText('Vault 4')).toBeInTheDocument();
		// 5th index (zero-based) is the 6th vault — must be hidden until expand.
		expect(screen.queryByText('Vault 5')).toBeNull();
		expect(screen.getByTestId('recent-show-all')).toHaveTextContent(/voir tout.*7/i);
	});

	it('expands the recent list when "Voir tout" is clicked', async () => {
		const vaults = Array.from({ length: 7 }, (_, i) =>
			makeVault({ id: `v${i}`, name: `Vault ${i}`, path: `/p/${i}` })
		);
		render(EmptyState, { vaults });
		await fireEvent.click(screen.getByTestId('recent-show-all'));
		expect(screen.queryByText('Vault 5')).toBeInTheDocument();
		expect(screen.queryByText('Vault 6')).toBeInTheDocument();
	});

	it('fires the matching callback for each action card', async () => {
		const onOpenVault = vi.fn();
		const onCreateVault = vi.fn();
		const onCloneGit = vi.fn();
		const onCreateSample = vi.fn();
		render(EmptyState, {
			onOpenVault,
			onCreateVault,
			onCloneGit,
			onCreateSample
		});
		await fireEvent.click(screen.getByTestId('action-open'));
		await fireEvent.click(screen.getByTestId('action-create'));
		await fireEvent.click(screen.getByTestId('action-clone'));
		await fireEvent.click(screen.getByTestId('action-sample'));
		expect(onOpenVault).toHaveBeenCalledTimes(1);
		expect(onCreateVault).toHaveBeenCalledTimes(1);
		expect(onCloneGit).toHaveBeenCalledTimes(1);
		expect(onCreateSample).toHaveBeenCalledTimes(1);
	});

	it('fires onOpenRecentVault(id) when a recent row is clicked', async () => {
		const onOpenRecentVault = vi.fn();
		const vaults = [makeVault({ id: 'v-abc', name: 'Notes' })];
		render(EmptyState, { vaults, onOpenRecentVault });
		await fireEvent.click(screen.getByTestId('recent-row-v-abc'));
		expect(onOpenRecentVault).toHaveBeenCalledWith('v-abc');
	});
});
