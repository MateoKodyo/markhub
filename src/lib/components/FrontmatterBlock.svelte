<script lang="ts" module>
	/**
	 * Format a single frontmatter value for read-mode display.
	 *
	 * Rules (per PLAN-FRONTMATTER-UI.md STEP 2):
	 *  - null / undefined        -> "—"
	 *  - boolean                 -> "oui" / "non"
	 *  - Array of primitives     -> joined with ", "
	 *  - Array with non-primitive items OR length > 8 -> complex placeholder
	 *  - Plain object            -> complex placeholder
	 *  - everything else         -> String(value)
	 *
	 * STEP 2 renders every value as text; typed controls (date / chips /
	 * toggles) arrive in STEP 5.
	 */
	export function formatValueForRead(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'boolean') return value ? 'oui' : 'non';
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
		return String(value);
	}

	/**
	 * Whether a value can be edited as a single text input (plain scalar).
	 * Objects and arrays fall back to the readonly placeholder in STEP 3 —
	 * STEP 4 will add the raw-YAML editor for them.
	 */
	function isComplex(value: unknown): boolean {
		if (value === null || value === undefined) return false;
		if (typeof value === 'object') return true;
		return false;
	}

	/** Best-effort string representation of a scalar for the value input. */
	function scalarToString(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'boolean') return value ? 'true' : 'false';
		if (typeof value === 'number') return String(value);
		if (value instanceof Date) {
			// Plain date (no time component) → YYYY-MM-DD; otherwise full ISO.
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
	import { ChevronDown, ChevronRight, Pencil, Plus, X } from 'lucide-svelte';
	import yaml from 'js-yaml';
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
		valueStr: string;
		/** Preserved original value for complex types (arrays / objects).
		 *  Edits to the key still move it along, but the value is opaque. */
		originalValue?: unknown;
		complex: boolean;
	};

	// ----- Mode & collapse state -----

	type Mode = 'read' | 'edit-structured';
	let mode = $state<Mode>('read');

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
			const complex = isComplex(v);
			return {
				id: freshId(),
				key: k,
				valueStr: complex ? '' : scalarToString(v),
				originalValue: complex ? v : undefined,
				complex
			};
		});
	}

	/** Build the next data object from the current draft. YAML round-trip on
	 *  each scalar value preserves natural types (numbers, booleans, dates). */
	function dataFromRows(rows: DraftRow[]): Record<string, unknown> {
		const result: Record<string, unknown> = {};
		for (const row of rows) {
			const key = row.key.trim();
			if (key === '') continue;
			// Last-write-wins on duplicate keys — inline validation is a v2
			// polish task; STEP 3 ships the happy path.
			if (row.complex) {
				result[key] = row.originalValue;
				continue;
			}
			if (row.valueStr === '') {
				result[key] = '';
				continue;
			}
			try {
				const parsed = yaml.load(row.valueStr);
				result[key] = parsed === undefined ? '' : parsed;
			} catch {
				result[key] = row.valueStr;
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
			{ id: freshId(), key: '', valueStr: '', complex: false }
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
</script>

{#if parseError !== null}
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
				onclick={onEditRaw}
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
				<div class="edit-row" data-testid="frontmatter-edit-row">
					<input
						type="text"
						class="edit-input edit-key"
						value={row.key}
						oninput={(e) => onKeyInput(row.id, e)}
						aria-label="Clé"
						placeholder="clé"
						data-testid="frontmatter-edit-key"
					/>
					{#if row.complex}
						<input
							type="text"
							class="edit-input edit-value edit-value--complex"
							value="(valeur complexe — éditer en mode brut)"
							readonly
							title="Éditer en mode brut (à venir)"
							aria-label="Valeur (complexe, lecture seule)"
							data-testid="frontmatter-edit-value-complex"
						/>
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
							<div class="row" data-testid="frontmatter-row">
								<dt class="row-key" title={key}>{key}</dt>
								<dd class="row-value">{formatValueForRead(value)}</dd>
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
