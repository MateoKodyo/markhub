import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FrontmatterBlock, {
	formatValueForRead,
	inferValueType
} from '../../src/lib/components/FrontmatterBlock.svelte';

describe('FrontmatterBlock — empty state', () => {
	it('renders the empty state when data is null and no parse error', () => {
		render(FrontmatterBlock, { data: null, parseError: null });
		expect(screen.getByTestId('frontmatter-empty')).toBeInTheDocument();
		expect(screen.getByText(/pas de frontmatter/i)).toBeInTheDocument();
		expect(screen.getByTestId('frontmatter-add-btn')).toBeInTheDocument();
		// Neither read nor error blocks must render.
		expect(screen.queryByTestId('frontmatter-read')).toBeNull();
		expect(screen.queryByTestId('frontmatter-error')).toBeNull();
	});

	it('fires onAdd when the "Ajouter" button is clicked', async () => {
		const onAdd = vi.fn();
		render(FrontmatterBlock, { data: null, parseError: null, onAdd });
		await fireEvent.click(screen.getByTestId('frontmatter-add-btn'));
		expect(onAdd).toHaveBeenCalledTimes(1);
	});
});

describe('FrontmatterBlock — error state', () => {
	it('renders the error banner with the message and the raw YAML', () => {
		render(FrontmatterBlock, {
			data: null,
			parseError: 'YAMLException: bad indentation at line 3',
			raw: 'title: Hello\n  bad: indent'
		});
		const banner = screen.getByTestId('frontmatter-error');
		expect(banner).toBeInTheDocument();
		expect(banner).toHaveTextContent(/yamlexception/i);
		expect(banner).toHaveTextContent(/title: Hello/);
		expect(banner).toHaveTextContent(/bad: indent/);
		expect(screen.getByTestId('frontmatter-edit-raw-btn')).toBeInTheDocument();
		// Neither empty nor read blocks must render.
		expect(screen.queryByTestId('frontmatter-empty')).toBeNull();
		expect(screen.queryByTestId('frontmatter-read')).toBeNull();
	});

	it('fires onEditRaw when "Modifier le YAML brut" is clicked', async () => {
		const onEditRaw = vi.fn();
		render(FrontmatterBlock, {
			data: null,
			parseError: 'bad yaml',
			raw: 'oops',
			onEditRaw
		});
		await fireEvent.click(screen.getByTestId('frontmatter-edit-raw-btn'));
		expect(onEditRaw).toHaveBeenCalledTimes(1);
	});

	it('error state wins over data — even when data is provided alongside a parseError', () => {
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: 'malformed',
			raw: 'title: Hello'
		});
		expect(screen.getByTestId('frontmatter-error')).toBeInTheDocument();
		expect(screen.queryByTestId('frontmatter-read')).toBeNull();
	});
});

