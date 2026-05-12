import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Mock the Tauri api wrapper BEFORE importing SearchMode so the
// component's `import { searchInVault }` resolves to the spy.
vi.mock('$lib/tauri/api', () => ({
	searchInVault: vi.fn()
}));

import * as api from '$lib/tauri/api';
import SearchMode from '../../src/lib/components/palette/SearchMode.svelte';
import { vaultsStore } from '../../src/lib/stores/vaults.svelte';
import type { SearchMatch } from '../../src/lib/tauri/types';

const SAMPLE: SearchMatch[] = [
	{
		relativePath: 'README.md',
		hits: [
			{
				lineNumber: 1,
				lineContent: 'hello world',
				matchStart: 0,
				matchEnd: 5
			},
			{
				lineNumber: 4,
				lineContent: 'hello again',
				matchStart: 0,
				matchEnd: 5
			}
		]
	},
	{
		relativePath: 'notes/deep.md',
		hits: [
			{
				lineNumber: 2,
				lineContent: 'say hello',
				matchStart: 4,
				matchEnd: 9
			}
		]
	}
];

const baseProps = () => ({
	query: '',
	selectedIndex: 0,
	onActivate: vi.fn(),
	itemCount: 0,
	flatTargets: []
});

describe('SearchMode', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vaultsStore.activeVaultId = 'v1';
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows the empty hint when the query is blank', () => {
		render(SearchMode, { props: baseProps() });
		expect(screen.getByTestId('search-mode-empty')).toBeInTheDocument();
	});

	it('debounces and then calls searchInVault with the trimmed query', async () => {
		(api.searchInVault as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		render(SearchMode, { props: { ...baseProps(), query: '  hello  ' } });
		// No call yet — still inside the debounce window.
		expect(api.searchInVault).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(250);
		expect(api.searchInVault).toHaveBeenCalledTimes(1);
		expect(api.searchInVault).toHaveBeenCalledWith(
			'v1',
			'hello',
			expect.objectContaining({
				caseSensitive: false,
				wholeWord: false,
				regex: false
			})
		);
	});

	it('renders grouped results once the search resolves', async () => {
		(api.searchInVault as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE);
		render(SearchMode, { props: { ...baseProps(), query: 'hello' } });
		await vi.advanceTimersByTimeAsync(250);
		// Flush microtasks for the resolved promise.
		await vi.runOnlyPendingTimersAsync();

		const groups = screen.getAllByTestId('search-mode-group');
		expect(groups).toHaveLength(2);
		const hits = screen.getAllByTestId('search-mode-hit');
		expect(hits).toHaveLength(3);
	});

	it('shows the no-results state when the call returns an empty list', async () => {
		(api.searchInVault as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		render(SearchMode, { props: { ...baseProps(), query: 'nothing' } });
		await vi.advanceTimersByTimeAsync(250);
		await vi.runOnlyPendingTimersAsync();
		expect(screen.getByTestId('search-mode-no-results')).toBeInTheDocument();
	});

	it('clicking a hit calls onActivate with the right path + line', async () => {
		(api.searchInVault as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE);
		const onActivate = vi.fn();
		render(SearchMode, {
			props: { ...baseProps(), query: 'hello', onActivate }
		});
		await vi.advanceTimersByTimeAsync(250);
		await vi.runOnlyPendingTimersAsync();
		const hits = screen.getAllByTestId('search-mode-hit');
		await fireEvent.click(hits[1]); // README.md line 4
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(onActivate.mock.calls[0][0]).toEqual({
			relativePath: 'README.md',
			lineNumber: 4
		});
	});

	it('drops stale results when a newer search starts', async () => {
		const calls = api.searchInVault as unknown as ReturnType<typeof vi.fn>;
		let resolveFirst: (v: SearchMatch[]) => void;
		const firstPromise = new Promise<SearchMatch[]>((res) => {
			resolveFirst = res;
		});
		calls.mockReturnValueOnce(firstPromise);
		calls.mockResolvedValueOnce([]); // second, empty

		const { rerender } = render(SearchMode, {
			props: { ...baseProps(), query: 'first' }
		});
		await vi.advanceTimersByTimeAsync(250);
		// First call dispatched but not resolved yet. Update the query —
		// this should cancel the first request via the activeRequestId
		// counter and schedule a second.
		await rerender({ ...baseProps(), query: 'second' });
		await vi.advanceTimersByTimeAsync(250);
		// Now resolve the first (late). It must NOT overwrite second.
		resolveFirst!(SAMPLE);
		await vi.runOnlyPendingTimersAsync();
		// Empty no-results state means we honored the second call only.
		expect(screen.queryByTestId('search-mode-group')).toBeNull();
	});
});
