<script lang="ts">
	/**
	 * SearchMode — vault-wide content search body for the palette shell.
	 *
	 * Calls `searchInVault` whenever the parent's `query` changes,
	 * debounced ~200ms so each keystroke doesn't fire a fresh walk.
	 * Results group by file: a sticky header (path + match count) then
	 * one row per matched line, with the match span highlighted via
	 * <mark>.
	 *
	 * Activation flow: clicking a hit (or pressing Enter on the
	 * keyboard-selected hit) fires `onActivate({ relativePath,
	 * lineNumber })`. The parent opens the file in the editor and
	 * dispatches `editor:jumpToLine` so the source-mode textarea can
	 * scroll to the right row. Preview-mode jump is BACKLOG (BlockNote
	 * line→block resolution is non-trivial).
	 *
	 * The parent owns palette state. Up/Down nav from the shell drives
	 * `selectedIndex` — we flatten file-grouped results into a single
	 * row list to keep the index 1:1 with what the shell sees.
	 */

	import { onDestroy } from 'svelte';
	import { searchInVault } from '$lib/tauri/api';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import {
		DEFAULT_SEARCH_OPTIONS,
		type SearchHit,
		type SearchMatch
	} from '$lib/tauri/types';
	import type { SearchActivation } from './types';

	type Props = {
		query: string;
		selectedIndex: number;
		onActivate: (target: SearchActivation) => void;
		itemCount?: number;
		/** Bindable: exposes the flat list of (path, line) so the parent
		 *  can route keyboard Enter (which fires onActivate(index) at the
		 *  shell level) to the right hit. */
		flatTargets?: SearchActivation[];
	};

	let {
		query,
		selectedIndex,
		onActivate,
		itemCount = $bindable(0),
		flatTargets = $bindable<SearchActivation[]>([])
	}: Props = $props();

	let matches = $state<SearchMatch[]>([]);
	let loading = $state(false);
	let lastQuery = $state(''); // last query whose results are shown

	// Flat list of (match, hit) pairs that the shell's selectedIndex
	// indexes into. Kept in derived sync with `matches`.
	const flatHits = $derived.by<
		{ match: SearchMatch; hit: SearchHit; flatIndex: number }[]
	>(() => {
		const out: { match: SearchMatch; hit: SearchHit; flatIndex: number }[] = [];
		let i = 0;
		for (const m of matches) {
			for (const h of m.hits) {
				out.push({ match: m, hit: h, flatIndex: i });
				i++;
			}
		}
		return out;
	});

	$effect(() => {
		itemCount = flatHits.length;
		flatTargets = flatHits.map((f) => ({
			relativePath: f.match.relativePath,
			lineNumber: f.hit.lineNumber
		}));
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	// Request counter so a late-arriving search doesn't overwrite a
	// fresher one. Each scheduled search claims `++activeRequestId`;
	// when the promise resolves, we drop the result unless its id is
	// still the latest.
	let activeRequestId = 0;

	$effect(() => {
		const q = query.trim();
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		if (q.length === 0) {
			matches = [];
			lastQuery = '';
			loading = false;
			return;
		}
		const vaultId = vaultsStore.activeVaultId;
		if (!vaultId) {
			matches = [];
			lastQuery = q;
			loading = false;
			return;
		}

		const reqId = ++activeRequestId;
		loading = true;
		debounceTimer = setTimeout(async () => {
			try {
				const result = await searchInVault(
					vaultId,
					q,
					DEFAULT_SEARCH_OPTIONS
				);
				if (reqId !== activeRequestId) return; // stale, dropped
				matches = result;
				lastQuery = q;
			} catch (e) {
				if (reqId !== activeRequestId) return;
				console.warn('[search] failed', e);
				matches = [];
				lastQuery = q;
			} finally {
				if (reqId === activeRequestId) loading = false;
			}
		}, 200);
	});

	onDestroy(() => {
		if (debounceTimer !== null) clearTimeout(debounceTimer);
		// Bump the active request id so any in-flight call's resolve is dropped.
		activeRequestId++;
	});

	/**
	 * Split a line into pre/match/post using the match-byte span. The
	 * Rust side returns byte offsets in UTF-8 — fine for ASCII; for
	 * multi-byte chars we slice by byte to stay aligned with what the
	 * matcher saw, accepting that the visible char count may differ.
	 */
	function splitLine(
		line: string,
		matchStart: number,
		matchEnd: number
	): { pre: string; match: string; post: string } {
		const bytes = new TextEncoder().encode(line);
		const pre = new TextDecoder().decode(bytes.subarray(0, matchStart));
		const match = new TextDecoder().decode(bytes.subarray(matchStart, matchEnd));
		const post = new TextDecoder().decode(bytes.subarray(matchEnd));
		return { pre, match, post };
	}
</script>

{#if query.trim().length === 0}
	<div class="search-mode-hint" data-testid="search-mode-empty">
		Type to search across your vault
	</div>
{:else if loading && flatHits.length === 0}
	<div class="search-mode-hint" data-testid="search-mode-loading">
		Searching…
	</div>
{:else if flatHits.length === 0}
	<div class="search-mode-hint" data-testid="search-mode-no-results">
		No matches for "{lastQuery}"
	</div>
{:else}
	<ul class="search-mode-list" role="listbox">
		{#each matches as m (m.relativePath)}
			<li class="search-mode-group" data-testid="search-mode-group">
				<header class="search-mode-group-header">
					<span class="search-mode-group-path">{m.relativePath}</span>
					<span class="search-mode-group-count">{m.hits.length}</span>
				</header>
				{#each m.hits as h (h.lineNumber + ':' + h.matchStart)}
					{@const flat = flatHits.find(
						(f) =>
							f.match.relativePath === m.relativePath &&
							f.hit.lineNumber === h.lineNumber &&
							f.hit.matchStart === h.matchStart
					)}
					{@const parts = splitLine(h.lineContent, h.matchStart, h.matchEnd)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- Keyboard activation is handled by the shell input (Enter). -->
					<div
						role="option"
						tabindex="-1"
						aria-selected={flat?.flatIndex === selectedIndex ? 'true' : 'false'}
						class="search-mode-hit"
						class:is-selected={flat?.flatIndex === selectedIndex}
						data-testid="search-mode-hit"
						onclick={() =>
							onActivate({
								relativePath: m.relativePath,
								lineNumber: h.lineNumber
							})}
					>
						<span class="search-mode-line-number">{h.lineNumber}</span>
						<span class="search-mode-line-content">
							<span class="search-mode-pre">{parts.pre}</span><mark
								>{parts.match}</mark
							><span class="search-mode-post">{parts.post}</span>
						</span>
					</div>
				{/each}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.search-mode-hint {
		padding: 28px 14px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--text-caption);
	}

	.search-mode-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.search-mode-group {
		padding: 4px 0 6px;
		border-top: 1px solid var(--color-border-subtle, var(--color-border));
	}

	.search-mode-group:first-child {
		border-top: none;
	}

	.search-mode-group-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 14px 4px;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		text-transform: none;
		letter-spacing: 0;
	}

	.search-mode-group-path {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search-mode-group-count {
		flex: 0 0 auto;
		margin-left: var(--space-2);
		padding: 1px 7px;
		border: 1px solid var(--color-border);
		border-radius: 9999px;
		font-size: 10px;
		color: var(--color-text-muted);
		background: var(--color-surface-veil);
	}

	.search-mode-hit {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: 4px 14px 4px 22px;
		font-size: var(--text-ui);
		color: var(--color-text-body);
		cursor: pointer;
		min-width: 0;
	}

	.search-mode-hit.is-selected {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.search-mode-line-number {
		flex: 0 0 auto;
		min-width: 28px;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		text-align: right;
	}

	.search-mode-line-content {
		flex: 1 1 0;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
	}

	.search-mode-line-content mark {
		background: transparent;
		color: var(--color-accent);
		font-weight: 600;
	}
</style>