describe('FrontmatterBlock — read mode', () => {
	it('defaults to collapsed — only the header is visible, no rows', () => {
		render(FrontmatterBlock, {
			data: { title: 'Hello', tags: ['note', 'todo'] },
			parseError: null
		});
		const block = screen.getByTestId('frontmatter-read');
		expect(block).toBeInTheDocument();
		expect(block).toHaveAttribute('data-collapsed', 'true');
		// Toggle is visible; rows + edit button are hidden.
		expect(screen.getByTestId('frontmatter-toggle')).toBeInTheDocument();
		expect(screen.queryAllByTestId('frontmatter-row')).toHaveLength(0);
		expect(screen.queryByTestId('frontmatter-edit-btn')).toBeNull();
	});

	it('expanding via the toggle reveals one row per key with the formatted value', async () => {
		render(FrontmatterBlock, {
			data: { title: 'Hello', tags: ['note', 'todo'], published: true },
			parseError: null
		});
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		const rows = screen.getAllByTestId('frontmatter-row');
		expect(rows).toHaveLength(3);
		expect(screen.getByText('title')).toBeInTheDocument();
		expect(screen.getByText('Hello')).toBeInTheDocument();
		expect(screen.getByText('tags')).toBeInTheDocument();
		// STEP 5 renders tags as chip elements, not as joined text.
		const chipRow = screen.getByTestId('frontmatter-read-chips');
		expect(chipRow).toHaveTextContent('note');
		expect(chipRow).toHaveTextContent('todo');
		expect(screen.getByText('published')).toBeInTheDocument();
		expect(screen.getByText('oui')).toBeInTheDocument();
	});

	it('clicking the pencil switches to the structured edit form', async () => {
		render(FrontmatterBlock, { data: { title: 'Hello' }, parseError: null });
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		await fireEvent.click(screen.getByTestId('frontmatter-edit-btn'));
		expect(screen.getByTestId('frontmatter-edit-structured')).toBeInTheDocument();
		// One row per pre-existing key.
		expect(screen.getAllByTestId('frontmatter-edit-row')).toHaveLength(1);
	});

	it('toggle re-collapses the body when clicked a second time', async () => {
		render(FrontmatterBlock, { data: { title: 'Hello' }, parseError: null });
		const toggle = screen.getByTestId('frontmatter-toggle');
		await fireEvent.click(toggle);
		expect(screen.getAllByTestId('frontmatter-row')).toHaveLength(1);
		await fireEvent.click(toggle);
		expect(screen.queryAllByTestId('frontmatter-row')).toHaveLength(0);
	});

	it('renders the "Aucune clé" placeholder when data is {} but still exposes the Edit button (expanded)', async () => {
		render(FrontmatterBlock, { data: {}, parseError: null });
		expect(screen.getByTestId('frontmatter-read')).toBeInTheDocument();
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		expect(screen.getByTestId('frontmatter-read-empty')).toBeInTheDocument();
		expect(screen.getByText(/aucune clé/i)).toBeInTheDocument();
		expect(screen.getByTestId('frontmatter-edit-btn')).toBeInTheDocument();
		// No row is rendered.
		expect(screen.queryAllByTestId('frontmatter-row')).toHaveLength(0);
	});

	it('renders the long-key tooltip via the title attribute (ellipsis affordance)', async () => {
		const longKey = 'a-very-long-key-that-would-overflow-the-fixed-column';
		render(FrontmatterBlock, {
			data: { [longKey]: 'value' },
			parseError: null
		});
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		const keyEl = screen.getByText(longKey);
		expect(keyEl).toHaveAttribute('title', longKey);
	});
});

