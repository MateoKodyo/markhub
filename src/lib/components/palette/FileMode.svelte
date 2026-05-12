<script lang="ts">
	/**
	 * FileMode — vault-file body of the palette shell. Reads
	 * `vaultTreeStore.files` (flat list of all .md files) and the
	 * `recentFilesStore` MRU, ranks against the parent's query via
	 * `rankFiles`, and renders one row per result.
	 *
	 * Visual: filename on the left (with match highlight), relative-path
	 * tail on the right (also highlightable, muted color). The currently
	 * open file is excluded so the switcher always offers somewhere to go.
	 *
	 * The parent owns the palette state (`query`, `selectedIndex`) and
	 * binds back `itemCount` so the shell's Up/Down nav matches what we
	 * render. Activation flows through `onActivate(entry)`.
	 */

	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { recentFilesStore } from '$lib/stores/recentFiles.svelte';
	import { vaultTreeStore } from '$lib/stores/vaultTree.svelte';
	import {
		rankFiles,
		type FilePaletteEntry,
		type RankedFile
	} from '$lib/commands/fuzzyFiles';
	import { FileText } from 'lucide-svelte';

	type Props = {
		query: string;
		selectedIndex: number;
		onActivate: (entry: FilePaletteEntry) => void;
		itemCount?: number;
	};

	let {
		query,
		selectedIndex,
		onActivate,
		itemCount = $bindable(0)
	}: Props = $props();

	const excludeSet = $derived.by(() => {
		const set = new Set<string>();
		const af = activeFileStore.activeFile;
		if (af) set.add(`${af.vaultId}::${af.relativePath}`);
		return set;
	});

	const ranked: RankedFile[] = $derived(
		rankFiles(
			vaultTreeStore.files,
			query,
			recentFilesStore.getRecent(),
			excludeSet
		)
	);

	$effect(() => {
		itemCount = ranked.length;
	});

	function splitByIndices(
		text: string,
		indices: number[] | undefined
	): { text: string; match: boolean }[] {
		if (!indices || indices.length === 0) return [{ text, match: false }];
		const sorted = [...indices].sort((a, b) => a - b);
		const out: { text: string; match: boolean }[] = [];
		let cursor = 0;
		for (const idx of sorted) {
			if (idx < 0 || idx >= text.length) continue;
			if (idx > cursor) out.push({ text: text.slice(cursor, idx), match: false });
			out.push({ text: text.charAt(idx), match: true });
			cursor = idx + 1;
		}
		if (cursor < text.length) out.push({ text: text.slice(cursor), match: false });
		return out;
	}

	/**
	 * Tail of the relative path WITHOUT the filename. So `notes/x/foo.md`
	 * yields `notes/x/`. Empty for files at the vault root.
	 */
	function pathTail(entry: FilePaletteEntry): string {
		const i = entry.relativePath.lastIndexOf('/');
		return i < 0 ? '' : entry.relativePath.slice(0, i + 1);
	}

	/**
	 * Translate matchInPath indices (relative to the full relativePath)
	 * into indices relative to the pathTail rendered portion.
	 */
	function tailMatchIndices(
		entry: FilePaletteEntry,
		matchInPath: number[] | undefined
	): number[] | undefined {
		if (!matchInPath) return undefined;
		const tailLen = pathTail(entry).length;
		if (tailLen === 0) return undefined;
		return matchInPath.filter((i) => i < tailLen);
	}
</script>

{#if ranked.length === 0}
	<div class="file-mode-empty" data-testid="file-mode-empty">
		{#if vaultTreeStore.files.length === 0}
			No files in this vault
		{:else}
			No matching file
		{/if}
	</div>
{:else}
	<ul class="file-mode-list" role="listbox">
		{#each ranked as r, i (r.entry.vaultId + '::' + r.entry.relativePath)}
			{@const nameParts = splitByIndices(r.entry.name, r.matchInName)}
			{@const tail = pathTail(r.entry)}
			{@const tailParts = splitByIndices(tail, tailMatchIndices(r.entry, r.matchInPath))}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- Keyboard activation is handled by the shell input (Enter). -->
			<li
				role="option"
				aria-selected={i === selectedIndex ? 'true' : 'false'}
				class="file-mode-row"
				class:is-selected={i === selectedIndex}
				data-testid="file-mode-row"
				onclick={() => onActivate(r.entry)}
			>
				<FileText
					size={14}
					strokeWidth={1.5}
					class="file-mode-icon"
					aria-hidden="true"
					focusable="false"
				/>
				<span class="file-mode-name" data-testid="file-mode-name">
					{#each nameParts as part, j (j)}
						{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
					{/each}
				</span>
				{#if tail}
					<span class="file-mode-path" data-testid="file-mode-path">
						{#each tailParts as part, j (j)}
							{#if part.match}<mark>{part.text}</mark>{:else}{part.text}{/if}
						{/each}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.file-mode-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.file-mode-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 8px 14px;
		font-size: var(--text-ui);
		color: var(--color-text-body);
		cursor: pointer;
		min-width: 0;
	}

	.file-mode-row :global(.file-mode-icon) {
		flex: 0 0 auto;
		color: var(--color-text-muted);
	}

	.file-mode-row.is-selected {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.file-mode-row.is-selected :global(.file-mode-icon) {
		color: var(--color-text-primary);
	}

	.file-mode-name {
		flex: 0 1 auto;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.01em;
	}

	.file-mode-path {
		flex: 1 1 0;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--color-text-muted);
		font-size: var(--text-caption);
	}

	.file-mode-name mark,
	.file-mode-path mark {
		background: transparent;
		color: var(--color-accent);
		font-weight: 600;
	}

	.file-mode-empty {
		padding: 24px 14px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--text-caption);
	}
</style>
