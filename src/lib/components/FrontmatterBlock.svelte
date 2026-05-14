<script lang="ts" module>
	/**
	 * Per-key value typing — read at file load + on every value update.
	 * Drives which control renders in structured edit mode (date input,
	 * tag chips, toggle, number input, plain text input, or the readonly
	 * fallback for complex shapes).
	 */
	export type ValueType =
		| 'string'
		| 'number'
		| 'date'
		| 'datetime'
		| 'boolean'
		| 'tags'
		| 'complex';

	const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

	/**
	 * Infer the value's logical type. This is intentionally non-exotic — only
	 * the five common cases get their own UI affordance; everything else
	 * falls through to 'string' (free text) or 'complex' (raw mode only).
	 */
	export function inferValueType(value: unknown): ValueType {
		if (value === null || value === undefined) return 'string';
		if (typeof value === 'boolean') return 'boolean';
		if (typeof value === 'number') return 'number';
		if (value instanceof Date) {
			const iso = value.toISOString();
			return iso.endsWith('T00:00:00.000Z') ? 'date' : 'datetime';
		}
		if (typeof value === 'string') {
			return ISO_DATE_RE.test(value) ? 'date' : 'string';
		}
		if (Array.isArray(value)) {
			if (value.length === 0) return 'tags'; // empty array → start as tags
			const allStrings = value.every((v) => typeof v === 'string');
			return allStrings ? 'tags' : 'complex';
		}
		return 'complex';
	}

	/** Format a Date (or YYYY-MM-DD string) for read-mode display in French. */
	function formatDateForRead(value: unknown): string {
		const d = value instanceof Date ? value : new Date(String(value));
		if (isNaN(d.getTime())) return String(value);
		return d.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function formatDateTimeForRead(value: unknown): string {
		const d = value instanceof Date ? value : new Date(String(value));
		if (isNaN(d.getTime())) return String(value);
		return d.toLocaleString('fr-FR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Format a single frontmatter value for read-mode display.
	 * STEP 5 routes dates / tags / booleans / numbers through typed
	 * formatters; tags get rendered as chip components by the consumer,
	 * not via this helper (it still returns a string fallback for
	 * environments that can't render the chip row).
	 */
	export function formatValueForRead(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'boolean') return value ? 'oui' : 'non';
		if (value instanceof Date) {
			const iso = value.toISOString();
			return iso.endsWith('T00:00:00.000Z')
				? formatDateForRead(value)
				: formatDateTimeForRead(value);
		}
		if (Array.isArray(value)) {
			if (value.length > 8) return '(valeur complexe — éditer en mode brut)';
			const allPrimitive = value.every(
				(item) =>
					item === null ||
					item === undefined ||
					typeof item === 'string' ||
					typeof item === 'number' ||
					typeof item === 'boolean'
			);
			if (!allPrimitive) return '(valeur complexe — éditer en mode brut)';
			return value
				.map((item) => {
					if (item === null || item === undefined) return '—';
					if (typeof item === 'boolean') return item ? 'oui' : 'non';
					return String(item);
				})
				.join(', ');
		}
		if (typeof value === 'object') return '(valeur complexe — éditer en mode brut)';
		if (typeof value === 'string' && ISO_DATE_RE.test(value)) {
			return formatDateForRead(value);
		}
		return String(value);
	}

	/** Best-effort string representation of a scalar for the value input. */
	function scalarToString(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'boolean') return value ? 'true' : 'false';
		if (typeof value === 'number') return String(value);
		if (value instanceof Date) {
			const iso = value.toISOString();
			return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
		}
		return String(value);
	}
</script>

<script lang="ts">
	/**
	 * FrontmatterBlock — UI block for YAML frontmatter (STEPS 2 + 3).
	 *
	 * Three top-level states are driven by the props:
	 *  - Error (parseError !== null)   — red banner with raw YAML.
	 *  - Empty (data === null)         — quiet "Add frontmatter" affordance.
	 *  - Read mode (data !== null)     — polished rows layout.
	 *
	 * Read mode itself has two sub-modes managed locally:
	 *  - collapsed (default, persisted per-file)
	 *  - expanded → pencil reveals the structured edit form
	 *
	 * STEP 3 — structured edit (this revision):
	 *  - Pencil button switches to the edit form.
	 *  - Each row exposes editable key + value inputs.
	 *  - "+ Ajouter un champ" appends an empty row.
	 *  - "×" on each row deletes it.
	 *  - Commits are debounced 200ms via `onChange(data)`.
	 *  - Cancel reverts to the snapshot taken on entering edit mode.
	 *  - Done flushes the pending commit and returns to read mode.
	 *  - Complex values (arrays / objects) render readonly with a tooltip —
	 *    STEP 4 (raw mode) will provide the escape hatch.
	 */
	import { ChevronDown, ChevronRight, Code2, Pencil, Plus, X } from 'lucide-svelte';
	import yaml from 'js-yaml';
	import { parseFrontmatter, serializeFrontmatter } from '$lib/frontmatter/parser';
	import {
		getCollapsed,
		setCollapsed as persistCollapsed
	} from '$lib/stores/frontmatterCollapsed.svelte';

	type Props = {
		/** Parsed frontmatter object. `null` means the file has no frontmatter. */
		data: Record<string, unknown> | null;
		/** When non-null, render the error banner with this message + the raw YAML. */
		parseError: string | null;
		/** Original raw YAML — shown inside the error banner for context. */
		raw?: string;
		/** Stable key identifying the file (e.g. `vaultId::relativePath`). When
		 *  provided, the collapsed state is persisted per file via localStorage. */
		fileKey?: string;
		/** Debounce in ms for committed edit-mode changes. Override for tests. */
		commitDebounceMs?: number;
		/** Fired with the next data object after every edit-mode commit
		 *  (debounced) and on Cancel/Done. Parent re-serializes + writes to disk. */
		onChange?: (data: Record<string, unknown>) => void;
		/** Fired when the user clicks "Add frontmatter" on the empty state. */
		onAdd?: () => void;
		/** Fired when the user clicks "Edit raw YAML" on the error banner. */
		onEditRaw?: () => void;
	};

	let {
		data,
		parseError,
		raw = '',
		fileKey,
		commitDebounceMs = 200,
		onChange = () => {},
		onAdd = () => {},
		onEditRaw = () => {}
	}: Props = $props();

	type DraftRow = {
		id: string;
		key: string;
		type: ValueType;
		/** Scalar text — used by string, number, date, datetime. */
		valueStr: string;
		/** Boolean toggle state — used by type='boolean'. */
		valueBool: boolean;
		/** Tag list — used by type='tags'. */
		valueTags: string[];
		/** Pending text inside the "add tag" input — never persisted as-is. */
		tagDraft: string;
		/** Preserved original value for complex types (arrays / objects).
		 *  Edits to the key still move it along, but the value is opaque. */
		originalValue?: unknown;
	};

	// ----- Mode & collapse state -----

	type Mode = 'read' | 'edit-structured' | 'edit-raw';
	let mode = $state<Mode>('read');

	// Raw editor state — only meaningful when mode === 'edit-raw'.
	let rawDraft = $state<string>('');
	let rawError = $state<string | null>(null);

	let localCollapsed = $state<boolean | null>(null);
	const collapsed = $derived.by<boolean>(() => {
		if (localCollapsed !== null) return localCollapsed;
		if (fileKey) return getCollapsed(fileKey);
		return true;
	});

	$effect(() => {
		// Reset the local override when the file changes so the persisted
		// state for the new file takes effect immediately. Also exit any
		// in-flight edit mode — switching files cancels the edit silently.
		void fileKey;
		localCollapsed = null;
		mode = 'read';
		draft = [];
		rawDraft = '';
		rawError = null;
	});

	// ----- Edit-mode draft state -----

	let draft = $state<DraftRow[]>([]);
	let original: Record<string, unknown> | null = null;
	let pendingCommit: ReturnType<typeof setTimeout> | null = null;
	let nextRowId = 0;
	function freshId(): string {
		nextRowId += 1;
		return `fr-row-${nextRowId}`;
	}

	const entries = $derived(data === null ? [] : Object.entries(data));
	const isEmptyObject = $derived(data !== null && entries.length === 0);

	function toggleCollapsed(): void {
		const next = !collapsed;
		localCollapsed = next;
		if (fileKey) persistCollapsed(fileKey, next);
	}

	function rowsFromData(d: Record<string, unknown>): DraftRow[] {
		return Object.entries(d).map(([k, v]) => {
			const type = inferValueType(v);
			return {
				id: freshId(),
				key: k,
				type,
				valueStr: type === 'boolean' || type === 'tags' || type === 'complex'
					? ''
					: scalarToString(v),
				valueBool: type === 'boolean' ? (v as boolean) : false,
				valueTags: type === 'tags' ? ([...(v as string[])] as string[]) : [],
				tagDraft: '',
				originalValue: type === 'complex' ? v : undefined
			};
		});
	}

	/** Build the next data object from the current draft. Each row's type
	 *  drives the conversion back to the natural JS value (number, Date,
	 *  boolean, array, string). */
	function dataFromRows(rows: DraftRow[]): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const row of rows) {
			const key = row.key.trim();
			if (key === '') continue;
			// Last-write-wins on duplicate keys — inline validation is a v2
			// polish task.
			switch (row.type) {
				case 'complex':
					result[key] = row.originalValue;
					break;
				case 'boolean':
					result[key] = row.valueBool;
					break;
				case 'tags':
					result[key] = [...row.valueTags];
					break;
				case 'number': {
					if (row.valueStr === '') {
						result[key] = '';
					} else {
						const n = Number(row.valueStr);
						result[key] = Number.isNaN(n) ? row.valueStr : n;
					}
					break;
				}
				case 'date':
				case 'datetime': {
					if (row.valueStr === '') {
						result[key] = '';
					} else {
						const d = new Date(row.valueStr);
						result[key] = Number.isNaN(d.getTime()) ? row.valueStr : d;
					}
					break;
				}
				case 'string': {
					if (row.valueStr === '') {
						result[key] = '';
					} else {
						// YAML round-trip preserves intuition — typing "true" in a
						// string field promotes the row to a boolean on next reload,
						// typing "42" promotes to number, "2026-05-14" to date.
						try {
							const parsed = yaml.load(row.valueStr);
							result[key] = parsed === undefined ? '' : parsed;
						} catch {
							result[key] = row.valueStr;
						}
					}
					break;
				}
			}
		}
		return result;
	}

	function flushPendingCommit(): void {
		if (pendingCommit !== null) {
			clearTimeout(pendingCommit);
			pendingCommit = null;
			onChange(dataFromRows(draft));
		}
	}

	function scheduleCommit(): void {
		if (pendingCommit !== null) clearTimeout(pendingCommit);
		pendingCommit = setTimeout(() => {
			pendingCommit = null;
			onChange(dataFromRows(draft));
		}, commitDebounceMs);
	}

	function enterEdit(): void {
		original = data === null ? {} : structuredClone(data);
		draft = data === null ? [] : rowsFromData(data);
		mode = 'edit-structured';
	}

	// ----- Raw edit transitions -----

	/** Build the initial textarea content — prefer the live parsed `data` so
	 *  the user sees their latest edits; fall back to the raw YAML stored on
	 *  the file when the YAML is malformed (parseError path). */
	function rawSeed(): string {
		if (parseError !== null) return raw;
		if (data === null) return '';
		try {
			return serializeFrontmatter(data);
		} catch {
			return raw;
		}
	}

	function enterRawFromAnywhere(): void {
		// Snapshot the original on entry so Cancel can revert intermediate
		// commits that landed via structured edit before this transition.
		if (original === null) {
			original = data === null ? {} : structuredClone(data);
		}
		// If the structured editor has uncommitted edits, flush them so the
		// raw textarea reflects the latest user state (not a stale snapshot).
		if (mode === 'edit-structured' && pendingCommit !== null) {
			flushPendingCommit();
		}
		rawDraft = rawSeed();
		// Validate the seed immediately — when entering from the error banner
		// the YAML is broken, and the user expects to see the error message
		// (and the disabled Done button) right away, not only after the first
		// keystroke.
		const seedResult = parseFrontmatter(rawDraft);
		rawError = seedResult.ok ? null : seedResult.error;
		mode = 'edit-raw';
	}

	function onRawInput(e: Event): void {
		const v = (e.target as HTMLTextAreaElement).value;
		rawDraft = v;
		// Live-validate without applying — the parent only learns the new
		// data when the user clicks Done (or switches mode and the parse
		// succeeds). Empty content is treated as an empty mapping.
		const result = parseFrontmatter(v);
		rawError = result.ok ? null : result.error;
	}

	function exitRawCommit(): void {
		const result = parseFrontmatter(rawDraft);
		if (!result.ok) {
			rawError = result.error;
			return;
		}
		// Apply through the standard onChange channel — parent re-serializes
		// and the autosave picks it up. Then return to read mode.
		onChange(result.data);
		mode = 'read';
		draft = [];
		rawDraft = '';
		rawError = null;
		original = null;
	}

	function exitRawToStructured(): void {
		const result = parseFrontmatter(rawDraft);
		if (!result.ok) {
			rawError = result.error;
			return;
		}
		// Apply the parsed data first so the structured form opens on the
		// user's latest content, not on the pre-raw snapshot. `enterEdit`
		// reads from `data` which is the parent-supplied prop — we route
		// through `onChange` and then re-enter on the next tick by seeding
		// the draft directly from the parsed result.
		onChange(result.data);
		original = structuredClone(result.data);
		draft = rowsFromData(result.data);
		rawDraft = '';
		rawError = null;
		mode = 'edit-structured';
	}

	function exitRawCancel(): void {
		// Revert to whatever the parent had when the user first entered any
		// edit mode for this file. If `original` is null, the user entered
		// raw mode from the error banner — there's nothing to revert TO
		// (the file was broken on disk), so just exit silently.
		if (original !== null) onChange(original);
		mode = 'read';
		draft = [];
		rawDraft = '';
		rawError = null;
		original = null;
	}

	function exitEditCommit(): void {
		flushPendingCommit();
		mode = 'read';
		draft = [];
		original = null;
	}

	function exitEditCancel(): void {
		if (pendingCommit !== null) {
			clearTimeout(pendingCommit);
			pendingCommit = null;
		}
		// Restore the parent's data to the snapshot taken on entry. This is
		// the only path where Cancel undoes uncommitted intermediate emits.
		if (original !== null) onChange(original);
		mode = 'read';
		draft = [];
		original = null;
	}

	function addRow(): void {
		draft = [
			...draft,
			{
				id: freshId(),
				key: '',
				type: 'string',
				valueStr: '',
				valueBool: false,
				valueTags: [],
				tagDraft: ''
			}
		];
		// No commit here — an empty key would just be filtered out anyway.
	}

	function removeRow(id: string): void {
		draft = draft.filter((r) => r.id !== id);
		scheduleCommit();
	}

	function onKeyInput(id: string, e: Event): void {
		const v = (e.target as HTMLInputElement).value;
		draft = draft.map((r) => (r.id === id ? { ...r, key: v } : r));
		scheduleCommit();
	}

	function onValueInput(id: string, e: Event): void {
		const v = (e.target as HTMLInputElement).value;
		draft = draft.map((r) => (r.id === id ? { ...r, valueStr: v } : r));
		scheduleCommit();
	}

	function onBoolToggle(id: string, e: Event): void {
		const v = (e.target as HTMLInputElement).checked;
		draft = draft.map((r) => (r.id === id ? { ...r, valueBool: v } : r));
		scheduleCommit();
	}

	function onTagDraftInput(id: string, e: Event): void {
		const v = (e.target as HTMLInputElement).value;
		draft = draft.map((r) => (r.id === id ? { ...r, tagDraft: v } : r));
		// No commit — the draft hasn't been promoted to a tag yet.
	}

	function commitTagDraft(id: string): void {
		draft = draft.map((r) => {
			if (r.id !== id) return r;
			const trimmed = r.tagDraft.trim();
			if (trimmed === '') return r;
			if (r.valueTags.includes(trimmed)) {
				return { ...r, tagDraft: '' };
			}
			return { ...r, valueTags: [...r.valueTags, trimmed], tagDraft: '' };
		});
		scheduleCommit();
	}

	function onTagKeydown(id: string, e: KeyboardEvent): void {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commitTagDraft(id);
		} else if (e.key === 'Backspace') {
			// Backspace on an empty draft removes the last chip — standard
			// chip-input UX (Linear, Notion, Apple Mail).
			const row = draft.find((r) => r.id === id);
			if (row && row.tagDraft === '' && row.valueTags.length > 0) {
				e.preventDefault();
				draft = draft.map((r) =>
					r.id === id ? { ...r, valueTags: r.valueTags.slice(0, -1) } : r
				);
				scheduleCommit();
			}
		}
	}

	function removeTag(rowId: string, tag: string): void {
		draft = draft.map((r) =>
			r.id === rowId ? { ...r, valueTags: r.valueTags.filter((t) => t !== tag) } : r
		);
		scheduleCommit();
	}
