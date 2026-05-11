import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BlockNoteLinkToolbar from '../../src/lib/components/BlockNoteLinkToolbar.svelte';

// C1 / Étape 2.5.e — Svelte UI for BlockNote's LinkToolbar plugin.
// Unlike slash menu / formatting toolbar / side menu / table handles, the
// linkToolbar plugin does NOT expose a `.store`. It exposes query methods
// only (`getLinkAtSelection()`, `editLink()`, `deleteLink()`). The host
// polls `getLinkAtSelection()` on `editor.onSelectionChange` and drives
// visibility itself via a `menuState` prop.

const pos = (): DOMRect =>
	({
		top: 100,
		left: 200,
		bottom: 120,
		right: 300,
		width: 100,
		height: 20,
		x: 200,
		y: 100,
		toJSON() {
			return this;
		}
	}) as DOMRect;

function fullState(over: Record<string, unknown> = {}) {
	return {
		show: true,
		link: {
			href: 'https://example.com',
			text: 'example',
			position: pos()
		},
		...over
	};
}

describe('BlockNoteLinkToolbar', () => {
	it('renders nothing when menuState is null', () => {
		render(BlockNoteLinkToolbar, { menuState: null });
		expect(screen.queryByTestId('bn-link-toolbar')).toBeNull();
	});

	it('renders nothing when menuState.show is false', () => {
		render(BlockNoteLinkToolbar, { menuState: fullState({ show: false }) });
		expect(screen.queryByTestId('bn-link-toolbar')).toBeNull();
	});

	it('renders the URL input + Ouvrir + Supprimer when show=true', () => {
		render(BlockNoteLinkToolbar, { menuState: fullState() });
		expect(screen.getByTestId('bn-link-toolbar')).toBeInTheDocument();
		const url = screen.getByLabelText(/url/i) as HTMLInputElement;
		expect(url).toBeInTheDocument();
		expect(url.value).toBe('https://example.com');
		expect(screen.getByRole('button', { name: /ouvrir|open/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /supprimer|delete/i })).toBeInTheDocument();
	});

	it('positions the toolbar under the link position', () => {
		render(BlockNoteLinkToolbar, { menuState: fullState() });
		const tb = screen.getByTestId('bn-link-toolbar') as HTMLElement;
		expect(tb.style.position).toBe('fixed');
		// top = position.bottom + 4 ; left = position.left
		expect(tb.style.top).toBe('124px');
		expect(tb.style.left).toBe('200px');
	});

	it('calls onSave(url) when the user presses Enter in the URL input', async () => {
		const onSave = vi.fn();
		render(BlockNoteLinkToolbar, { menuState: fullState(), onSave });
		const url = screen.getByLabelText(/url/i) as HTMLInputElement;
		await fireEvent.input(url, { target: { value: 'https://new.example.com' } });
		await fireEvent.keyDown(url, { key: 'Enter' });
		expect(onSave).toHaveBeenCalledWith('https://new.example.com');
	});

	it('calls onSave(url) when the Ouvrir button is clicked', async () => {
		const onSave = vi.fn();
		render(BlockNoteLinkToolbar, { menuState: fullState(), onSave });
		await fireEvent.mouseDown(screen.getByRole('button', { name: /ouvrir|open/i }));
		expect(onSave).toHaveBeenCalledWith('https://example.com');
	});

	it('calls onDelete when the Supprimer button is clicked', async () => {
		const onDelete = vi.fn();
		render(BlockNoteLinkToolbar, { menuState: fullState(), onDelete });
		await fireEvent.mouseDown(screen.getByRole('button', { name: /supprimer|delete/i }));
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it('calls onClose when Escape is pressed in the URL input', async () => {
		const onClose = vi.fn();
		render(BlockNoteLinkToolbar, { menuState: fullState(), onClose });
		const url = screen.getByLabelText(/url/i);
		await fireEvent.keyDown(url, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