describe('formatValueForRead', () => {
	it('returns the em-dash placeholder for null and undefined', () => {
		expect(formatValueForRead(null)).toBe('—');
		expect(formatValueForRead(undefined)).toBe('—');
	});

	it('formats booleans in French (oui / non)', () => {
		expect(formatValueForRead(true)).toBe('oui');
		expect(formatValueForRead(false)).toBe('non');
	});

	it('joins arrays of primitives with ", "', () => {
		expect(formatValueForRead(['note', 'todo'])).toBe('note, todo');
		expect(formatValueForRead([1, 2, 3])).toBe('1, 2, 3');
		expect(formatValueForRead(['a', true, 2])).toBe('a, oui, 2');
	});

	it('returns the complex placeholder for arrays of non-primitives', () => {
		expect(formatValueForRead([{ a: 1 }, { b: 2 }])).toBe(
			'(valeur complexe — éditer en mode brut)'
		);
		expect(formatValueForRead([['nested'], ['arrays']])).toBe(
			'(valeur complexe — éditer en mode brut)'
		);
	});

	it('returns the complex placeholder for arrays longer than 8 items', () => {
		expect(formatValueForRead([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(
			'(valeur complexe — éditer en mode brut)'
		);
	});

	it('returns the complex placeholder for nested objects', () => {
		expect(formatValueForRead({ nested: 'object' })).toBe(
			'(valeur complexe — éditer en mode brut)'
		);
	});

	it('returns String(value) for primitives that fall through', () => {
		expect(formatValueForRead('hello')).toBe('hello');
		expect(formatValueForRead(42)).toBe('42');
		expect(formatValueForRead(0)).toBe('0');
	});
});

describe('FrontmatterBlock — structured edit mode (STEP 3)', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	async function enterEdit(data: Record<string, unknown>): Promise<void> {
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		await fireEvent.click(screen.getByTestId('frontmatter-edit-btn'));
	}

	it('renders one editable row per existing key', async () => {
		render(FrontmatterBlock, {
			data: { title: 'Hello', published: true },
			parseError: null
		});
		await enterEdit({ title: 'Hello', published: true });
		const rows = screen.getAllByTestId('frontmatter-edit-row');
		expect(rows).toHaveLength(2);
		// Both keys + scalar values are rendered as input values.
		const keys = screen
			.getAllByTestId('frontmatter-edit-key')
			.map((el) => (el as HTMLInputElement).value);
		expect(keys).toEqual(['title', 'published']);
	});

	it('typing in a value input fires onChange after the debounce', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			commitDebounceMs: 50,
			onChange
		});
		await enterEdit({ title: 'Hello' });
		const valueInput = screen.getByTestId('frontmatter-edit-value');
		await fireEvent.input(valueInput, { target: { value: 'World' } });
		expect(onChange).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(60);
		expect(onChange).toHaveBeenCalledWith({ title: 'World' });
	});

	it('round-trips scalar types from a string row — "42" becomes a number, "true" a boolean', async () => {
		// String-typed rows (the default for free-form text) still YAML-parse
		// the input on commit so the natural type intuition survives. Number
		// and boolean rows now have their own dedicated controls (STEP 5).
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { note: 'hi' },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEdit({ note: 'hi' });
		const valueInput = screen.getByTestId('frontmatter-edit-value');
		await fireEvent.input(valueInput, { target: { value: '42' } });
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ note: 42 });
		await fireEvent.input(valueInput, { target: { value: 'true' } });
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ note: true });
	});

	it('adding a field appends an empty row', async () => {
		render(FrontmatterBlock, { data: { title: 'x' }, parseError: null });
		await enterEdit({ title: 'x' });
		expect(screen.getAllByTestId('frontmatter-edit-row')).toHaveLength(1);
		await fireEvent.click(screen.getByTestId('frontmatter-add-field-btn'));
		expect(screen.getAllByTestId('frontmatter-edit-row')).toHaveLength(2);
	});

	it('deleting a row fires onChange with the remaining keys', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { a: 1, b: 2 },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEdit({ a: 1, b: 2 });
		const deleteButtons = screen.getAllByTestId('frontmatter-delete-row');
		await fireEvent.click(deleteButtons[0]);
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ b: 2 });
	});

	it('Cancel restores the original and returns to read mode', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEdit({ title: 'Hello' });
		await fireEvent.input(screen.getByTestId('frontmatter-edit-value'), {
			target: { value: 'Modified' }
		});
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ title: 'Modified' });
		await fireEvent.click(screen.getByTestId('frontmatter-cancel-btn'));
		// Last emit is the snapshot taken on Edit entry.
		expect(onChange).toHaveBeenLastCalledWith({ title: 'Hello' });
		expect(screen.queryByTestId('frontmatter-edit-structured')).toBeNull();
	});

	it('Done flushes the pending commit and returns to read mode', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			commitDebounceMs: 50,
			onChange
		});
		await enterEdit({ title: 'Hello' });
		await fireEvent.input(screen.getByTestId('frontmatter-edit-value'), {
			target: { value: 'World' }
		});
		// Click Done BEFORE the debounce elapses — the pending commit must
		// still land, so the parent never loses the user's last keystroke.
		await fireEvent.click(screen.getByTestId('frontmatter-done-btn'));
		expect(onChange).toHaveBeenCalledWith({ title: 'World' });
		expect(screen.queryByTestId('frontmatter-edit-structured')).toBeNull();
	});

	it('object values render readonly with the placeholder message', async () => {
		// STEP 5 promoted `Array<string>` to its own tags type — only nested
		// objects (and mixed arrays) still fall through to the complex
		// placeholder.
		render(FrontmatterBlock, {
			data: { meta: { x: 1 }, mixed: [1, 'two', true] },
			parseError: null
		});
		await enterEdit({ meta: { x: 1 }, mixed: [1, 'two', true] });
		const complexInputs = screen.getAllByTestId(
			'frontmatter-edit-value-complex'
		);
		expect(complexInputs).toHaveLength(2);
		complexInputs.forEach((el) => {
			expect(el).toHaveAttribute('readonly');
			expect((el as HTMLInputElement).value).toContain('complexe');
		});
	});
});

