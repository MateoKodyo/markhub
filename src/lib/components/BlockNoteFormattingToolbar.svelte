<script lang="ts">
	/**
	 * Svelte UI for BlockNote's FormattingToolbar plugin.
	 *
	 * Unlike the SuggestionMenu plugin (slash menu), the formattingToolbar
	 * plugin store is just a `Store<boolean>` — visible or not. It does
	 * NOT expose a referencePos. The host computes the anchor itself from
	 * `window.getSelection().getRangeAt(0).getBoundingClientRect()` and
	 * passes it down here.
	 *
	 * The component reports clicks back via `onToggle(mark)` for marks and
	 * `onLink(url)` for links. The host owns the editor instance and applies
	 * marks via `editor.toggleStyles({ bold: true })` etc.
	 *
	 * Link UX: clicking 🔗 swaps the buttons row for an inline URL input
	 * (Enter applies via `onLink(url)`, Escape cancels). `window.prompt`
	 * is unusable here because WKWebView (Tauri / macOS) blocks it.
	 */
	import { tick } from 'svelte';
	import {
		Bold,
		Check,
		Code,
		Copy,
		ExternalLink,
		Italic,
		Link,
		Strikethrough,
		X
	} from 'lucide-svelte';
	import { toast } from '$lib/stores/toast.svelte';

	export type FormattingMark = 'bold' | 'italic' | 'strike' | 'code';

	export type ActiveStyles = {
		bold?: boolean;
		italic?: boolean;
		strike?: boolean;
		code?: boolean;
	};

	let {
		visible = false,
		referencePos = null,
		activeStyles = {},
		hasLink = false,
		currentHref = '',
		onToggle = (_: FormattingMark) => {},
		onLink = (_url: string) => {},
		onOpenLink = () => {}
	}: {
		visible?: boolean;
		referencePos?: DOMRect | null;
		activeStyles?: ActiveStyles;
		hasLink?: boolean;
		currentHref?: string;
		onToggle?: (mark: FormattingMark) => void;
		onLink?: (url: string) => void;
		onOpenLink?: () => void;
	} = $props();

	let toolbarEl: HTMLDivElement | null = $state(null);
	let measuredHeight = $state(0);

	// Inline URL-edit mode triggered by the 🔗 button.
	let editingLink = $state(false);
	let draftHref = $state('');
	let urlInput: HTMLInputElement | null = $state(null);

	// Re-measure once the toolbar is mounted so we can place it above the
	// selection without overlapping it. In jsdom getBoundingClientRect()
	// returns zeros, hence the fallback below.
	$effect(() => {
		if (!visible || !referencePos) return;
		void tick().then(() => {
			if (!toolbarEl) return;
			const r = toolbarEl.getBoundingClientRect();
			measuredHeight = r.height || 0;
		});
	});

	// Reset edit-mode when the toolbar hides.
	$effect(() => {
		if (!visible) {
			editingLink = false;
			draftHref = '';
		}
	});

	const FALLBACK_HEIGHT = 32;
	const MARGIN = 8;

	const top = $derived.by(() => {
		if (!referencePos) return 0;
		const h = measuredHeight || FALLBACK_HEIGHT;
		const desired = referencePos.top - h - MARGIN;
		// If we'd render off-screen at the top, flip below the selection.
		if (desired < MARGIN) return referencePos.bottom + MARGIN;
		return desired;
	});

	const left = $derived(referencePos ? referencePos.left : 0);

	type ButtonSpec = {
		mark: FormattingMark;
		icon: typeof Bold;
		label: string;
	};

	const buttons: ButtonSpec[] = [
		{ mark: 'bold', icon: Bold, label: 'Bold' },
		{ mark: 'italic', icon: Italic, label: 'Italic' },
		{ mark: 'strike', icon: Strikethrough, label: 'Strikethrough' },
		{ mark: 'code', icon: Code, label: 'Inline code' }
	];

	function isActive(mark: FormattingMark): boolean {
		return Boolean(activeStyles[mark]);
	}

	function handleMarkMouseDown(e: MouseEvent, mark: FormattingMark) {
		// Prevent the editor from blurring before the toggle runs.
		e.preventDefault();
		onToggle(mark);
	}

	function handleLinkMouseDown(e: MouseEvent) {
		e.preventDefault();
		draftHref = currentHref ?? '';
		editingLink = true;
		void tick().then(() => urlInput?.focus());
	}

	function commitLink() {
		const trimmed = draftHref.trim();
		if (trimmed.length === 0) {
			editingLink = false;
			return;
		}
		onLink(trimmed);
		editingLink = false;
	}

	function cancelLinkEdit() {
		editingLink = false;
	}

	function handleUrlKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitLink();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelLinkEdit();
		}
	}

	function handleApplyMouseDown(e: MouseEvent) {
		e.preventDefault();
		commitLink();
	}

	function handleCancelMouseDown(e: MouseEvent) {
		e.preventDefault();
		cancelLinkEdit();
	}

	function handleOpenLinkMouseDown(e: MouseEvent) {
		e.preventDefault();
		onOpenLink();
	}

	// Copy current selection to clipboard. Uses `document.execCommand('copy')`
	// (officially deprecated but still the reliable cross-browser path inside
	// a contenteditable) — preserves both HTML and plain text in the clipboard,
	// matching the native Cmd+C behavior. The synchronous handler keeps the
	// selection alive between mousedown and the copy command.
	function handleCopyMouseDown(e: MouseEvent) {
		e.preventDefault();
		const sel = window.getSelection();
		if (!sel || sel.isCollapsed) return;
		try {
			const ok = document.execCommand('copy');
			if (ok) {
				toast.success('Sélection copiée');
			} else {
				toast.error('Copie impossible');
			}
		} catch (err) {
			console.warn('[formatting-toolbar] copy failed', err);
			toast.error('Copie impossible');
		}
	}
