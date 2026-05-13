<script lang="ts">
	/**
	 * CommandPalette — the reusable shell for Cmd+K / Cmd+P / Cmd+Shift+F.
	 *
	 * It owns the chrome (backdrop, panel, header input, footer hints),
	 * keyboard navigation (Up/Down with wrap, Enter to activate, Escape to
	 * close), input auto-focus, and selection lifecycle (resets to 0 when
	 * the query changes, clamps when itemCount shrinks).
	 *
	 * It is mode-agnostic: the body is supplied via the `children` snippet,
	 * which renders the filtered results for whichever mode is active. The
	 * shell tells the body which row is currently selected via the
	 * `selectedIndex` bindable prop.
	 *
	 * Lifted out of any single use site so STEP 3+ can reuse the exact same
	 * shell across three modes.
	 */

	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ChevronRight, FileText, Search } from 'lucide-svelte';

	type Mode = 'command' | 'file' | 'search';

	type Props = {
		/** Show/hide. Parent owns the boolean; we never self-close. */
		open: boolean;
		/** Placeholder text for the search input — varies by mode. */
		placeholder: string;
		/** Total navigable rows. Drives wrap + clamp logic. */
		itemCount: number;
		/** Current query string. Bindable so the parent can clear it. */
		query?: string;
		/** Currently selected row. Bindable so the body can highlight it. */
		selectedIndex?: number;
		/** Current mode — drives the left-side indicator icon. */
		mode?: Mode;
		/** Fired on Escape, backdrop click, and any explicit close request. */
		onClose: () => void;
		/** Fired on every keystroke in the input (debounce is the caller's job). */
		onQueryChange?: (q: string) => void;
		/** Fired when the user presses Enter on the selected row. */
		onActivate?: (index: number) => void;
		/** The mode-specific body — renders the filtered result rows. */
		children?: Snippet;
	};

	let {
		open,
		placeholder,
		itemCount,
		query = $bindable(''),
		selectedIndex = $bindable(0),
		mode = 'command',
		onClose,
		onQueryChange,
		onActivate,
		children
	}: Props = $props();

	let inputEl: HTMLInputElement | null = $state(null);

	// Auto-focus the input whenever the palette opens. queueMicrotask waits
	// for the {#if open} block to mount before reaching into the DOM.
	$effect(() => {
		if (open && inputEl) {
			queueMicrotask(() => inputEl?.focus());
		}
	});

	// Keep selectedIndex within bounds when the body filters the list down.
	// Without this, navigating to row 5 then narrowing to 2 results would
	// leave selection out of range — Enter would resolve to a stale item.
	$effect(() => {
		if (itemCount <= 0) {
			selectedIndex = 0;
			return;
		}
		if (selectedIndex < 0) selectedIndex = 0;
		else if (selectedIndex >= itemCount) selectedIndex = itemCount - 1;
	});

	function onInput(e: Event): void {
		const next = (e.currentTarget as HTMLInputElement).value;
		query = next;
		selectedIndex = 0;
		onQueryChange?.(next);
	}

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (itemCount <= 0) return;
			selectedIndex = (selectedIndex + 1) % itemCount;
			return;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (itemCount <= 0) return;
			selectedIndex = (selectedIndex - 1 + itemCount) % itemCount;
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			if (itemCount <= 0) return;
			onActivate?.(selectedIndex);
			return;
		}
	}

	function onBackdrop(e: MouseEvent): void {
		if (e.target === e.currentTarget) onClose();
	}
</script>

{#if open}
	<!-- Soft entrance matching SettingsModal: backdrop fades, panel scales
	     + fades + drifts. 180ms in, 140ms out, cubicOut.
	     z-index sits above the editor (200) but below confirm dialogs (300+). -->
	<div
		class="backdrop"
		role="presentation"
		data-testid="command-palette-backdrop"
		onclick={onBackdrop}
		transition:fade={{ duration: 160, easing: cubicOut }}
	>
		<div
			class="panel"
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
			data-testid="command-palette"
			in:scale={{ duration: 180, start: 0.97, opacity: 0, easing: cubicOut }}
			out:scale={{ duration: 140, start: 0.98, opacity: 0, easing: cubicOut }}
		>
			<header class="header">
				<span
					class="mode-indicator"
					data-testid="command-palette-mode-indicator"
					data-mode={mode}
					aria-hidden="true"
				>
					{#if mode === 'file'}
						<FileText size={14} strokeWidth={1.5} />
					{:else if mode === 'search'}
						<Search size={14} strokeWidth={1.5} />
					{:else}
						<ChevronRight size={14} strokeWidth={1.75} />
					{/if}
				</span>
				<input
					bind:this={inputEl}
					type="text"
					class="input"
					{placeholder}
					value={query}
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
					aria-label={placeholder}
					data-testid="command-palette-input"
					oninput={onInput}
					onkeydown={onKeydown}
				/>
			</header>

			<div class="body" data-testid="command-palette-body">
				{#if children}
					{@render children()}
				{/if}
			</div>

			<footer class="footer" data-testid="command-palette-footer">
				<span class="hint"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
				<span class="hint"><kbd>⏎</kbd> select</span>
				<span class="hint"><kbd>⎋</kbd> close</span>
			</footer>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding-top: 15vh;
		background: rgba(0, 0, 0, 0.45);
		z-index: 200;
	}

	.panel {
		display: flex;
		flex-direction: column;
		width: 640px;
		max-width: calc(100vw - 48px);
		max-height: 480px;
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		overflow: hidden;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-left: 14px;
		border-bottom: 1px solid var(--color-border);
	}

	.mode-indicator {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		flex: 0 0 auto;
		color: var(--color-text-muted);
		transition: color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	/* Subtle accent hint on the indicator so the user reads the mode at
	   a glance even before the placeholder text registers. */
	.mode-indicator[data-mode='file'],
	.mode-indicator[data-mode='search'] {
		color: var(--color-accent);
	}

	.input {
		flex: 1;
		min-width: 0;
		padding: 14px 16px 14px 0;
		background: transparent;
		border: none;
		outline: none;
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-md);
		letter-spacing: -0.01em;
	}

	.input::placeholder {
		color: var(--color-text-muted);
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 6px 0;
	}

	.footer {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: 8px 12px;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface-veil);
		color: var(--color-text-muted);
		font-size: var(--text-caption);
	}

	.hint {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.hint kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		background: var(--color-surface-hover);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-body);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1;
	}
</style>
