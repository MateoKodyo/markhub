import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EditorToolbar from '../../src/lib/components/EditorToolbar.svelte';

describe('EditorToolbar', () => {
	// ------ C4.1 — all 7 buttons present ------
	it('renders Bold, Italic, Code, H1, H2, H3, and Lien buttons', () => {
		render(EditorToolbar);
		expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^h1$/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^h2$/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /^h3$/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /lien|link/i })).toBeInTheDocument();
	});

	// ------ C4.2 — clicking Bold emits the bold command ------
	it('calls onCommand("bold") when the Bold button is clicked', async () => {
		const onCommand = vi.fn();
		render(EditorToolbar, { onCommand });
		await fireEvent.click(screen.getByRole('button', { name: /bold/i }));
		expect(onCommand).toHaveBeenCalledWith('bold');
	});

	it('emits the matching command for each button', async () => {
		const onCommand = vi.fn();
		render(EditorToolbar, { onCommand });
		await fireEvent.click(screen.getByRole('button', { name: /italic/i }));
		await fireEvent.click(screen.getByRole('button', { name: /^h2$/i }));
		await fireEvent.click(screen.getByRole('button', { name: /lien|link/i }));
		expect(onCommand).toHaveBeenNthCalledWith(1, 'italic');
		expect(onCommand).toHaveBeenNthCalledWith(2, 'h2');
		expect(onCommand).toHaveBeenNthCalledWith(3, 'link');
	});

	// ------ C4.3 — disabled when readonly ------
	it('disables every button when readonly={true}', () => {
		render(EditorToolbar, { readonly: true });
		const buttons = screen.getAllByRole('button');
		expect(buttons.length).toBeGreaterThan(0);
		for (const b of buttons) {
			expect((b as HTMLButtonElement).disabled).toBe(true);
		}
	});
});