describe('FrontmatterBlock — typed controls (STEP 5)', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	// ------ T5.1 — inferValueType covers the six recognised shapes ------
	it('inferValueType maps each value shape to the right type', () => {
		expect(inferValueType('Hello')).toBe('string');
		expect(inferValueType(42)).toBe('number');
		expect(inferValueType(true)).toBe('boolean');
		expect(inferValueType(false)).toBe('boolean');
		expect(inferValueType('2026-05-14')).toBe('date');
		expect(inferValueType(new Date('2026-05-14T00:00:00Z'))).toBe('date');
		expect(inferValueType(new Date('2026-05-14T10:30:00Z'))).toBe('datetime');
		expect(inferValueType(['a', 'b'])).toBe('tags');
		expect(inferValueType([])).toBe('tags');
		expect(inferValueType({ x: 1 })).toBe('complex');
		expect(inferValueType([1, 'two'])).toBe('complex');
		expect(inferValueType(null)).toBe('string');
	});

	async function enterEditWith(data: Record<string, unknown>) {
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		await fireEvent.click(screen.getByTestId('frontmatter-edit-btn'));
		void data;
	}

	// ------ T5.2 — boolean → toggle ------
	it('boolean values render as a toggle, click flips the value', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { published: true },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEditWith({ published: true });
		const toggle = screen.getByTestId('frontmatter-edit-toggle') as HTMLInputElement;
		expect(toggle.checked).toBe(true);
		await fireEvent.click(toggle);
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ published: false });
	});

	// ------ T5.3 — number → input[type=number] ------
	it('number values render as a number input, typing preserves the number type', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { count: 1 },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEditWith({ count: 1 });
		const input = screen.getByTestId(
			'frontmatter-edit-value-number'
		) as HTMLInputElement;
		expect(input.type).toBe('number');
		await fireEvent.input(input, { target: { value: '42' } });
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ count: 42 });
	});

	// ------ T5.4 — date → input[type=date], read mode formats the date ------
	it('date values render with a date input and a formatted French read view', async () => {
		render(FrontmatterBlock, {
			data: { published_at: '2026-05-14' },
			parseError: null
		});
		// Read mode shows formatted French date.
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		expect(screen.getByText(/14 mai 2026/)).toBeInTheDocument();
		// Edit mode shows a date input.
		await fireEvent.click(screen.getByTestId('frontmatter-edit-btn'));
		const input = screen.getByTestId(
			'frontmatter-edit-value-date'
		) as HTMLInputElement;
		expect(input.type).toBe('date');
		expect(input.value).toBe('2026-05-14');
	});

	// ------ T5.5 — tags → chip list with add input ------
	it('tag arrays render as chips with an "add" input — Enter commits a new tag', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { tags: ['note', 'todo'] },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEditWith({ tags: ['note', 'todo'] });
		// Two chips visible.
		expect(screen.getAllByTestId('frontmatter-tag-remove')).toHaveLength(2);
		// Add a new tag.
		const tagInput = screen.getByTestId(
			'frontmatter-tag-input'
		) as HTMLInputElement;
		await fireEvent.input(tagInput, { target: { value: 'urgent' } });
		await fireEvent.keyDown(tagInput, { key: 'Enter' });
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({
			tags: ['note', 'todo', 'urgent']
		});
	});

	// ------ T5.6 — tag remove button drops the chip ------
	it('clicking a chip × removes the tag', async () => {
		vi.useFakeTimers();
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { tags: ['note', 'todo'] },
			parseError: null,
			commitDebounceMs: 10,
			onChange
		});
		await enterEditWith({ tags: ['note', 'todo'] });
		const removeButtons = screen.getAllByTestId('frontmatter-tag-remove');
		await fireEvent.click(removeButtons[0]);
		await vi.advanceTimersByTimeAsync(20);
		expect(onChange).toHaveBeenLastCalledWith({ tags: ['todo'] });
	});

	// ------ T5.7 — read mode formats booleans, dates, and renders tag chips ------
	it('read mode formats booleans, dates, and renders tag chips', () => {
		expect(formatValueForRead(true)).toBe('oui');
		expect(formatValueForRead(false)).toBe('non');
		expect(formatValueForRead(new Date('2026-05-14T00:00:00Z'))).toMatch(
			/14 mai 2026/
		);
		expect(formatValueForRead('2026-05-14')).toMatch(/14 mai 2026/);
	});
});

