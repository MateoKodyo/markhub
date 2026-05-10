---
title: Sample technical brief
tags: [spec, demo, c1]
date: 2026-05-10
draft: false
---

# Architecture overview

Markhub centralizes markdown files from multiple vaults (Obsidian, Claude skills, project specs) without moving them. Each vault is an alias to a real disk folder.

## Components

The app is split into three layers:

1. **Tauri Rust backend** — file system operations + config persistence
2. **SvelteKit frontend** — UI in Svelte 5 with runes
3. **Milkdown Crepe editor** — WYSIWYG markdown rendering

### Sub-section about the editor

We use Crepe (preset of Milkdown) because it ships:

- Slash menu out of the box
- Floating formatting toolbar
- Block handle for drag-reorder
- Code blocks with syntax highlighting
- Tables, task lists, math (LaTeX)

### Constraints we set

- No new dependencies without justification
- TDD strict: tests RED before code GREEN
- Warm-dark Warp-inspired aesthetic, never blue-tinted black
- Geist Sans + Geist Mono everywhere

## What's next

The next session focuses on:

- Validate round-trip markdown integrity
- Decide whether to migrate from Crepe to BlockNote
- Write the migration WORKPLAN

That's the brief for now.
