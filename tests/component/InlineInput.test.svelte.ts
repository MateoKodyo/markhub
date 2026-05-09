import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import InlineInput from '../../src/lib/components/InlineInput.svelte';

describe('InlineInput', () => {
	// ------ C6.1 — input rendered, no backdrop ------
	it('renders a single text input without modal backdrop', () => {
		const { container } = render(InlineInput, { placeholder: 'name' });
		const inputs = container.querySelectorAll('input[type="text"]');
		expect(inputs).toHaveLength(1);
		// No backdrop / dialog role anywhere — it's a flow element.
		expect(container.querySelector('[role="dialog"]')).toBeNull();
	});

	// ------ C6.2 — auto-focus on mount ------
	it('auto-focuses the input on mount', async () => {
		render(InlineInput, { placeholder: 'name' });
		const input = screen.getByPlaceholderText('name') as HTMLInputElement;
		// jsdom may not focus synchronously — use setTimeout 0 to flush.
		await new Promise((r) => setTimeout(r, 0));
		expect(document.activeElement).toBe(input);
	});

	// ------ C6.3 — Enter with non-empty value calls onSubmit(value) ------
	it('calls onSubmit with the trimmed value when Enter is pressed', async () => {
		const onSubmit = vi.fn();
		render(InlineInput, { placeholder: 'name', onSubmit });
		const input = screen.getByPlaceholderText('name') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '  note.md  ' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onSubmit).toHaveBeenCalledWith('note.md');
	});

	// ------ C6.4 — Enter with empty value is a no-op ------
	it('does NOT call onSubmit when value is empty/whitespace', async () => {
		const onSubmit = vi.fn();
		const onCancel = vi.fn();
		render(InlineInput, { placeholder: 'name', onSubmit, onCancel });
		const input = screen.getByPlaceholderText('name') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '   ' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onSubmit).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
	});

	// ------ C6.5 — Escape calls onCancel ------
	it('calls onCancel when Escape is pressed', async () => {
		const onCancel = vi.fn();
		render(InlineInput, { placeholder: 'name', onCancel });
		const input = screen.getByPlaceholderText('name');
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(onCancel).toHaveBeenCalled();
	});

	// ------ C6.6 — Blur calls onCancel ------
	it('calls onCancel on blur (mirrors VS Code inline rename UX)', async () => {
		const onCancel = vi.fn();
		render(InlineInput, { placeholder: 'name', onCancel });
		const input = screen.getByPlaceholderText('name');
		await fireEvent.blur(input);
		expect(onCancel).toHaveBeenCalled();
	});

	// ------ C6.7 — defaultValue prefilled ------
	it('prefills the input with defaultValue', () => {
		render(InlineInput, { placeholder: 'name', defaultValue: 'README.md' });
		const input = screen.getByPlaceholderText('name') as HTMLInputElement;
		expect(input.value).toBe('README.md');
	});
});
