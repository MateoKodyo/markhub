import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BlockNoteFormattingToolbar from '../../src/lib/components/BlockNoteFormattingToolbar.svelte';

// C1 / Étape 2.5.b — Svelte UI for BlockNote's FormattingToolbar plugin.
// The component is pure presentation: it takes a `visible` flag + a
// `referencePos` (anchor under which to render, computed by the host
// from window.getSelection()), the active styles for highlight, and
// a `hasLink` flag. Mark-toggling and link creation are reported back
// via callbacks — the editor logic itself lives in the host page.

const refPos = (): DOMRect =>
	({
		top: 200,
		left: 100,
		bottom: 220,
		right: 200,
		width: 100,
		height: 20,
		x: 100,
		y: 200,
		toJSON() {
			return this;
		}
	}) as DOMRect;

describe('BlockNoteFormattingToolbar', () => {
	it('renders nothing when visible=false', () => {
		render(BlockNoteFormattingToolbar, {
			visible: false,
			referencePos: refPos(),
			activeStyles: {},
			hasLink: false
		});
		expect(screen.queryByTestId('bn-formatting-toolbar')).toBeNull();
	});

	it('renders nothing when referencePos is null even if visible=true', () => {
		render(BlockNoteFormattingToolbar, {
			visible: true,
			referencePos: null,
			activeStyles: {},
			hasLink: false
		});
		expect(screen.queryByTestId('bn-formatting-toolbar')).toBeNull();
	});

	it('renders the 5 formatting buttons when visible', () => {
		render(BlockNoteFormattingToolbar, {
			visible: true,
			referencePos: refPos(),
			activeStyles: {},
			hasLink: false
		});
		expect(screen.getByTestId('bn-formatting-toolbar')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /strike/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /code/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /link|lien/i })).toBeInTheDocument();
	});

	it('marks active buttons with is-active when activeStyles flags are set', () => {
		render(BlockNoteFormattingToolbar, {
			visible: true,
			referencePos: refPos(),
			activeStyles: { bold: true, italic: false, strike: true, code: false },
			hasLink: true
		});
		expect(screen.getByRole('button', { name: /bold/i }).classList.contains('is-active')).toBe(
			true
		);
		expect(screen.getByRole('button', { name: /italic/i }).classList.contains('is-active')).toBe(
			false
		);
		expect(screen.getByRole('button', { name: /strike/i }).classList.contains('is-active')).toBe(
			true
		);
		expect(screen.getByRole('button', { name: /code/i }).classList.contains('is-active')).toBe(
			false
		);
		expect(
			screen.getByRole('button', { name: /link|lien/i }).classList.contains('is-active')
		).toBe(true);
	});

	it('calls onToggle with the matching mark when each style button is clicked', async () => {
		const onToggle = vi.fn();
		render(BlockNoteFormattingToolbar, {
			visible: true,
			referencePos: refPos(),
			activeStyles: {},
			hasLink: false,
			onToggle
		});
		// Buttons preventDefault on mousedown to keep editor focus, so we use
		// mousedown (not click) — same pattern as the slash menu.
		await fireEvent.mouseDown(screen.getByRole('button', { name: /bold/i }));
		await fireEvent.mouseDown(screen.getByRole('button', { name: /italic/i }));
		await fireEvent.mouseDown(screen.getByRole('button', { name: /strike/i }));
		await fireEvent.mouseDown(screen.getByRole('button', { name: /code/i }));
		expect(onToggle).toHaveBeenNthCalledWith(1, 'bold');
		expect(onToggle).toHaveBeenNthCalledWith(2, 'italic');
		expect(onToggle).toHaveBeenNthCalledWith(3, 'strike');
		expect(onToggle).toHaveBeenNthCalledWith(4, 'code');
	});

	it('calls onLink when the link button is clicked', async () => {
		const onLink = vi.fn();
		render(BlockNoteFormattingToolbar, {
			visible: true,
			referencePos: refPos(),
			activeStyles: {},
			hasLink: false,
			onLink
		});
		await fireEvent.mouseDown(screen.getByRole('button', { name: /link|lien/i }));
		expect(onLink).toHaveBeenCalledTimes(1);
	});

	it('positions the toolbar above the referencePos', () => {
		render(BlockNoteFormattingToolbar, {
			visible: true,
			referencePos: refPos(),
			activeStyles: {},
			hasLink: false
		});
		const tb = screen.getByTestId('bn-formatting-toolbar') as HTMLElement;
		// Inline style must contain a `top` and `left` derived from referencePos.
		// We don't pin a pixel value (toolbar height varies), but we assert the
		// rule is set and that `left` matches the anchor's left.
		expect(tb.style.position).toBe('fixed');
		expect(tb.style.left).toBe('100px');
		// `top` is computed from referencePos.top - toolbarHeight - margin; in
		// jsdom the toolbar has no measurable height, so the host falls back to
		// referencePos.top - 40 (default offset). Just check it's a px value.
		expect(tb.style.top).toMatch(/-?\d+px$/);
	});
});
