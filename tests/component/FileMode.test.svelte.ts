import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileMode from '../../src/lib/components/palette/FileMode.svelte';
import { vaultTreeStore } from '../../src/lib/stores/vaultTree.svelte';
import { recentFilesStore } from '../../src/lib/stores/recentFiles.svelte';
import { activeFileStore } from '../../src/lib/stores/activeFile.svelte';
import { vaultsStore } from '../../src/lib/stores/vaults.svelte';

/**
 * FileMode reads `vaultTreeStore.files`, the recent-files MRU, and the
 * active file (to exclude it from the switcher). Tests stub the tree by
 * monkey-patching the `files` getter — simpler than wiring a real scan.
 */

const baseProps = () => ({
	query: '',
	selectedIndex: 0,
	onActivate: vi.fn(),
	itemCount: 0
});

const F = (relativePath: string, vaultId = 'v') => {
	const i = relativePath.lastIndexOf('/');
	return {
		vaultId,
		relativePath,
		name: i < 0 ? relativePath : relativePath.slice(i + 1)
	};
};

function stubVaultTree(files: ReturnType<typeof F>[]) {
	Object.defineProperty(vaultTreeStore, 'files', {
		configurable: true,
		get: () => files
	});
}

describe('FileMode', () => {
	// Snapshot the `vaultTreeStore.files` descriptor so each test can
	// safely re-stub it. (We don't touch `activeFileStore.activeFile` —
	// the "excludes open file" behavior is covered in rankFiles unit
	// tests, which keep the test surface light here.)
	const originalFilesDesc = Object.getOwnPropertyDescriptor(
		vaultTreeStore,
		'files'
	);

	beforeEach(() => {
		if (originalFilesDesc) {
			Object.defineProperty(vaultTreeStore, 'files', originalFilesDesc);
		}
		localStorage.clear();
		recentFilesStore.hydrate();
		activeFileStore.close();
		vaultsStore.activeVaultId = 'v';
	});

	afterEach(() => {
		if (originalFilesDesc) {
			Object.defineProperty(vaultTreeStore, 'files', originalFilesDesc);
		}
	});

	it('renders every file when the query is empty', () => {
		stubVaultTree([F('a.md'), F('b.md'), F('docs/x.md')]);
		render(FileMode, { props: baseProps() });
		const names = screen
			.getAllByTestId('file-mode-name')
			.map((el) => el.textContent);
		expect(names.sort()).toEqual(['a.md', 'b.md', 'x.md']);
	});

	it('shows the relative-path tail next to nested files', () => {
		stubVaultTree([F('notes/deep/spec.md')]);
		render(FileMode, { props: baseProps() });
		const path = screen.getByTestId('file-mode-path').textContent;
		expect(path).toBe('notes/deep/');
	});

	it('filters out files that do not match the query', () => {
		stubVaultTree([F('apple.md'), F('banana.md')]);
		render(FileMode, { props: { ...baseProps(), query: 'app' } });
		const names = screen
			.getAllByTestId('file-mode-name')
			.map((el) => el.textContent);
		expect(names).toEqual(['apple.md']);
	});

	it('orders recent files first when the query is empty', () => {
		stubVaultTree([F('apple.md'), F('banana.md'), F('cherry.md')]);
		recentFilesStore.record({ vaultId: 'v', relativePath: 'banana.md' });
		recentFilesStore.record({ vaultId: 'v', relativePath: 'cherry.md' });
		render(FileMode, { props: baseProps() });
		const names = screen
			.getAllByTestId('file-mode-name')
			.map((el) => el.textContent);
		expect(names).toEqual(['cherry.md', 'banana.md', 'apple.md']);
	});

	// NB: "excludes the currently open file" is covered in
	// tests/unit/fuzzyFiles.test.ts (the `exclude` set parameter on
	// rankFiles). Mocking `activeFileStore.activeFile` here trips over
	// Svelte 5's $state getter/setter shape and bleeds across tests, so
	// we keep that assertion at the pure-function layer.

	it('clicking a row calls onActivate with that file', async () => {
		stubVaultTree([F('hello.md')]);
		const onActivate = vi.fn();
		render(FileMode, { props: { ...baseProps(), onActivate } });
		await fireEvent.click(screen.getByTestId('file-mode-row'));
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(onActivate.mock.calls[0][0].relativePath).toBe('hello.md');
	});

	it('shows an empty state when nothing matches', () => {
		stubVaultTree([F('a.md')]);
		render(FileMode, { props: { ...baseProps(), query: 'zzzzz' } });
		expect(screen.getByTestId('file-mode-empty')).toBeInTheDocument();
	});

	it('shows a distinct empty state when the vault has no files at all', () => {
		stubVaultTree([]);
		render(FileMode, { props: baseProps() });
		const el = screen.getByTestId('file-mode-empty');
		expect(el.textContent).toMatch(/no files/i);
	});
});

