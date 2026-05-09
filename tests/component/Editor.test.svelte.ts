import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Mock Milkdown so jsdom doesn't choke on contenteditable / ProseMirror.
// Real Milkdown is exercised in Phase 5 E2E.
vi.mock('@milkdown/crepe', () => {
	class MockCrepe {
		opts: { defaultValue?: string; root?: HTMLElement };
		isReadonly = false;
		constructor(opts: { defaultValue?: string; root?: HTMLElement }) {
			this.opts = opts;
		}
		async create() {
			return this;
		}
		setReadonly(v: boolean) {
			this.isReadonly = v;
		}
		on(_listener: unknown) {}
		destroy() {}
		getMarkdown() {
			return this.opts.defaultValue ?? '';
		}
	}
	return { Crepe: MockCrepe };
});

import Editor from '../../src/lib/components/Editor.svelte';

describe('Editor', () => {
	// ------ C3.1 — content prop is reflected in source mode ------
	it('renders the content prop in the source-mode textarea', () => {
		render(Editor, { content: 'hello world', mode: 'source' });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe('hello world');
	});

	// ------ C3.2 — emits change on input in source mode ------
	it('emits change with the new content when the user types in source mode', async () => {
		const onChange = vi.fn();
		render(Editor, { content: 'a', mode: 'source', onChange });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		await fireEvent.input(textarea, { target: { value: 'a typed' } });
		expect(onChange).toHaveBeenCalledWith('a typed');
	});

	// ------ C3.3 — readonly prevents source-mode edits ------
	it('marks the source-mode textarea readonly when readonly={true}', () => {
		render(Editor, { content: 'x', mode: 'source', readonly: true });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.readOnly).toBe(true);
	});

	// ------ C3.4 — toggle preview/source shows textarea in source ------
	it('shows the source textarea in source mode and hides it in preview mode', async () => {
		const { rerender } = render(Editor, { content: 'hello', mode: 'preview' });
		expect(screen.queryByRole('textbox')).toBeNull();
		await rerender({ content: 'hello', mode: 'source' });
		expect(screen.getByRole('textbox')).toBeInTheDocument();
		expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('hello');
	});

	// ------ C3.5 — frontmatter rendered as collapsible block in preview ------
	it('renders a frontmatter block above Milkdown when content has YAML frontmatter', () => {
		const md = '---\ntitle: Hello\n---\n\n# Body';
		const { container } = render(Editor, { content: md, mode: 'preview' });
		const fm = container.querySelector('[data-frontmatter]');
		expect(fm).not.toBeNull();
		expect(fm?.tagName).toBe('DETAILS');
		expect(fm?.hasAttribute('open')).toBe(false);
		expect(fm?.textContent).toContain('title: Hello');
	});

	it('does NOT render the frontmatter block when content has no YAML', () => {
		const { container } = render(Editor, { content: '# No frontmatter', mode: 'preview' });
		expect(container.querySelector('[data-frontmatter]')).toBeNull();
	});

	// ------ C3.6 — frontmatter visible verbatim in source mode ------
	it('keeps the frontmatter inline in the source-mode textarea (no separate block)', () => {
		const md = '---\ntitle: src\n---\n\nbody';
		const { container } = render(Editor, { content: md, mode: 'source' });
		expect(container.querySelector('[data-frontmatter]')).toBeNull();
		expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(md);
	});
});