describe('FrontmatterBlock — raw YAML edit mode (STEP 4)', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	async function enterRawFromStructured(initial: Record<string, unknown>): Promise<void> {
		await fireEvent.click(screen.getByTestId('frontmatter-toggle'));
		await fireEvent.click(screen.getByTestId('frontmatter-edit-btn'));
		await fireEvent.click(screen.getByTestId('frontmatter-to-raw-btn'));
		void initial;
	}

	// ------ R4.1 — entry from structured edit shows current data as YAML ------
	it('switching from structured edit to raw seeds the textarea with the current data', async () => {
		render(FrontmatterBlock, {
			data: { title: 'Hello', published: true },
			parseError: null
		});
		await enterRawFromStructured({ title: 'Hello', published: true });
		const textarea = screen.getByTestId(
			'frontmatter-raw-textarea'
		) as HTMLTextAreaElement;
		expect(textarea).toBeInTheDocument();
		expect(textarea.value).toContain('title: Hello');
		expect(textarea.value).toContain('published: true');
		// No error on entry.
		expect(screen.queryByTestId('frontmatter-raw-error')).toBeNull();
	});

	// ------ R4.2 — entry from error banner enters raw mode with the raw YAML ------
	it('clicking "Modifier le YAML brut" on the error banner enters raw mode with the broken YAML', async () => {
		render(FrontmatterBlock, {
			data: null,
			parseError: 'YAMLException: bad indentation',
			raw: 'title: Hello\n  bad: indent'
		});
		await fireEvent.click(screen.getByTestId('frontmatter-edit-raw-btn'));
		const textarea = screen.getByTestId(
			'frontmatter-raw-textarea'
		) as HTMLTextAreaElement;
		expect(textarea.value).toBe('title: Hello\n  bad: indent');
		// The live validator immediately surfaces the error.
		expect(screen.getByTestId('frontmatter-raw-error')).toBeInTheDocument();
	});

	// ------ R4.3 — live validation: typing valid YAML clears the error ------
	it('live-validates: invalid YAML shows the error, fixing it clears it', async () => {
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null
		});
		await enterRawFromStructured({ title: 'Hello' });
		const textarea = screen.getByTestId(
			'frontmatter-raw-textarea'
		) as HTMLTextAreaElement;

		// Break it.
		await fireEvent.input(textarea, {
			target: { value: 'title: Hello\n  bad: indent' }
		});
		expect(screen.getByTestId('frontmatter-raw-error')).toBeInTheDocument();
		expect(screen.getByTestId('frontmatter-raw-done-btn')).toBeDisabled();
		expect(
			screen.getByTestId('frontmatter-raw-to-structured-btn')
		).toBeDisabled();

		// Fix it.
		await fireEvent.input(textarea, { target: { value: 'title: World' } });
		expect(screen.queryByTestId('frontmatter-raw-error')).toBeNull();
		expect(screen.getByTestId('frontmatter-raw-done-btn')).not.toBeDisabled();
	});

	// ------ R4.4 — Done with valid YAML commits and returns to read mode ------
	it('Done with valid YAML calls onChange with the parsed data and returns to read mode', async () => {
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			onChange
		});
		await enterRawFromStructured({ title: 'Hello' });
		await fireEvent.input(screen.getByTestId('frontmatter-raw-textarea'), {
			target: { value: 'title: World\npublished: true' }
		});
		await fireEvent.click(screen.getByTestId('frontmatter-raw-done-btn'));
		expect(onChange).toHaveBeenLastCalledWith({
			title: 'World',
			published: true
		});
		expect(screen.queryByTestId('frontmatter-edit-raw')).toBeNull();
	});

	// ------ R4.5 — Done with invalid YAML stays in raw mode and shows the error ------
	it('Done with invalid YAML stays in raw mode', async () => {
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			onChange
		});
		await enterRawFromStructured({ title: 'Hello' });
		await fireEvent.input(screen.getByTestId('frontmatter-raw-textarea'), {
			target: { value: 'title: Hello\n  bad: indent' }
		});
		await fireEvent.click(screen.getByTestId('frontmatter-raw-done-btn'));
		// onChange must NOT fire with broken data — the disabled state on
		// the button is the contract, but we also guard inside the handler.
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByTestId('frontmatter-edit-raw')).toBeInTheDocument();
	});

	// ------ R4.6 — Switching back to structured re-renders the form ------
	it('Switching back to structured form preserves the parsed data', async () => {
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			onChange
		});
		await enterRawFromStructured({ title: 'Hello' });
		await fireEvent.input(screen.getByTestId('frontmatter-raw-textarea'), {
			target: { value: 'title: World' }
		});
		await fireEvent.click(
			screen.getByTestId('frontmatter-raw-to-structured-btn')
		);
		expect(onChange).toHaveBeenLastCalledWith({ title: 'World' });
		expect(screen.getByTestId('frontmatter-edit-structured')).toBeInTheDocument();
	});

	// ------ R4.7 — Cancel reverts to the pre-edit data ------
	it('Cancel reverts to the snapshot taken on entering edit mode', async () => {
		const onChange = vi.fn();
		render(FrontmatterBlock, {
			data: { title: 'Hello' },
			parseError: null,
			onChange
		});
		await enterRawFromStructured({ title: 'Hello' });
		await fireEvent.input(screen.getByTestId('frontmatter-raw-textarea'), {
			target: { value: 'title: World' }
		});
		await fireEvent.click(screen.getByTestId('frontmatter-raw-cancel-btn'));
		// The last onChange call is the revert to the original.
		expect(onChange).toHaveBeenLastCalledWith({ title: 'Hello' });
		expect(screen.queryByTestId('frontmatter-edit-raw')).toBeNull();
	});
});
