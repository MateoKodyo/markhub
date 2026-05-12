import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CommandPalette from '../../src/lib/components/CommandPalette.svelte';

/**
 * The shell is mode-agnostic: it owns the chrome (backdrop, panel, input,
 * footer hints), keyboard navigation, and lifecycle. The mode body (Command,
 * File, Search) lives in the children snippet and reacts to props.
 */

const baseProps = () => ({
	open: true,
	placeholder: 'Type a command…',
	itemCount: 3,
	onClose: vi.fn(),
	onActivate: vi.fn(),
	onQueryChange: vi.fn()
});

describe('CommandPalette', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// ------ C2.1 — closed state renders nothing ------
	it('renders nothing when open=false', () => {
		render(CommandPalette, { props: { ...baseProps(), open: false } });
		expect(screen.queryByTestId('command-palette')).toBeNull();
		expect(screen.queryByTestId('command-palette-backdrop')).toBeNull();
	});

	// ------ C2.2 — open state renders backdrop + panel + input + footer ------
	it('renders the full shell when open=true', () => {
		render(CommandPalette, { props: baseProps() });
		expect(screen.getByTestId('command-palette-backdrop')).toBeInTheDocument();
		expect(screen.getByTestId('command-palette')).toBeInTheDocument();
		expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
		expect(screen.getByTestId('command-palette-footer')).toBeInTheDocument();
	});

	// ------ C2.3 — placeholder is forwarded to the input ------
	it('shows the placeholder prop on the input', () => {
		render(CommandPalette, {
			props: { ...baseProps(), placeholder: 'Search files…' }
		});
		expect(
			screen.getByPlaceholderText('Search files…')
		).toBeInTheDocument();
	});

	// ------ C2.4 — accessible attributes are correct ------
	it('declares role=dialog and aria-modal=true', () => {
		render(CommandPalette, { props: baseProps() });
		const panel = screen.getByTestId('command-palette');
		expect(panel.getAttribute('role')).toBe('dialog');
		expect(panel.getAttribute('aria-modal')).toBe('true');
	});

	// ------ C2.5 — input is auto-focused when open=true ------
	it('auto-focuses the input on open', async () => {
		render(CommandPalette, { props: baseProps() });
		await vi.waitFor(() => {
			expect(screen.getByTestId('command-palette-input')).toHaveFocus();
		});
	});

	// ------ C2.6 — Escape closes ------
	it('calls onClose when Escape is pressed', async () => {
		const onClose = vi.fn();
		render(CommandPalette, { props: { ...baseProps(), onClose } });
		const input = screen.getByTestId('command-palette-input');
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	// ------ C2.7 — backdrop click closes, panel click does not ------
	it('closes on backdrop click, not on panel click', async () => {
		const onClose = vi.fn();
		render(CommandPalette, { props: { ...baseProps(), onClose } });
		await fireEvent.click(screen.getByTestId('command-palette'));
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByTestId('command-palette-backdrop'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	// ------ C2.8 — onQueryChange fires while typing ------
	it('forwards typing through onQueryChange', async () => {
		const onQueryChange = vi.fn();
		render(CommandPalette, { props: { ...baseProps(), onQueryChange } });
		const input = screen.getByTestId(
			'command-palette-input'
		) as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'hello' } });
		expect(onQueryChange).toHaveBeenLastCalledWith('hello');
	});

	// ------ C2.9 — Enter activates the current selection (default 0) ------
	it('Enter activates the current selection (defaults to index 0)', async () => {
		const onActivate = vi.fn();
		render(CommandPalette, { props: { ...baseProps(), onActivate } });
		const input = screen.getByTestId('command-palette-input');
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenCalledWith(0);
	});

	// ------ C2.10 — ArrowDown advances, ArrowUp moves back ------
	it('ArrowDown advances selection, ArrowUp moves back', async () => {
		const onActivate = vi.fn();
		render(CommandPalette, {
			props: { ...baseProps(), itemCount: 3, onActivate }
		});
		const input = screen.getByTestId('command-palette-input');

		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenLastCalledWith(1);

		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenLastCalledWith(2);

		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenLastCalledWith(1);
	});

	// ------ C2.11 — selection wraps at both ends ------
	it('wraps selection at both ends', async () => {
		const onActivate = vi.fn();
		render(CommandPalette, {
			props: { ...baseProps(), itemCount: 3, onActivate }
		});
		const input = screen.getByTestId('command-palette-input');

		// From 0 -> ArrowUp wraps to last (2)
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenLastCalledWith(2);

		// From last -> ArrowDown wraps to 0
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenLastCalledWith(0);
	});

	// ------ C2.12 — typing resets selection to 0 ------
	it('resets selectedIndex to 0 when the query changes', async () => {
		const onActivate = vi.fn();
		render(CommandPalette, {
			props: { ...baseProps(), itemCount: 3, onActivate }
		});
		const input = screen.getByTestId(
			'command-palette-input'
		) as HTMLInputElement;

		// Walk forward to index 2
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });

		// Type — selection must snap back to 0
		await fireEvent.input(input, { target: { value: 'a' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).toHaveBeenLastCalledWith(0);
	});

	// ------ C2.13 — empty itemCount: arrows + Enter are no-ops ------
	it('does not call onActivate when itemCount=0', async () => {
		const onActivate = vi.fn();
		render(CommandPalette, {
			props: { ...baseProps(), itemCount: 0, onActivate }
		});
		const input = screen.getByTestId('command-palette-input');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onActivate).not.toHaveBeenCalled();
	});

	// ------ C2.14 — footer surfaces the keyboard hints (↑↓ ⏎ ⎋) ------
	it('shows the keyboard hint legend in the footer', () => {
		render(CommandPalette, { props: baseProps() });
		const footer = screen.getByTestId('command-palette-footer');
		expect(footer.textContent ?? '').toMatch(/↑/);
		expect(footer.textContent ?? '').toMatch(/↓/);
		expect(footer.textContent ?? '').toMatch(/⏎/);
		expect(footer.textContent ?? '').toMatch(/⎋/);
	});
});
