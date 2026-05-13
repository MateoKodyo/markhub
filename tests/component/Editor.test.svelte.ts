import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Mock @blocknote/core so jsdom doesn't try to mount a real ProseMirror
// view (contenteditable + DOM observers don't behave under jsdom). The
// real editor is exercised by Playwright in tests/visual.
vi.mock('@blocknote/core', () => {
	class MockEditor {
		document: unknown[] = [];
		isEditable = true;
		mount(_el: HTMLElement) {}
		unmount() {}
		tryParseMarkdownToBlocks(_md: string) {
			return [];
		}
		async blocksToMarkdownLossy() {
			return '';
		}
		replaceBlocks(_a: unknown, _b: unknown) {}
		onChange(_cb: () => void) {
			return () => {};
		}
		onSelectionChange(_cb: () => void) {
			return () => {};
		}
		getExtension(_k: string) {
			return null;
		}
		getActiveStyles() {
			return {};
		}
		getSelectedLinkUrl() {
			return undefined;
		}
		toggleStyles(_s: unknown) {}
		createLink(_url: string) {}
		static create() {
			return new MockEditor();
		}
	}
	return {
		BlockNoteEditor: MockEditor,
		filterSuggestionItems: () => [],
		getDefaultSlashMenuItems: () => []
	};
});
vi.mock('@blocknote/core/style.css', () => ({}));

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

	// ------ C3.5 — frontmatter rendered as dedicated UI block in preview ------
	it('renders the FrontmatterBlock above the editor when content has YAML frontmatter', () => {
		const md = '---\ntitle: Hello\n---\n\n# Body';
		const { container } = render(Editor, { content: md, mode: 'preview' });
		const fm = container.querySelector('[data-testid="frontmatter-read"]');
		expect(fm).not.toBeNull();
		// Block defaults to collapsed — only the header label + the key count
		// are rendered. The rows themselves are hidden until the user toggles.
		expect(fm?.textContent).toMatch(/Frontmatter/i);
		expect(fm?.textContent).toMatch(/1\s*clé/i);
	});

	it('does NOT render any frontmatter block when content has no YAML', () => {
		const { container } = render(Editor, { content: '# No frontmatter', mode: 'preview' });
		expect(container.querySelector('[data-testid^="frontmatter-"]')).toBeNull();
	});

	// ------ C3.6 — frontmatter visible verbatim in source mode ------
	it('keeps the frontmatter inline in the source-mode textarea (no separate block)', () => {
		const md = '---\ntitle: src\n---\n\nbody';
		const { container } = render(Editor, { content: md, mode: 'source' });
		expect(container.querySelector('[data-testid^="frontmatter-"]')).toBeNull();
		expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(md);
	});
});