</script>

{#if mode === 'edit-raw'}
	<section
		class="frontmatter frontmatter--edit frontmatter--raw"
		data-testid="frontmatter-edit-raw"
	>
		<header class="edit-header">
			<span class="read-label">Frontmatter (YAML brut)</span>
			<div class="edit-actions">
				<button
					type="button"
					class="button button--ghost"
					onclick={exitRawCancel}
					data-testid="frontmatter-raw-cancel-btn"
				>
					Annuler
				</button>
				<button
					type="button"
					class="button button--ghost"
					onclick={exitRawToStructured}
					disabled={rawError !== null}
					data-testid="frontmatter-raw-to-structured-btn"
					title={rawError !== null ? 'Corrige le YAML pour revenir au mode structuré' : ''}
				>
					Mode structuré
				</button>
				<button
					type="button"
					class="button button--primary"
					onclick={exitRawCommit}
					disabled={rawError !== null}
					data-testid="frontmatter-raw-done-btn"
					title={rawError !== null ? 'Corrige le YAML pour terminer' : ''}
				>
					Terminé
				</button>
			</div>
		</header>
		<textarea
			class="raw-editor"
			class:has-error={rawError !== null}
			value={rawDraft}
			oninput={onRawInput}
			spellcheck="false"
			autocomplete="off"
			autocapitalize="off"
			rows="10"
			aria-label="YAML brut"
			aria-invalid={rawError !== null}
			data-testid="frontmatter-raw-textarea"
		></textarea>
		{#if rawError !== null}
			<p class="raw-error" data-testid="frontmatter-raw-error">{rawError}</p>
		{/if}
	</section>
{:else if parseError !== null}
	<section
		class="frontmatter frontmatter--error"
		data-testid="frontmatter-error"
		role="alert"
	>
		<header class="error-header">
			<span class="error-title">Frontmatter invalide</span>
			<button
				type="button"
				class="button button--ghost"
				onclick={() => {
					onEditRaw();
					enterRawFromAnywhere();
				}}
				data-testid="frontmatter-edit-raw-btn"
			>
				Modifier le YAML brut
			</button>
		</header>
		<p class="error-message">{parseError}</p>
		{#if raw.length > 0}
			<pre class="error-raw"><code>{raw}</code></pre>
		{/if}
	</section>
{:else if data === null}
	<div class="frontmatter frontmatter--empty" data-testid="frontmatter-empty">
		<span class="empty-text">Pas de frontmatter</span>
		<button
			type="button"
			class="button button--ghost button--add"
			onclick={onAdd}
			data-testid="frontmatter-add-btn"
		>
			<Plus size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
			<span>Ajouter</span>
		</button>
	</div>
{:else if mode === 'edit-structured'}
	<section
		class="frontmatter frontmatter--edit"
		data-testid="frontmatter-edit-structured"
	>
		<header class="edit-header">
			<span class="read-label">Frontmatter (édition)</span>
			<div class="edit-actions">
				<button
					type="button"
					class="button button--ghost"
					onclick={enterRawFromAnywhere}
					data-testid="frontmatter-to-raw-btn"
					title="Passer en mode YAML brut"
				>
					<Code2 size={12} strokeWidth={1.5} aria-hidden="true" focusable="false" />
					<span>YAML brut</span>
				</button>
				<button
					type="button"
					class="button button--ghost"
					onclick={exitEditCancel}
					data-testid="frontmatter-cancel-btn"
				>
					Annuler
				</button>
				<button
					type="button"
					class="button button--primary"
					onclick={exitEditCommit}
					data-testid="frontmatter-done-btn"
				>
					Terminé
				</button>
			</div>
		</header>
		<div class="edit-rows" data-testid="frontmatter-edit-rows">
			{#each draft as row (row.id)}
				<div class="edit-row" data-testid="frontmatter-edit-row" data-row-type={row.type}>
					<input
						type="text"
						class="edit-input edit-key"
						value={row.key}
						oninput={(e) => onKeyInput(row.id, e)}
						aria-label="Clé"
						placeholder="clé"
						data-testid="frontmatter-edit-key"
					/>
					{#if row.type === 'complex'}
						<input
							type="text"
							class="edit-input edit-value edit-value--complex"
							value="(valeur complexe — éditer en mode brut)"
							readonly
							title="Éditer en mode brut"
							aria-label="Valeur (complexe, lecture seule)"
							data-testid="frontmatter-edit-value-complex"
						/>
					{:else if row.type === 'boolean'}
						<label class="toggle-wrap" data-testid="frontmatter-edit-toggle-wrap">
							<input
								type="checkbox"
								class="toggle-input"
								checked={row.valueBool}
								onchange={(e) => onBoolToggle(row.id, e)}
								aria-label="Valeur (booléen)"
								data-testid="frontmatter-edit-toggle"
							/>
							<span class="toggle-track" aria-hidden="true">
								<span class="toggle-thumb"></span>
							</span>
							<span class="toggle-label">{row.valueBool ? 'oui' : 'non'}</span>
						</label>
					{:else if row.type === 'number'}
						<input
							type="number"
							class="edit-input edit-value"
							value={row.valueStr}
							oninput={(e) => onValueInput(row.id, e)}
							aria-label="Valeur (nombre)"
							placeholder="0"
							data-testid="frontmatter-edit-value-number"
						/>
					{:else if row.type === 'date' || row.type === 'datetime'}
						<input
							type={row.type === 'datetime' ? 'datetime-local' : 'date'}
							class="edit-input edit-value"
							value={row.valueStr}
							oninput={(e) => onValueInput(row.id, e)}
							aria-label="Valeur (date)"
							data-testid={row.type === 'datetime'
								? 'frontmatter-edit-value-datetime'
								: 'frontmatter-edit-value-date'}
						/>
					{:else if row.type === 'tags'}
						<div class="chips chips--edit" data-testid="frontmatter-edit-value-tags">
							{#each row.valueTags as tag (tag)}
								<span class="chip chip--editable">
									<span class="chip-label">{tag}</span>
									<button
										type="button"
										class="chip-remove"
										onclick={() => removeTag(row.id, tag)}
										aria-label="Retirer ce tag"
										title="Retirer"
										data-testid="frontmatter-tag-remove"
									>
										<X size={11} strokeWidth={2} aria-hidden="true" focusable="false" />
									</button>
								</span>
							{/each}
							<input
								type="text"
								class="chip-input"
								value={row.tagDraft}
								oninput={(e) => onTagDraftInput(row.id, e)}
								onkeydown={(e) => onTagKeydown(row.id, e)}
								onblur={() => commitTagDraft(row.id)}
								placeholder={row.valueTags.length === 0 ? 'Ajouter un tag…' : ''}
								aria-label="Nouveau tag"
								data-testid="frontmatter-tag-input"
							/>
						</div>
					{:else}
						<input
							type="text"
							class="edit-input edit-value"
							value={row.valueStr}
							oninput={(e) => onValueInput(row.id, e)}
							aria-label="Valeur"
							placeholder="valeur"
							data-testid="frontmatter-edit-value"
						/>
					{/if}
					<button
						type="button"
						class="icon-btn icon-btn--delete"
						onclick={() => removeRow(row.id)}
						aria-label="Supprimer le champ"
						title="Supprimer le champ"
						data-testid="frontmatter-delete-row"
					>
						<X size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
					</button>
				</div>
			{/each}
		</div>
		<button
			type="button"
			class="button button--ghost button--add"
			onclick={addRow}
			data-testid="frontmatter-add-field-btn"
		>
			<Plus size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
			<span>Ajouter un champ</span>
		</button>
	</section>
{:else}
	<section
		class="frontmatter frontmatter--read"
		class:is-collapsed={collapsed}
		data-testid="frontmatter-read"
		data-collapsed={collapsed}
	>
		<header class="read-header">
			<button
				type="button"
				class="toggle"
				onclick={toggleCollapsed}
				aria-expanded={!collapsed}
				aria-controls="frontmatter-body"
				data-testid="frontmatter-toggle"
				title={collapsed ? 'Déplier le frontmatter' : 'Replier le frontmatter'}
			>
				{#if collapsed}
					<ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
				{:else}
					<ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
				{/if}
				<span class="read-label">
					Frontmatter
					{#if entries.length > 0}
						<span class="read-count">·&nbsp;{entries.length}&nbsp;{entries.length > 1 ? 'clés' : 'clé'}</span>
					{/if}
				</span>
			</button>
			{#if !collapsed}
				<button
					type="button"
					class="icon-btn"
					onclick={enterEdit}
					data-testid="frontmatter-edit-btn"
					aria-label="Modifier le frontmatter"
					title="Modifier le frontmatter"
				>
					<Pencil size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
				</button>
			{/if}
		</header>
		{#if !collapsed}
			<div id="frontmatter-body">
				{#if isEmptyObject}
					<p class="read-empty" data-testid="frontmatter-read-empty">Aucune clé</p>
				{:else}
					<dl class="rows">
						{#each entries as [key, value] (key)}
							{@const valueType = inferValueType(value)}
							<div class="row" data-testid="frontmatter-row">
								<dt class="row-key" title={key}>{key}</dt>
								<dd class="row-value">
									{#if valueType === 'tags' && Array.isArray(value)}
										<div class="chips chips--read" data-testid="frontmatter-read-chips">
											{#each value as tag (tag)}
												<span class="chip">{tag}</span>
											{/each}
										</div>
									{:else}
										{formatValueForRead(value)}
									{/if}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</div>
		{/if}
	</section>
{/if}

<style>
	.frontmatter {
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		color: var(--color-text-body);
	}

	/* ---------- Empty state ---------- */

	.frontmatter--empty {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.empty-text {
		color: var(--color-text-secondary);
		font-size: var(--text-caption);
	}

	/* ---------- Error state ---------- */

	.frontmatter--error {
		background: color-mix(in oklab, #f87171 14%, transparent);
		border-color: color-mix(in oklab, #f87171 36%, transparent);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.error-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.error-title {
		font-weight: var(--weight-medium, 500);
		color: var(--color-text-primary);
		font-size: var(--text-ui);
	}

	.error-message {
		margin: 0;
		font-size: var(--text-caption);
		color: var(--color-text-body);
	}

	.error-raw {
		margin: 0;
		padding: var(--space-3);
		background: var(--color-surface-hover);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md, 6px);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-body);
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 200px;
		overflow: auto;
	}

	.error-raw code {
		font-family: inherit;
		color: inherit;
	}

	/* ---------- Read state ---------- */

	/* Compact strip when collapsed — only the header is visible. */
	.frontmatter--read.is-collapsed {
		padding: var(--space-2) var(--space-3);
	}

	.read-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.frontmatter--read.is-collapsed .read-header {
		margin-bottom: 0;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1, 4px);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-family: inherit;
	}

	.toggle:hover {
		color: var(--color-text-primary);
	}

	.toggle:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 2px;
		border-radius: var(--radius-xs, 4px);
	}

	.read-label {
		font-size: var(--text-caption);
		color: inherit;
		text-transform: uppercase;
		letter-spacing: var(--tracking-label, 0.04em);
		font-weight: var(--weight-medium, 500);
	}

	.read-count {
		text-transform: none;
		letter-spacing: 0;
		font-weight: var(--weight-regular, 400);
		color: var(--color-text-muted);
		margin-left: 2px;
	}

	.read-empty {
		margin: 0;
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.row {
		display: grid;
		grid-template-columns: 120px 1fr;
		align-items: baseline;
		gap: var(--space-3);
	}

	.row-key {
		margin: 0;
		font-family: var(--font-ui);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-value {
		margin: 0;
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		color: var(--color-text-primary);
		word-break: break-word;
	}

	/* ---------- Edit state ---------- */

	.frontmatter--edit {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.edit-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.edit-actions {
		display: inline-flex;
		gap: var(--space-2, 8px);
	}

	.edit-rows {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.edit-row {
		display: grid;
		grid-template-columns: 120px 1fr auto;
		align-items: center;
		gap: var(--space-2);
	}

	.edit-input {
		appearance: none;
		min-width: 0;
		width: 100%;
		padding: 5px 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 6px);
		background: var(--color-bg);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		line-height: 1.4;
	}

	.edit-input:focus {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 25%, transparent);
	}

	.edit-key {
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
	}

	.edit-value--complex {
		font-style: italic;
		color: var(--color-text-muted);
		cursor: not-allowed;
		background: var(--color-surface-hover);
	}

	/* ---------- Raw edit state ---------- */

	.raw-editor {
		appearance: none;
		width: 100%;
		min-height: 180px;
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 6px);
		background: var(--color-bg);
		color: var(--color-text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		line-height: 1.5;
		resize: vertical;
		tab-size: 2;
	}

	.raw-editor:focus {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 25%, transparent);
	}

	.raw-editor.has-error {
		border-color: var(--color-status-error);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-status-error) 25%, transparent);
	}

	.raw-error {
		margin: 0;
		font-size: var(--text-caption);
		color: var(--color-status-error);
		font-family: var(--font-mono);
	}

	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ---------- Chips (tags) ---------- */

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.chips--edit {
		min-height: 28px;
		padding: 3px 4px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 6px);
		background: var(--color-bg);
	}

	.chips--edit:focus-within {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 25%, transparent);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: var(--color-surface-active);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-pill, 50px);
		font-size: var(--text-caption);
		color: var(--color-text-primary);
		line-height: 1.4;
		white-space: nowrap;
	}

	.chip--editable {
		padding-right: 4px;
	}

	.chip-label {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chip-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text-muted);
		border-radius: 50%;
		cursor: pointer;
		transition:
			background-color var(--duration-fast) var(--easing-standard),
			color var(--duration-fast) var(--easing-standard);
	}

	.chip-remove:hover {
		background: var(--color-surface-strong);
		color: var(--color-text-primary);
	}

	.chip-input {
		appearance: none;
		flex: 1 1 80px;
		min-width: 80px;
		border: 0;
		outline: none;
		padding: 2px 6px;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
	}

	.chip-input::placeholder {
		color: var(--color-text-muted);
	}

	/* ---------- Toggle (boolean) ---------- */

	.toggle-wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		user-select: none;
		padding: 4px 6px;
	}

	.toggle-input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.toggle-track {
		position: relative;
		display: inline-block;
		width: 32px;
		height: 18px;
		background: var(--color-surface-active);
		border: 1px solid var(--color-border);
		border-radius: 9999px;
		transition: background-color var(--duration-base) var(--easing-standard);
	}

	.toggle-thumb {
		position: absolute;
		top: 1px;
		left: 1px;
		width: 14px;
		height: 14px;
		background: var(--color-text-secondary);
		border-radius: 50%;
		transition:
			transform var(--duration-base) var(--easing-standard),
			background-color var(--duration-base) var(--easing-standard);
	}

	.toggle-input:checked + .toggle-track {
		background: color-mix(in oklab, var(--color-accent) 65%, transparent);
		border-color: var(--color-accent);
	}

	.toggle-input:checked + .toggle-track .toggle-thumb {
		transform: translateX(14px);
		background: var(--color-accent-fg, #fff);
	}

	.toggle-input:focus-visible + .toggle-track {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 2px;
	}

	.toggle-label {
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		min-width: 22px;
	}

	/* ---------- Shared button styling ---------- */

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-xs, 4px);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.icon-btn:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 2px;
	}

	.icon-btn--delete:hover {
		color: var(--color-status-error, #f87171);
	}

	.button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1, 4px);
		padding: var(--space-1, 4px) var(--space-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 6px);
		background: transparent;
		color: var(--color-text-body);
		font-family: var(--font-ui);
		font-size: var(--text-caption);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard),
			border-color var(--duration-base) var(--easing-standard);
	}

	.button:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.button:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 2px;
	}

	.button--ghost {
		background: transparent;
	}

	.button--primary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-fg, #fff);
	}

	.button--primary:hover:not(:disabled) {
		background: color-mix(in oklab, var(--color-accent) 85%, black);
		color: var(--color-accent-fg, #fff);
	}

	.button--add {
		align-self: flex-start;
		gap: var(--space-1, 4px);
	}
</style>
