import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CommandMode from '../../src/lib/components/palette/CommandMode.svelte';
import { commandRegistry } from '../../src/lib/commands/registry.svelte';
import { recentCommandsStore } from '../../src/lib/commands/recent.svelte';

/**
 * CommandMode is the registry-driven body of the palette shell. It owns:
 *  - filtering the registry against the query (fuzzy match),
 *  - ordering recent commands first when the query is empty,
 *  - rendering rows (label + group + optional shortcut),
 *  - emitting onActivate(command) when a row is clicked OR when the parent
 *    shell calls into it via the `activate(index)` callback bound back to
 *    the parent through `bind:itemCount` + `selectedIndex`.
 */

const baseProps = () => ({
	query: '',
	selectedIndex: 0,
	onActivate: vi.fn(),
	itemCount: 0
});

describe('CommandMode', () => {
	beforeEach(() => {
		localStorage.clear();
		commandRegistry.resetForTest();
		recentCommandsStore.hydrate();
		vi.clearAllMocks();
	});

	it('renders every registered command when the query is empty', () => {
		commandRegistry.register({
			id: 'a',
			label: 'Save File',
			group: 'File',
			handler: vi.fn()
		});
		commandRegistry.register({
			id: 'b',
			label: 'Toggle Theme',
			group: 'View',
			handler: vi.fn()
		});
		render(CommandMode, { props: baseProps() });
		expect(screen.getByText('Save File')).toBeInTheDocument();
		expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
	});

	it('filters by fuzzy match on the label', () => {
		commandRegistry.register({
			id: 'a',
			label: 'Save File',
			group: 'File',
			handler: vi.fn()
		});
		commandRegistry.register({
			id: 'b',
			label: 'Toggle Theme',
			group: 'View',
			handler: vi.fn()
		});
		render(CommandMode, { props: { ...baseProps(), query: 'save' } });
		// With a non-empty query, the label is split into runs of plain +
		// <mark>matched</mark> text. getByText doesn't concat across nodes,
		// so we inspect the data-testid label's textContent instead.
		const labels = screen
			.getAllByTestId('command-mode-label')
			.map((el) => el.textContent);
		expect(labels).toEqual(['Save File']);
	});

	it('hides commands whose `when` guard returns false', () => {
		commandRegistry.register({
			id: 'a',
			label: 'Visible',
			handler: vi.fn(),
			when: () => true
		});
		commandRegistry.register({
			id: 'b',
			label: 'Hidden',
			handler: vi.fn(),
			when: () => false
		});
		render(CommandMode, { props: baseProps() });
		expect(screen.getByText('Visible')).toBeInTheDocument();
		expect(screen.queryByText('Hidden')).toBeNull();
	});

	it('clicking a row calls onActivate with the matching command', async () => {
		const handler = vi.fn();
		commandRegistry.register({
			id: 'view.theme',
			label: 'Toggle Theme',
			group: 'View',
			handler
		});
		const onActivate = vi.fn();
		render(CommandMode, { props: { ...baseProps(), onActivate } });
		await fireEvent.click(screen.getByText('Toggle Theme'));
		expect(onActivate).toHaveBeenCalledTimes(1);
		expect(onActivate.mock.calls[0][0].id).toBe('view.theme');
	});

	it('renders the group label next to each row', () => {
		commandRegistry.register({
			id: 'a',
			label: 'Save File',
			group: 'File',
			handler: vi.fn()
		});
		render(CommandMode, { props: baseProps() });
		expect(screen.getByText('File')).toBeInTheDocument();
	});

	it('renders the shortcut hint when provided', () => {
		commandRegistry.register({
			id: 'file.save',
			label: 'Save File',
			group: 'File',
			shortcut: '⌘S',
			handler: vi.fn()
		});
		render(CommandMode, { props: baseProps() });
		expect(screen.getByText('⌘S')).toBeInTheDocument();
	});

	it('orders recent commands first when the query is empty', () => {
		commandRegistry.register({ id: 'a', label: 'Apple', handler: vi.fn() });
		commandRegistry.register({ id: 'b', label: 'Banana', handler: vi.fn() });
		commandRegistry.register({ id: 'c', label: 'Cherry', handler: vi.fn() });
		recentCommandsStore.record('b');
		recentCommandsStore.record('c');
		render(CommandMode, { props: baseProps() });
		// "Cherry" was the most recent; "Banana" before it; "Apple" never used.
		const labels = screen
			.getAllByTestId('command-mode-label')
			.map((el) => el.textContent);
		expect(labels).toEqual(['Cherry', 'Banana', 'Apple']);
	});

	it('shows an empty-state message when nothing matches', () => {
		commandRegistry.register({ id: 'a', label: 'Apple', handler: vi.fn() });
		render(CommandMode, { props: { ...baseProps(), query: 'zzzzzz' } });
		expect(screen.getByTestId('command-mode-empty')).toBeInTheDocument();
	});

	it('marks the selected row via aria-selected', () => {
		commandRegistry.register({ id: 'a', label: 'Apple', handler: vi.fn() });
		commandRegistry.register({ id: 'b', label: 'Banana', handler: vi.fn() });
		render(CommandMode, { props: { ...baseProps(), selectedIndex: 1 } });
		const rows = screen.getAllByRole('option');
		expect(rows[0].getAttribute('aria-selected')).toBe('false');
		expect(rows[1].getAttribute('aria-selected')).toBe('true');
	});
});
