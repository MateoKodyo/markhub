<script lang="ts">
	import { onMount } from 'svelte';
	import { PanelLeft } from 'lucide-svelte';
	import Editor from '$lib/components/Editor.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import { settingsStore, type SettingsSection } from '$lib/stores/settings.svelte';
	import type { Vault } from '$lib/tauri/types';

	const FIXTURES: Record<string, string> = {
		headings: `# H1 heading example
## H2 heading example
### H3 heading example
#### H4 heading example
##### H5 heading example

A paragraph with **bold text** and *italic text* and \`inline code\` and a [link](https://example.com).

A second paragraph below to check spacing rhythm.`,

		frontmatter: `---
title: Sample document
tags: [demo, polish, frontmatter]
date: 2026-05-14
published: true
priority: 3
author: Matheo
---

# Body title

The frontmatter above renders as the styled FrontmatterBlock — a quiet
metadata strip above the editor. Click the chevron to expand, the
pencil to enter structured edit mode, then "YAML brut" to switch to
the raw textarea.

A paragraph below.`,

		'frontmatter-empty': `# No frontmatter

This file has no \`---\` block so the FrontmatterBlock renders its
empty state with an "Ajouter" affordance.`,

		'frontmatter-error': `---
title: Sample
  bad: indent
extra: oui
---

# Body title

The frontmatter above is malformed (bad YAML indentation). The
FrontmatterBlock surfaces the error banner with the raw YAML and a
button to switch into the raw editor.`,

		slash: `# Type slash to open the menu

The slash menu opens at the caret when "/" is typed in an empty paragraph.`,

		toolbar: `# Floating toolbar

Select this whole sentence to summon the floating toolbar above the selection.

Another paragraph for context.`,

		'long-doc': Array.from({ length: 80 }, (_, i) => `## Section ${i + 1}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n`).join('\n'),

		link: `# Liens fixture

Visite [example](https://example.com) et clique dedans.

Un autre paragraphe.`,

		table: `# Tables fixture

A short text before the table.

| Phase | Owner | Status |
| --- | --- | --- |
| 0 | Matheo | Done |
| 1 | Claude | In review |
| 2 | Both | Planned |

A short text after the table.`,

		'task-list': `# Sprint todos

- [x] Fix slash menu double-render (P0 #1)
- [x] Atomic openFile + requestId guard (P0-2 + P0-3)
- [x] Bound app height + overlay scrollbars (P0-1)
- [ ] Polish text selection
- [ ] Restyle task list checkboxes
- [ ] Decide block handle: enable or hide
- [ ] Final visual validation

Mixed sub-list:

- [x] Done parent
  - [x] Done child
  - [ ] Pending child
- [ ] Pending parent
  - [ ] Nested pending`
	};

	// Fake file-tree entries used by the `sidebar-overflow` fixture. We render
	// a static layout that mirrors the real Sidebar's flex chain (body → .app
	// → .sidebar → .files-section → tree) so the scroll test exercises the
	// same CSS paths as the real app.
	const FAKE_FILES = Array.from({ length: 60 }, (_, i) => ({
		name: `note-${String(i + 1).padStart(2, '0')}.md`
	}));

	const FAKE_VAULT: Vault = {
		id: 'fake-vault',
		name: 'Notes perso',
		path: '/Users/demo/MD',
		mode: 'edit',
		color: '#A78BFA'
	};

	// Recent-vaults list used by the EmptyState fixture. Mix of warm hues
	// from the palette + a longer path that triggers the ellipsis layout.
	const FAKE_RECENT_VAULTS: Vault[] = [
		{ id: 'r1', name: 'Notes perso', path: '/Users/demo/Notes', mode: 'edit', color: '#A78BFA' },
		{ id: 'r2', name: 'Skills Claude', path: '/Users/demo/skills', mode: 'edit', color: '#F472B6' },
		{ id: 'r3', name: 'Markus spec', path: '/Users/demo/projects/markus', mode: 'readonly', color: '#60A5FA' },
		{
			id: 'r4',
			name: 'Knowledge base',
			path: '/Users/demo/long/nested/path/to/knowledge-base-vault',
			mode: 'edit',
			color: '#34D399'
		}
	];

	const APP_SHELL_BODY = `# Architecture overview

The status bar at the bottom shows the active vault, the current document path, the word count, the save status, and the editor mode toggle.

## Why a status bar

Inspired by Warp / VS Code / Cursor — keep the chrome quiet, push contextual info to the bottom rail.

- [x] Define the three zones
- [x] Wire the word count derived store
- [ ] Add cursor line/col position (backlog)`;

	let fixture = $state<string>('headings');
	let content = $derived(FIXTURES[fixture] ?? FIXTURES.headings);
	let ready = $state(false);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const f = params.get('fixture');
		if (
			f &&
			(f in FIXTURES ||
				f === 'sidebar-overflow' ||
				f === 'editor-overflow' ||
				f === 'app-shell' ||
				f === 'empty-state' ||
				f === 'empty-state-no-recents' ||
				f === 'window-chrome' ||
				f === 'window-chrome-collapsed' ||
				f === 'settings-modal')
		) {
			fixture = f;
		}
		// Optional: deep-link the settings modal to a section via ?section=editor
		const sec = params.get('section');
		const valid: SettingsSection[] = [
			'appearance',
			'editor',
			'source',
			'files',
			'advanced'
		];
		if (fixture === 'settings-modal') {
			const startSection = sec && valid.includes(sec as SettingsSection)
				? (sec as SettingsSection)
				: 'appearance';
			settingsStore.open(startSection);
		}
		// Theme URL param — accepts any catalog id (see catalog.ts) and the
		// legacy 'light' / 'dark' shortcuts so existing Playwright URLs keep
		// working. We set the attribute directly (no themeManager.init
		// required) since these fixtures don't boot the full app shell.
		const t = params.get('theme');
		const themeAttr =
			t === 'light' ? 'markhub-light' : t === 'dark' || !t ? 'markhub-dark' : t;
		document.documentElement.setAttribute('data-theme', themeAttr);
		ready = true;
	});
