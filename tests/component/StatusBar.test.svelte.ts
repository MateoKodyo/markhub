import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import StatusBar from '../../src/lib/components/StatusBar.svelte';
import type { Vault } from '../../src/lib/tauri/types';

const editVault: Vault = {
	id: 'v1',
	name: 'Notes perso',
	path: '/Users/me/MD',
	mode: 'edit',
	color: '#A78BFA'
};

const readonlyVault: Vault = {
	id: 'v2',
	name: 'Skills',
	path: '/Users/me/Skills',
	mode: 'readonly',
	color: '#60A5FA'
};

describe('StatusBar', () => {
	it('shows "Aucun vault" when no vault is active', () => {
		render(StatusBar);
		expect(screen.getByText('Aucun vault')).toBeInTheDocument();
	});

	it('shows the vault name and the "no file" pill when no file is open', () => {
		render(StatusBar, { vault: editVault });
		expect(screen.getByText('Notes perso')).toBeInTheDocument();
		expect(screen.getByText('Aucun fichier')).toBeInTheDocument();
	});

	it('shows the relative path when a file is open', () => {
		render(StatusBar, {
			vault: editVault,
			relativePath: 'subfolder/note.md',
			content: 'hello world'
		});
		expect(screen.getByText('subfolder/note.md')).toBeInTheDocument();
	});

	it('shows the RO badge when readonly', () => {
		render(StatusBar, {
			vault: readonlyVault,
			relativePath: 'note.md',
			readonly: true,
			content: 'x'
		});
		expect(screen.getByText('RO')).toBeInTheDocument();
	});

	it('shows the word count and reading time', () => {
		const text = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
		render(StatusBar, {
			vault: editVault,
			relativePath: 'doc.md',
			content: text
		});
		expect(screen.getByText(/\d.*mots/)).toBeInTheDocument();
		expect(screen.getByText(/~\d+\s*min/)).toBeInTheDocument();
	});

	it('cycles word → character → token counts on click', async () => {
		render(StatusBar, {
			vault: editVault,
			relativePath: 'doc.md',
			content: 'hello world'
		});
		const btn = screen.getByTestId('counter-toggle');
		expect(btn.textContent).toMatch(/mots/);
		await fireEvent.click(btn);
		expect(btn.textContent).toMatch(/caractères/);
		await fireEvent.click(btn);
		// Token estimate prefixed with "~" to flag the approximation.
		expect(btn.textContent).toMatch(/~\S+\s*tokens/);
		await fireEvent.click(btn);
		expect(btn.textContent).toMatch(/mots/);
	});

	it('renders the save status icon when status is set', () => {
		const { container } = render(StatusBar, {
			vault: editVault,
			relativePath: 'doc.md',
			content: 'x',
			status: 'saved'
		});
		expect(container.textContent).toContain('Sauvegardé');
	});

	it('calls onCopyPath when the path button is clicked', async () => {
		const onCopyPath = vi.fn();
		render(StatusBar, {
			vault: editVault,
			relativePath: 'note.md',
			content: 'x',
			onCopyPath
		});
		await fireEvent.click(screen.getByTestId('path-copy-btn'));
		expect(onCopyPath).toHaveBeenCalledTimes(1);
	});
});