</script>

{#if visible && referencePos}
	<div
		bind:this={toolbarEl}
		class="bn-toolbar-wrapper"
		data-testid="bn-toolbar-wrapper"
		style="position: fixed; left: {left}px; top: {top}px;"
	>
		<div
			class="bn-formatting-toolbar"
			role="toolbar"
			aria-label="Formatting"
			data-testid="bn-formatting-toolbar"
		>
			{#if editingLink}
			<input
				bind:this={urlInput}
				class="bn-ft-input"
				type="url"
				aria-label="URL"
				placeholder="https://…"
				bind:value={draftHref}
				onkeydown={handleUrlKeydown}
			/>
			<button
				type="button"
				class="bn-ft-btn"
				aria-label="Appliquer le lien"
				title="Appliquer (Entrée)"
				onmousedown={handleApplyMouseDown}
			>
				<Check size={14} />
			</button>
			<button
				type="button"
				class="bn-ft-btn"
				aria-label="Annuler"
				title="Annuler (Échap)"
				onmousedown={handleCancelMouseDown}
			>
				<X size={14} />
			</button>
		{:else}
			{#each buttons as b (b.mark)}
				{@const Icon = b.icon}
				<button
					type="button"
					class="bn-ft-btn"
					class:is-active={isActive(b.mark)}
					aria-label={b.label}
					aria-pressed={isActive(b.mark)}
					title={b.label}
					onmousedown={(e) => handleMarkMouseDown(e, b.mark)}
				>
					<Icon size={14} />
				</button>
			{/each}
			<button
				type="button"
				class="bn-ft-btn"
				class:is-active={hasLink}
				aria-label="Link"
				aria-pressed={hasLink}
				title="Link"
				onmousedown={handleLinkMouseDown}
			>
				<Link size={14} />
			</button>
			{#if hasLink && currentHref}
				<button
					type="button"
					class="bn-ft-btn"
					aria-label="Ouvrir le lien dans le navigateur"
					title="Ouvrir dans le navigateur"
					onmousedown={handleOpenLinkMouseDown}
				>
					<ExternalLink size={14} />
				</button>
			{/if}
		{/if}
		</div>
		<!-- Actions pill — visually separated from the formatting pill
		     because copy is a different category of action (not a mark).
		     Hidden during link-edit mode (the URL input owns the surface). -->
		{#if !editingLink}
			<div
				class="bn-actions-toolbar"
				role="toolbar"
				aria-label="Actions"
				data-testid="bn-actions-toolbar"
			>
				<button
					type="button"
					class="bn-ft-btn"
					aria-label="Copier la sélection"
					title="Copier la sélection"
					onmousedown={handleCopyMouseDown}
					data-testid="bn-actions-copy"
				>
					<Copy size={14} />
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Wrapper holds the two pills side-by-side. The position-fixed
	   sticks here so the pair moves as one block under the selection. */
	.bn-toolbar-wrapper {
		z-index: 80;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-ui);
	}

	/* Step-2.5 minimal styling on Markus tokens. Polish lands at step 3. */
	.bn-formatting-toolbar,
	.bn-actions-toolbar {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: var(--space-1) var(--space-2);
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-popover);
		color: var(--color-text-body);
	}

	.bn-ft-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 5px;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: inherit;
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.bn-ft-btn:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 1px;
	}

	.bn-ft-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.bn-ft-btn.is-active {
		background: var(--color-surface-active);
		color: var(--color-text-primary);
	}

	.bn-ft-input {
		min-width: 220px;
		height: 22px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-xs);
		background: var(--color-bg);
		color: var(--color-text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		outline: none;
		transition:
			border-color var(--duration-base) var(--easing-standard),
			box-shadow var(--duration-base) var(--easing-standard);
	}

	.bn-ft-input:focus-visible {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}
</style>
