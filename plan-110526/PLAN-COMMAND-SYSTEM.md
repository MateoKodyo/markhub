# PLAN — COMMAND SYSTEM

> **Single objective**: deliver the three command surfaces — Cmd+K (command palette), Cmd+P (quick file switcher), Cmd+Shift+F (global search) — sharing a unified architecture.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: PLAN-DESIGN-DEFAULTS must be ✅ complete. This plan does not start while design defaults are in flight.
> **Reference**: `DESIGN-PRINCIPLES.md` governs the visual treatment of all three surfaces.

---

## CONTEXT

Markhub positions itself alongside Warp, Cursor, and Linear — and all three share a defining feature: a fast, keyboard-driven command surface. A developer-grade markdown editor without Cmd+K, Cmd+P, and global search would fail its own positioning.

The three surfaces are technically distinct but share infrastructure (palette UI, fuzzy search, keyboard navigation). Building them together avoids duplication and ensures consistency.

This plan delivers all three in a single coherent workstream.

---

## NON-NEGOTIABLE RULES

Same operating rules as PLAN-BLOCKNOTE and PLAN-DESIGN-DEFAULTS:

1. **Dedicated branch**: `feat/command-system`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step (test URL, procedure, what's visible)
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**: if a library or pattern doesn't deliver what's needed, STOP and escalate
6. **Brutal honesty** on scope and blockers
7. **No new features** beyond what's specified

---

## ARCHITECTURE OVERVIEW

Before diving into steps, the architectural decisions that govern the whole plan:

### Shared infrastructure

All three surfaces use the same UI shell:
- A floating panel, centered horizontally, positioned near the top of the viewport (roughly 15–20% from the top, matching the Cursor/Linear convention)
- Width: ~640px, max-height ~480px with internal scroll
- Backdrop: subtle dim (black at ~30% alpha)
- Single text input at the top
- Scrollable result list below
- Footer with keyboard hints (↑↓ navigate, ⏎ select, ⎋ close)

The shell is implemented **once** as `CommandPalette.svelte` and reused across the three modes.

### Mode differentiation

The shell is opened in one of three modes:

- **Command mode** (Cmd+K): input filters across registered commands
- **File mode** (Cmd+P): input filters across vault files
- **Search mode** (Cmd+Shift+F): input is a search query, results are matches inside files with contextual snippets

The mode determines:
- The prompt placeholder text
- The data source for results
- The result item rendering
- The action triggered on Enter

### Command registry

A central registry of commands is built. Each command has:
```typescript
interface Command {
  id: string;              // unique identifier
  label: string;           // shown in the palette
  description?: string;    // secondary text
  group?: string;          // grouping (e.g., "File", "View", "Settings")
  icon?: string;           // Lucide icon name
  shortcut?: string;       // displayed shortcut (e.g., "⌘N")
  handler: () => void;     // what runs when activated
  when?: () => boolean;    // visibility condition
}
```

Commands are registered at app startup by each feature module. Examples:
- `file.new`, `file.open`, `file.save`, `file.delete`
- `vault.open`, `vault.create`, `vault.switch`
- `view.toggleSidebar`, `view.toggleTheme`, `view.togglePreviewSource`
- `settings.open`, `settings.reset`

The registry powers Cmd+K. Each command is also addressable individually for direct keyboard shortcuts.

### Fuzzy search

Use a battle-tested library for fuzzy matching. Recommendation: **fuzzysort** (small, fast, MIT, no dependencies). Alternative: Fuse.js (more features, larger).

Fuzzy matching is used identically across Command mode and File mode. Search mode uses substring/regex matching via ripgrep (different path, see Step 5).

### File and directory indexing

For Cmd+P (file mode), the vault file tree must be available in memory. The existing vault store should already expose this; the command system consumes it without rebuilding the index.

### Global search via ripgrep

For Cmd+Shift+F, content search runs in the Rust backend via the `grep` and `ignore` crates (the same engine that powers `ripgrep`). The frontend calls a Tauri command that returns matches with file path, line number, and a context snippet.

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Command registry + types | ✅ | `7543c91` | smoke 2026-05-13 (Cmd+S, click fix on rows) |
| 2. Palette shell UI | ✅ | `7543c91` | smoke 2026-05-13 (Cmd+K debug, hover/click) |
| 3. Command mode (Cmd+K) | 🟡 code livré | (commit suivant) | smoke pending — matin 2026-05-14 |
| 4. File mode (Cmd+P) | 🟡 code livré | (commit suivant) | smoke pending — matin 2026-05-14 |
| 5. Search mode backend (Tauri + ripgrep) | ⏳ | — | — |
| 6. Search mode UI (Cmd+Shift+F) | ⏳ | — | — |
| 7. Polish + keyboard ergonomics | ⏳ | — | — |
| 8. Closure | ⏳ | — | — |

---

## STEP 1 — Command registry + types

**Objective**: build the registry infrastructure that the rest of the plan depends on. No UI yet.

### Mission

1. Create `src/lib/commands/registry.ts`:
   - Export the `Command` interface (as defined in Architecture)
   - Export a Svelte store (or singleton object) `commandRegistry` that holds the list
   - Methods: `register(command)`, `unregister(id)`, `getAll()`, `getById(id)`, `getByGroup(group)`
2. Create `src/lib/commands/keymap.ts`:
   - Maps shortcut strings (e.g., `"$mod+k"`, `"$mod+p"`, `"$mod+shift+f"`) to command IDs
   - Uses a small library like **tinykeys** (1KB, MIT) or hand-rolled if preferred
3. Wire keymap to the app's root layout:
   - On mount: bind shortcuts to handlers
   - On destroy: unbind cleanly
4. Register a handful of seed commands to verify the system:
   - `view.toggleSidebar`
   - `view.toggleTheme`
   - `file.save` (manual save, useful even with autosave)

### Validation criteria

- [ ] `src/lib/commands/registry.ts` and `keymap.ts` exist
- [ ] Seed commands registered and listable
- [ ] Pressing Cmd+S triggers manual save (the seed command)
- [ ] Unit tests cover register/unregister/getById/getByGroup
- [ ] `svelte-check`: 0 errors
- [ ] **Matheo's smoke test**: open the app, press Cmd+S, verify file saves immediately

### Expected commit

`feat(commands): introduce command registry and keymap infrastructure`

---

## STEP 2 — Palette shell UI

**Objective**: build the reusable floating palette shell (no mode logic yet — just the empty shell that any mode can populate).

### Mission

1. Create `src/lib/components/CommandPalette.svelte`:
   - Floating panel, fixed position, top ~15% from viewport top
   - Width 640px, max-height 480px
   - Backdrop with subtle dim
   - Header: a single `<input>` with placeholder text (passed as prop)
   - Body: scrollable list area (slot for mode-specific items)
   - Footer: keyboard hint row (↑↓ ⏎ ⎋)
2. Props:
   - `open: boolean`
   - `placeholder: string`
   - `onClose: () => void`
   - `onQueryChange: (q: string) => void`
   - Slot or render prop for results
3. Behavior:
   - Escape closes
   - Click on backdrop closes
   - Input is auto-focused on open
   - Up/Down arrow navigates result items (handled here, via a `selectedIndex` exported as a store)
   - Enter activates the selected item (callback)
4. Visual: follows DESIGN-PRINCIPLES.md (raised surface, shadow-lg, radius-lg, borders, transitions)

### Validation criteria

- [ ] Palette renders correctly in light and dark themes
- [ ] Keyboard navigation works (Up/Down)
- [ ] Escape closes, click outside closes
- [ ] Auto-focus on open
- [ ] `svelte-check`: 0 errors
- [ ] **Matheo's smoke test**: trigger the palette via a temporary debug shortcut, navigate with arrows, close with Escape, verify visual quality

### Expected commit

`feat(commands): reusable command palette shell`

---

## STEP 3 — Command mode (Cmd+K)

**Objective**: wire the palette in Command mode. Pressing Cmd+K opens the palette filtered across registered commands.

### Mission

1. Create `src/lib/components/palette/CommandMode.svelte`:
   - Consumes the command registry
   - Filters the list using fuzzy search on the input query
   - Renders each command as an item: icon + label + group on the left, shortcut hint on the right
   - Activates the command on Enter or click
2. Wire Cmd+K to open the palette in Command mode
3. Register a meaningful set of commands beyond the seeds:
   - **File**: New file, Open file (triggers Cmd+P essentially), Save, Delete current file
   - **Vault**: Open vault, Switch vault, Reveal in Finder/Explorer
   - **View**: Toggle sidebar, Toggle theme, Toggle Preview/Source
   - **Settings**: Open settings, Reset settings
   - **Help**: View documentation, Report bug (opens a URL — outside scope of MVP if no docs URL exists yet)
4. Fuzzy ranking: matches in `label` rank higher than matches in `description`. Recent or frequently-used commands rank higher (track in a small persisted store).

### Validation criteria

- [ ] Cmd+K opens the palette with all registered commands listed
- [ ] Typing filters the list with fuzzy matching
- [ ] Arrow keys navigate, Enter activates the highlighted command
- [ ] Activating a command closes the palette and runs the handler
- [ ] Recently-used commands appear at the top when input is empty
- [ ] **Matheo's smoke test**: open palette, type a few queries, activate various commands, verify each one performs the expected action

### Expected commit

`feat(commands): command palette mode (Cmd+K)`

---

## STEP 4 — File mode (Cmd+P)

**Objective**: wire the palette in File mode. Pressing Cmd+P opens the palette filtered across all files in the current vault.

### Mission

1. Create `src/lib/components/palette/FileMode.svelte`:
   - Reads from the existing vault file store (flat list of all `.md` files in the vault)
   - Fuzzy-filters by file path
   - Renders each file as an item: file icon + file name on the left, relative path on the right (secondary color)
   - Activates → opens the file in the editor
2. Wire Cmd+P to open the palette in File mode
3. Ranking:
   - Currently open file is excluded (no point reopening yourself)
   - Recently opened files rank higher
   - Filename matches rank higher than path matches
4. Match highlighting:
   - Highlight matched characters in the result with a slight emphasis (bold or accent color)

### Validation criteria

- [ ] Cmd+P opens the palette listing all vault files
- [ ] Typing filters with fuzzy matching
- [ ] Selecting a file opens it in the editor and closes the palette
- [ ] Recent files appear at the top when input is empty
- [ ] Performance: filtering is instant even on a vault with 1000+ files
- [ ] **Matheo's smoke test**: open palette via Cmd+P, navigate, open several files; test with a large vault to verify performance

### Expected commit

`feat(commands): quick file switcher (Cmd+P)`

---

## STEP 5 — Search mode backend (Tauri + ripgrep)

**Objective**: build the Rust-side search command that powers Cmd+Shift+F. No UI yet — only the backend.

### Mission

1. Add Rust dependencies to `src-tauri/Cargo.toml`:
   - `grep` (for matching)
   - `ignore` (for walking the directory with .gitignore respect)
2. Create a Tauri command `search_in_vault(vault_path: String, query: String, options: SearchOptions) -> Result<Vec<SearchMatch>, Error>`:
   - `SearchOptions` includes flags: case-sensitive, whole-word, regex
   - `SearchMatch` has: file path (relative to vault), line number, line content (with surrounding context), match span (char start/end within line)
3. The command walks the vault using `ignore::WalkBuilder`, respecting `.gitignore`, skipping hidden directories
4. For each file, it scans line-by-line for matches using `grep::regex::RegexMatcher`
5. Returns matches grouped by file, capped at a reasonable limit (e.g., max 100 matches per file, max 200 files)
6. The command is async and cancellable (Tauri's standard pattern)

### Validation criteria

- [ ] `cargo build` succeeds with the new dependencies
- [ ] `cargo test` includes a test for `search_in_vault` against a fixture vault
- [ ] The command returns correct matches with accurate line numbers and context
- [ ] Performance: search completes in <500ms on a vault with 5000 files
- [ ] Hidden files and gitignored files are excluded
- [ ] **Matheo's smoke test**: invoke the command from the Tauri dev console with a known query, verify the JSON results match expectations

### Expected commit

`feat(commands): ripgrep-based search backend`

---

## STEP 6 — Search mode UI (Cmd+Shift+F)

**Objective**: wire the palette in Search mode. Pressing Cmd+Shift+F opens the palette as a global content search across the vault.

### Mission

1. Create `src/lib/components/palette/SearchMode.svelte`:
   - Calls the `search_in_vault` Tauri command on input change (debounced, ~200ms)
   - Displays results grouped by file:
     - File header: file path + match count
     - Match lines: line number + line content with the match span highlighted
   - Each match line is clickable: clicking opens the file and scrolls to the matched line
2. Wire Cmd+Shift+F to open the palette in Search mode
3. Empty state: when no query is entered, show a hint ("Type to search across your vault")
4. No-results state: clear message ("No matches for `query`")
5. Match highlighting: the matched span is rendered with accent color background or bold accent text

### Validation criteria

- [ ] Cmd+Shift+F opens the palette in Search mode
- [ ] Typing triggers a debounced search
- [ ] Results group by file with match snippets
- [ ] Clicking a match opens the file and jumps to the line
- [ ] Match highlighting is clearly visible
- [ ] Empty state and no-results state are well-handled
- [ ] **Matheo's smoke test**: search for various terms across a real vault, verify results, click matches and confirm correct navigation

### Expected commit

`feat(commands): global search mode (Cmd+Shift+F)`

---

## STEP 7 — Polish + keyboard ergonomics

**Objective**: refine the entire command system to feel premium, fast, and ergonomic.

### Mission

1. Verify all three modes share consistent visuals (refer to DESIGN-PRINCIPLES.md)
2. Add a mode indicator in the input area: a small badge or prefix showing "→" for command, "📄" (or similar Lucide icon) for file, "🔍" for search. This helps when the user opens the palette without remembering which shortcut they pressed.
3. Allow switching modes within the palette without closing:
   - From File mode: typing `>` at the start switches to Command mode (VS Code convention)
   - From any mode: a clear visual affordance to switch
4. Keyboard ergonomics audit:
   - Cmd+K, Cmd+P, Cmd+Shift+F all open immediately (no lag)
   - Escape always closes
   - Up/Down navigates, no other modifier needed
   - Enter activates
   - Cmd+Enter optional (e.g., open file in new tab when tabs exist)
5. Persistence: the recent-commands and recent-files lists persist across app restarts

### Validation criteria

- [ ] All three modes feel consistent in visuals and behavior
- [ ] Mode indicator visible and accurate
- [ ] Mode switching within the palette works
- [ ] Keyboard ergonomics smooth across all flows
- [ ] Persistence works (close app, reopen, recent lists still populated)
- [ ] **Matheo's final smoke test**: full guided tour of the command system, signing off on the feel

### Expected commit

`feat(commands): polish and keyboard ergonomics`

---

## STEP 8 — Closure

- [ ] Final wrap-up sent to Matheo
- [ ] PLAN-COMMAND-SYSTEM.md updated: all steps ✅
- [ ] List of commits and decisions
- [ ] Documentation entry in JOURNAL.md
- [ ] **Manual merge to main by Matheo**

---

## QUESTIONS ANTICIPATED

### "What if ripgrep is too heavy to bundle?"

The `grep` and `ignore` crates are reasonable in size, and Tauri's binary stays acceptable. If it becomes a real problem (binary >50MB), we can revisit by spawning the ripgrep binary as a subprocess instead, but that's a later concern.

### "What if fuzzysort doesn't rank well enough?"

Switch to Fuse.js or a custom scorer. The plan stays the same; only the dependency changes. Flag in JOURNAL.md.

### "What if the user has a giant vault (50k files)?"

Cmd+P needs incremental indexing or virtual scrolling at that scale. Outside MVP scope. Document the limit and revisit if a real user hits it.

### "What if a command should only be available in some contexts?"

The `when?: () => boolean` field on the Command interface covers this. Commands hide themselves when their `when` returns false. Example: "Save file" hides when no file is open.

### "What if the search command times out?"

Tauri commands have a timeout pattern. The frontend cancels in-flight searches when the query changes. Match the standard async/cancellation idiom.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-COMMAND-SYSTEM.md.

Prerequisites:
- PLAN-BLOCKNOTE must be ✅ fully complete
- PLAN-DESIGN-DEFAULTS must be ✅ fully complete
- DESIGN-PRINCIPLES.md is your design source of truth

Read PLAN-COMMAND-SYSTEM.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative for visuals
- No new features beyond what's specified in this plan

Next step: STEP 1 — Command registry + types.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```
