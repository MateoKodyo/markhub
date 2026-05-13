<script lang="ts">
	/**
	 * CommandMode — registry-driven body of the palette shell.
	 *
	 * Reads `commandRegistry` and `recentCommandsStore` reactively, ranks
	 * against `query` (via `rankCommands`), renders one row per result, and
	 * forwards activation to the parent (which is responsible for closing
	 * the palette, recording the recent, and invoking the handler).
	 *
	 * The parent binds back `itemCount` so the shell's keyboard nav (Up/
	 * Down/Enter) lines up with what we render. The parent also reads
	 * `selectedIndex` to drive the highlighted row from arrow keys.
	 *
	 * Match highlighting splits the label into runs of matched / unmatched
	 * chars using fuzzysort's index array, wrapping matched chars in a
	 * `<mark>` for visual emphasis.
	 */

	import { commandRegistry, type Command } from '$lib/commands/registry.svelte';
	import { recentCommandsStore } from '$lib/commands/recent.svelte';
	import { rankCommands, type RankedCommand } from '$lib/commands/fuzzy';

	type Props = {
		/** Current input query. Parent owns. */
		query: string;
		/** Highlighted row index. Parent owns (Up/Down arrows). */
		selectedIndex: number;
		/** Fired when a row is clicked. Parent handles record + handler + close. */
		onActivate: (command: Command) => void;
		/** Bindable: how many rows we are showing right now. */
		itemCount?: number;
	};

	let {
		query,
		selectedIndex,
		onActivate,
		itemCount = $bindable(0)
	}: Props = $props();

	// All registered commands as a reactive snapshot. getAll() returns a
	// new array every call; that's fine — the $derived only re-evaluates
	// when the underlying Map mutates.
	const all = $derived(commandRegistry.getAll());
	const recent = $derived(recentCommandsStore.getRecent());
	const ranked: RankedCommand[] = $derived(rankCommands(all, query, recent));

	// Keep the parent's itemCount in sync so the shell's keyboard nav uses
	// the right upper bound. No effect needed — the bindable prop write
	// happens at every render of the derived.
	$effect(() => {
		itemCount = ranked.length;
	});

	/**
	 * Split a label into runs of plain + matched characters using the
	 * sorted `indices` from fuzzysort. Used to highlight which letters of
	 * the label were typed by the user.
	 */
	function splitLabel(
		label: string,
		indices: number[] | undefined
	): { text: string; match: boolean }[] {
		if (!indices || indices.length === 0) return [{ text: label, match: false }];
		const sorted = [...indices].sort((a, b) => a - b);
		const out: { text: string; match: boolean }[] = [];
		let cursor = 0;
		for (const idx of sorted) {
			if (idx > cursor) out.push({ text: label.slice(cursor, idx), match: false });
			out.push({ text: label.charAt(idx), match: true });
			cursor = idx + 1;
		}
		if (cursor < label.length) out.push({ text: label.slice(cursor), match: false });
		return out;
	}
</script>

{#if ranked.length === 0}
	<div class="command-mode-empty" data-testid="command-mode-empty">No matching command</div>
{:else}
	<ul class="command-mode-list" role="listbox">
		{#each ranked as r, i (r.command.id)}
			{@const parts = splitLabel(r.command.label, r.matchIndices)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- Keyboard activation lives on the shell's input (Enter fires
				 onActivate on the parent, which forwards to this mode). -->
			<li
				role="option"
				aria-selected={i === selectedIndex ? 'true' : 'false'}
				class="command-mode-row"
				class:is-selected={i === selectedIndex}
				data-testid="command-mode-row"
				onmouseenter={() => undefined /* selection driven by parent */}
				onclick={() => onActivate(r.command)}
			>
				<span class="command-mode-label" data-testid="command-mode-label">
					{#each parts as part, j (j)}
						{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
					{/each}
				</span>
				<span class="command-mode-aside">
					{#if r.command.shortcut}
						<span class="command-mode-shortcut">{r.command.shortcut}</span>
					{/if}
					{#if r.command.group}
						<span class="command-mode-group">{r.command.group}</span>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.command-mode-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.command-mode-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 8px 14px;
		font-size: var(--text-ui);
		color: var(--color-text-body);
		cursor: pointer;
	}

	.command-mode-row.is-selected {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.command-mode-label {
		flex: 1;
		min-width: 0;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.command-mode-label mark {
		background: transparent;
		color: var(--color-accent);
		font-weight: 600;
	}

	.command-mode-aside {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		flex: 0 0 auto;
	}

	.command-mode-shortcut {
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		padding: 1px 6px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-veil);
	}

	.command-mode-group {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
	}

	.command-mode-empty {
		padding: 24px 14px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--text-caption);
	}
</style>