</script>

<svelte:head>
	<title>visual fixture: {fixture}</title>
	<style>
		/* Stabilize screenshots: kill blinking carets, smooth font rendering. */
		* {
			caret-color: transparent !important;
		}
		html,
		body {
			margin: 0;
			padding: 0;
			background: var(--color-bg);
			height: 100%;
			overflow: hidden;
		}
	</style>
</svelte:head>

<div class="visual-host" data-ready={ready}>
	{#if ready}
		{#if fixture === 'app-shell'}
			<!-- Full app-shell mirror: sidebar + editor + status bar.
			     Used by visual tests to assert end-to-end layout in isolation. -->
			<div class="app-mirror app-shell">
				<aside class="sidebar-mirror">
					<section class="vaults-section-mirror">
						<span class="label">Vaults</span>
						<div class="vault-row">Notes perso</div>
						<div class="vault-row">Skills Claude</div>
					</section>
					<section class="files-section-mirror">
						<header class="files-header">
							<span class="label">Fichiers</span>
						</header>
						<input class="filter" placeholder="Filtrer…" />
						<ul class="tree-mirror">
							{#each FAKE_FILES.slice(0, 12) as f (f.name)}
								<li class="entry">{f.name}</li>
							{/each}
						</ul>
					</section>
				</aside>
				<main class="content-mirror">
					<header class="content-header-mirror">subfolder/architecture.md</header>
					<div class="content-body-mirror">
						<Editor content={APP_SHELL_BODY} mode="preview" readonly={false} />
					</div>
					<!-- Status bar lives inside the editor column (Warp pattern) so
					     the sidebar runs full-height to its left. -->
					<StatusBar
						vault={FAKE_VAULT}
						relativePath="subfolder/architecture.md"
						readonly={false}
						content={APP_SHELL_BODY}
						status="saved"
					/>
				</main>
			</div>
		{:else if fixture === 'sidebar-overflow'}
			<!-- Mirrors the real Sidebar's CSS structure (flex root → .sidebar →
			     .vaults-section + .files-section). 60 fake entries push the tree
			     well past the viewport so the scroll behavior is observable. -->
			<div class="app-mirror">
				<aside class="sidebar-mirror">
					<section class="vaults-section-mirror">
						<span class="label">Vaults</span>
						<div class="vault-row">Notes perso</div>
						<div class="vault-row">Skills Claude</div>
					</section>
					<section class="files-section-mirror" data-testid="files-scroll">
						<header class="files-header">
							<span class="label">Fichiers</span>
						</header>
						<input class="filter" placeholder="Filtrer…" />
						<ul class="tree-mirror">
							{#each FAKE_FILES as f (f.name)}
								<li class="entry">{f.name}</li>
							{/each}
						</ul>
					</section>
				</aside>
				<main class="content-mirror">
					<header class="content-header-mirror">/path/to/long-doc.md</header>
					<div class="content-body-mirror" data-testid="editor-scroll">
						<Editor content={FIXTURES['long-doc']} mode="preview" readonly={false} />
					</div>
				</main>
			</div>
		{:else if fixture === 'editor-overflow'}
			<Editor content={FIXTURES['long-doc']} mode="preview" readonly={false} />
		{:else if fixture === 'empty-state'}
			<!-- Launch screen: Markus wordmark, 4 action cards, recent vaults
			     list. Action callbacks are no-ops since we only capture paint. -->
			<EmptyState vaults={FAKE_RECENT_VAULTS} />
		{:else if fixture === 'empty-state-no-recents'}
			<EmptyState vaults={[]} />
		{:else if fixture === 'window-chrome'}
			<!-- Top window chrome strip with the 24×24 sidebar toggle. The
			     traffic-light gutter (left 80px) is preserved so the toggle
			     icon center aligns with where macOS draws the lights. -->
			<div class="chrome-fixture">
				<header class="window-chrome">
					<button
						type="button"
						class="chrome-toggle is-active"
						aria-label="Plier ou déplier la sidebar"
						aria-pressed="true"
					>
						<PanelLeft size={16} strokeWidth={1.5} />
					</button>
				</header>
				<div class="chrome-body">
					<aside class="chrome-sidebar-stub"></aside>
					<main class="chrome-content-stub"></main>
				</div>
			</div>
		{:else if fixture === 'window-chrome-collapsed'}
			<div class="chrome-fixture">
				<header class="window-chrome">
					<button
						type="button"
						class="chrome-toggle"
						aria-label="Plier ou déplier la sidebar"
						aria-pressed="false"
					>
						<PanelLeft size={16} strokeWidth={1.5} />
					</button>
				</header>
				<div class="chrome-body">
					<main class="chrome-content-stub"></main>
				</div>
			</div>
		{:else if fixture === 'settings-modal'}
			<!-- Settings modal baseline: the shell + left-rail navigation (STEP 2).
			     Controls inside each section land in STEP 3+. The modal opens
			     itself via settingsStore.open() in onMount above. -->
			<div class="settings-host"></div>
			<SettingsModal />
		{:else}
			<Editor {content} mode="preview" readonly={false} />
		{/if}
	{/if}
</div>

<style>
	.settings-host {
		/* Fills the viewport so the modal's backdrop has a stable parent. */
		width: 100%;
		height: 100%;
		background: var(--color-bg);
	}

	.visual-host {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100vw;
		background: var(--color-bg);
	}

	/* === sidebar-overflow fixture mirror styles ===
	 * Match the real Sidebar/Editor flex structure so the scroll behaviour
	 * we test here is the same as in the real app. */
	.app-mirror {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.sidebar-mirror {
		display: flex;
		flex-direction: column;
		width: 280px;
		flex-shrink: 0;
		background: var(--color-bg-sidebar);
		border-right: 1px solid var(--color-border-subtle);
		overflow: hidden;
	}

	.vaults-section-mirror {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-3);
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.files-section-mirror {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-3);
	}

	.label {
		font-size: var(--text-label);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.vault-row,
	.entry {
		padding: 4px var(--space-3);
		font-size: var(--text-ui);
		color: var(--color-text-body);
	}

	.tree-mirror {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.filter {
		padding: 6px var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
	}

	.content-mirror {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.content-header-mirror {
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--color-border-subtle);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		min-height: 44px;
		display: flex;
		align-items: center;
	}

	.content-body-mirror {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	/* === window-chrome fixture mirror === */
	.chrome-fixture {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.window-chrome {
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
		padding: 5px var(--space-3) 0 80px;
		background: var(--color-bg);
	}

	.chrome-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.chrome-toggle.is-active {
		color: var(--color-text-primary);
	}

	.chrome-body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.chrome-sidebar-stub {
		width: 280px;
		flex-shrink: 0;
		background: var(--color-bg-sidebar);
		border-right: 1px solid var(--color-border-subtle);
	}

	.chrome-content-stub {
		flex: 1;
		background: var(--color-bg);
	}
</style>
