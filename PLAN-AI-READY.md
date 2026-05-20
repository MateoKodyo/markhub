# PLAN — AI-READY

> **Single objective**: make Markus the first markdown editor that recognizes and gives first-class treatment to files designed for human-AI collaboration (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, `audience: ai` frontmatter, etc.) — without sending any of them anywhere.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: `feat/editor-polish` resolved or cleanly paused. `main` stable.
> **Reference**: `DESIGN-PRINCIPLES.md` governs all visual treatment. This plan adds a new visual category (AI-aware files) but follows the same restraint rules.

---

## CONTEXT

In 2026, developers spend a meaningful fraction of their time writing markdown files that are **read by AI assistants** — not just by other humans. `CLAUDE.md` at a repo root, `AGENTS.md`, `.cursor/rules`, journals shared with Claude Code, plans co-authored with Cursor — these files have a status that no existing markdown editor recognizes.

These files are **interfaces**, not notes. They carry implicit conventions:
- A `CLAUDE.md` at the root of a repo functions as a system prompt for that project
- An `AGENTS.md` typically describes which agents are involved and their roles
- Frontmatter keys like `audience: claude-code` or `audience: ai` mark a file as written for machine consumption
- A `.cursor/rules` file controls Cursor's behavior in the project

Today, Obsidian, Writer, iA Writer, Tolaria all treat these files like any other `.md`. Markus can be the first to **recognize their status visually and offer dedicated tooling** — while staying absolutely respectful of the frontmatter sovereignty principle (no LLM ever sees these files unless the user explicitly sends them).

This is the **clearest differentiator** Markus can ship in 2026. It's not a feature port from a competitor; it's a positioning move on a niche that doesn't exist yet but is rapidly emerging.

---

## NON-NEGOTIABLE RULES

Same operating rules as PLAN-BLOCKNOTE / PLAN-SETTINGS / PLAN-COMMAND-SYSTEM / PLAN-THEMING / PLAN-CLI:

1. **Dedicated branch**: `feat/ai-ready`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**: detection rules, recognition logic, badges — if any of these grow beyond their spec, STOP and escalate
6. **Brutal honesty** on scope and blockers
7. **Frontmatter sovereignty is absolute**: zero LLM calls in this plan. Detection is pattern-based, deterministic. Any user-facing AI interaction lives in PLAN-AI-COMMANDS, not here.

---

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN — AI-READY v1

**1. Detection layer (deterministic, no LLM):**
- Recognize a curated list of well-known AI-collaboration files by exact filename match:
  - `CLAUDE.md`, `AGENTS.md`, `AGENT.md`
  - `.cursor/rules` (directory) and `.cursor/rules.md`
  - `.aider.conf.yml`, `.aider.conf.yaml` (Aider)
  - `.github/copilot-instructions.md` (Copilot)
  - `GEMINI.md`, `CODEX.md` (other agent conventions)
- Recognize files marked by frontmatter:
  - `audience: ai` (any single value)
  - `audience: [ai, ...]` (array containing `ai`)
  - `audience: claude-code` / `audience: cursor` / `audience: copilot` (specific agents)
- The detection runs at vault scan time and is cached per-file (re-evaluated on file content change for frontmatter-based recognition)

**2. Visual treatment in the sidebar:**
- A subtle accent badge appears next to AI-aware files in the sidebar tree
- The badge is a small icon (sparkle, robot, or — to be decided with Matheo at kickoff — a discreet glyph), 12×12px, in the theme accent color at reduced opacity (`color-mix(in srgb, var(--color-accent) 70%, transparent)`)
- Hover on the badge shows a tooltip identifying the recognized category (e.g., "Claude project instructions", "Cursor rules", "AI-targeted frontmatter")
- A toggle in Settings → Appearance: "Highlight AI-aware files" (default ON)

**3. Visual treatment in the editor header:**
- When an AI-aware file is open, a small chip appears in the editor header (next to the breadcrumb), with the same icon + category label
- The chip is muted, single-line, non-interactive in v1 (no menu, no click action — just a visual cue)

**4. Command palette integration:**
- A new command in `Cmd+K`: "Show AI-aware files in vault" — filters the file list to AI-aware files only
- A new command: "Copy file as AI prompt" — copies the file content to clipboard, optionally with a system-prompt-style preamble (TBD with Matheo)
- A new command: "Open vault `CLAUDE.md`" — direct-opens the vault's root `CLAUDE.md` if it exists, creates it if it doesn't (with a minimal template)

**5. Vault-level surface:**
- A new section in the sidebar (below the file tree, above the status bar — exact position TBD): "AI Context" — collapsed by default
- When expanded: lists all AI-aware files in the current vault with one click to open each
- This makes the AI context of a project **discoverable** at a glance, instead of being scattered across the file tree

### OUT — Reported to PLAN-AI-COMMANDS or future plans

- Any actual LLM call (reformatting, summarization, generation) — that's PLAN-AI-COMMANDS
- MCP server / agent integrations
- Auto-update of `CLAUDE.md` based on session activity
- Detection of AI-edit history (e.g., "this file was modified by Claude Code 3 days ago")
- File-level lock-suggestions ("don't edit while Claude Code is running")
- Vault-level "AI fingerprint" diff view

### OUT — Permanent

- Any feature that sends an AI-aware file to a remote service without explicit user action (frontmatter sovereignty)
- Any agent embedded in Markus that "reads the vault"
- Any built-in chat with the file content as context
- Auto-suggestions of new AI conventions or files
- Server-side analysis of which files are AI-aware

---

## ARCHITECTURE OVERVIEW

### Detection module

A new module `src/lib/ai-ready/detector.ts`:

```typescript
export type AiAwareCategory =
  | 'claude-project'
  | 'agents-md'
  | 'cursor-rules'
  | 'copilot-instructions'
  | 'aider-config'
  | 'gemini'
  | 'codex'
  | 'frontmatter-audience'
  | 'frontmatter-specific-agent';

export interface AiAwareInfo {
  category: AiAwareCategory;
  label: string;        // user-facing
  detail?: string;      // e.g., the specific audience value if frontmatter-based
}

export function detectAiAware(
  filename: string,
  relativePath: string,
  frontmatter: Record<string, unknown> | null,
): AiAwareInfo | null;
```

Detection is **purely deterministic**:
- Filename matching first (fast)
- Path-based matching for `.cursor/rules*`
- Frontmatter-based matching last (requires parsed frontmatter)

The detector is called:
- At vault scan time (Rust returns the file list, frontend parses frontmatter for each file)
- When a file's frontmatter changes (re-evaluated)
- When a file is renamed (re-evaluated)

### Caching strategy

Per-file detection results are cached in a Svelte store `aiAwareStore`, keyed by file path. The cache is rebuilt incrementally:
- Vault scan: bulk detection
- File save: re-detect that file only
- File rename / delete: invalidate the entry

No persistent cache on disk — detection is fast enough to redo from scratch on app start. (Profile in Step 1 to confirm.)

### Visual integration

Sidebar badge: a small Svelte component `AiAwareBadge.svelte`, consumed by the existing file row component. When `aiAwareStore.get(filePath) !== null`, render the badge.

Editor header chip: a small Svelte component `AiAwareChip.svelte`, rendered in the editor header when the active file is AI-aware.

AI Context section: a new Svelte component `AiContextPanel.svelte`, sitting below the file tree in the sidebar. Reads from `aiAwareStore` and the current vault tree, filters and lists matching files.

### Settings integration

Add to the Settings v1 schema (already in PLAN-SETTINGS):

```typescript
appearance: {
  // ... existing fields
  highlightAiAware: boolean;  // default true
}
```

When `false`: sidebar badges hidden, editor chip hidden, but the AI Context panel is still available (it's a deliberate user surface, not a passive hint).

### Settings v2 schema migration

The settings file gets a `version: 3` bump. Migration from v2:
- `highlightAiAware: true` defaulted for all migrated settings

### Command registration

Three new commands added to the command registry (via PLAN-COMMAND-SYSTEM's `Command` interface):

```typescript
{ id: 'ai.show-aware-files', label: 'Show AI-aware files in vault', ... }
{ id: 'ai.copy-as-prompt', label: 'Copy file as AI prompt', when: () => activeFile !== null, ... }
{ id: 'ai.open-claude-md', label: 'Open project CLAUDE.md', ... }
```

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Detection module + tests | ✅ | `4bbf517` | ✅ |
| 2. aiAwareStore + integration with vault scan | ✅ | (this commit) | ⏳ |
| 3. Sidebar badge + Settings toggle | ⏳ | — | — |
| 4. Editor header chip | ⏳ | — | — |
| 5. AI Context panel in sidebar | ⏳ | — | — |
| 6. Command palette commands | ⏳ | — | — |
| 7. Full audit + closure | ⏳ | — | — |

---

## STEP 1 — Detection module + tests

**Objective**: build the pure-function detection layer with full unit test coverage. No UI yet.

### Mission

1. Create `src/lib/ai-ready/detector.ts` with the `detectAiAware()` function as specified above.
2. Define the full match table — at minimum:

| Pattern | Category | Label |
|---|---|---|
| Filename `CLAUDE.md` | `claude-project` | "Claude project instructions" |
| Filename `AGENTS.md` or `AGENT.md` | `agents-md` | "Agents documentation" |
| Path matches `.cursor/rules*` | `cursor-rules` | "Cursor rules" |
| Path matches `.github/copilot-instructions.md` | `copilot-instructions` | "Copilot instructions" |
| Filename `.aider.conf.yml` / `.yaml` | `aider-config` | "Aider configuration" |
| Filename `GEMINI.md` | `gemini` | "Gemini instructions" |
| Filename `CODEX.md` | `codex` | "Codex instructions" |
| Frontmatter `audience: ai` (string or in array) | `frontmatter-audience` | "AI-targeted (frontmatter)" |
| Frontmatter `audience: <agent-id>` (specific) | `frontmatter-specific-agent` | "AI-targeted: \<agent-id\>" |

3. Match precedence: filename > path > frontmatter. First match wins, but the detector returns the **most specific** match if multiple apply.

4. Unit tests (≥20 cases):
   - Each pattern matches its target
   - Negative cases: `claude.md` (lowercase) should NOT match (or should — TBD with Matheo)
   - Frontmatter edge cases: missing, malformed, audience as null, audience as object
   - Path edge cases: file at `.cursor/rules/something.md` vs `.cursor/rules.md`
   - Case sensitivity (decision needed: filename match strict-case or case-insensitive?)

5. **Open question for kickoff**: case sensitivity policy. Recommend strict case-match for filenames (matches how `git` treats them on case-sensitive filesystems), case-insensitive only for `.cursor/rules*` path matching where convention varies.

### Validation criteria

- [ ] `detectAiAware()` exported and typed
- [ ] ≥20 unit tests, all green
- [ ] No external dependencies beyond `js-yaml` (already in package.json)
- [ ] `svelte-check`: 0 errors
- [ ] **Matheo's smoke test**: open the test file, walk through cases together, confirm the table matches expectations

### Expected commit

`feat(ai-ready): deterministic detector for AI-aware files`

---

## STEP 2 — aiAwareStore + integration with vault scan

**Objective**: wire the detector into the vault scan pipeline and expose the results via a Svelte store.

### Mission

1. Create `src/lib/stores/aiAware.ts`:
   - A Svelte writable store holding `Map<filePath, AiAwareInfo | null>`
   - Methods: `set(filePath, info)`, `delete(filePath)`, `clear()`, `getMatching(predicate)`
   - Reactive selectors: `getForFile(filePath)`, `getAllAiAware()` (returns only entries where info ≠ null)

2. Hook into the existing vault scan flow:
   - After `vault_scan` returns the file list, the frontend iterates and:
     - For each file, parses frontmatter (already done by the existing frontmatter pipeline)
     - Calls `detectAiAware(filename, relativePath, frontmatter)`
     - Stores result in `aiAwareStore`

3. Hook into file save:
   - After a successful save, re-detect the active file
   - Update the store entry

4. Hook into file rename / delete:
   - Invalidate the store entry

5. No UI yet — verify via the Svelte devtools that the store populates correctly

### Validation criteria

- [ ] Store populates on vault scan
- [ ] Store updates on file save
- [ ] Store updates on file rename/delete
- [ ] No performance regression on vault open (profile a vault with 500+ files)
- [ ] **Matheo's smoke test**:
  1. Open a vault with at least one `CLAUDE.md` and one frontmatter-tagged file
  2. Inspect `aiAwareStore` via Svelte devtools — confirm entries
  3. Edit the frontmatter of a file to add `audience: ai`, save, verify the store updates
  4. Delete `audience: ai` from frontmatter, save, verify entry is now `null`

### Expected commit

`feat(ai-ready): aiAwareStore with vault scan integration`

### Known limitation — hidden-path patterns deferred (decided 2026-05-20)

The Rust `vault_scan` ignores every entry whose name starts with `.`
(deliberate — keeps `.git`, `.svelte-kit`, etc. out of the sidebar). As
a result the three dot-path detector patterns are **never fed a file**:

- `.cursor/rules` / `.cursor/rules/*`
- `.github/copilot-instructions.md`
- `.aider.conf.yml` / `.yaml`

The detector (STEP 1) already handles all three — its code and tests
stay in place — but STEP 2 ships detection only for the **visible**
surface: `CLAUDE.md`, `AGENTS.md`, `AGENT.md`, `GEMINI.md`, `CODEX.md`,
and the `audience:` frontmatter markers.

Revealing the hidden patterns means deciding whether `.cursor/` and
`.github/` show up in the sidebar tree (a UX decision, not a detail).
Deferred to a dedicated mini-chantier — nothing in STEP 1's detector is
wasted.

---

## STEP 3 — Sidebar badge + Settings toggle

**Objective**: render the visual badge in the sidebar and add the user-facing setting.

### Mission

1. Create `src/lib/components/AiAwareBadge.svelte`:
   - Renders a small icon (Lucide `sparkles` as default — TBD with Matheo for the icon choice)
   - Size 12×12px
   - Color: `color-mix(in srgb, var(--color-accent) 70%, transparent)`
   - Tooltip on hover with the `label` from `AiAwareInfo`

2. Modify the file row component in the sidebar to consume `aiAwareStore.getForFile(filePath)` and conditionally render `AiAwareBadge`.

3. Add the setting:
   - Update settings schema to v3 with `highlightAiAware: boolean` default `true`
   - Write the v2 → v3 migration
   - Add the toggle to Settings → Appearance section, with explanation copy: "Show a discreet badge next to files designed for AI collaboration (CLAUDE.md, AGENTS.md, .cursor/rules, frontmatter audience: ai)."

4. Connect: when the setting is `false`, the badge component returns nothing.

### Validation criteria

- [ ] Badge renders next to AI-aware files in both themes
- [ ] Tooltip shows on hover with correct label
- [ ] Setting toggle hides/shows badges immediately
- [ ] Settings migration runs cleanly
- [ ] Visual consistency with DESIGN-PRINCIPLES (subtle, not noisy)
- [ ] **Matheo's smoke test**:
  1. Open a vault with multiple AI-aware files
  2. Verify each shows the badge in correct color
  3. Hover each badge — tooltip text correct
  4. Toggle setting off — badges disappear
  5. Toggle back on — badges return
  6. Switch theme — badge color follows accent correctly

### Expected commit

`feat(ai-ready): sidebar badge with Settings toggle`

---

## STEP 4 — Editor header chip

**Objective**: when an AI-aware file is open, show a chip in the editor header.

### Mission

1. Create `src/lib/components/AiAwareChip.svelte`:
   - Compact pill: icon + short label (e.g., "Claude project" / "Cursor rules" / "AI-targeted")
   - Padding `--space-2` × `--space-3`
   - Background: `color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-raised))`
   - Border: 1px `color-mix(in srgb, var(--color-accent) 24%, transparent)`
   - Text: `--color-text-primary`
   - Radius: `--radius-md`
   - Font: `--font-ui` at `--text-xs`
   - Non-interactive in v1 (no click handler, no menu)

2. Integrate into the editor header: chip appears next to the breadcrumb when `aiAwareStore.getForFile(activeFile) !== null`.

3. The chip respects the `highlightAiAware` setting (hidden when off).

### Validation criteria

- [ ] Chip renders correctly when opening an AI-aware file
- [ ] Chip disappears when switching to a non-AI-aware file
- [ ] Layout doesn't shift the breadcrumb awkwardly
- [ ] Respects the Settings toggle
- [ ] **Matheo's smoke test**: open and close several AI-aware files, verify chip behavior; compare to closing the file with another non-AI-aware one

### Expected commit

`feat(ai-ready): editor header chip for AI-aware files`

---

## STEP 5 — AI Context panel in sidebar

**Objective**: surface all AI-aware files of the current vault as a dedicated browsable section.

### Mission

1. Create `src/lib/components/AiContextPanel.svelte`:
   - A collapsible section in the sidebar
   - Position: below the file tree, above the status bar (exact location TBD with Matheo at kickoff)
   - Header: "AI Context" + count badge (e.g., "AI Context · 4")
   - Collapsed by default
   - When expanded: lists all AI-aware files in the current vault
   - Each item:
     - Category icon (small)
     - File name + relative path (path muted)
     - Click → opens the file
   - Empty state: "No AI-aware files in this vault" with a small hint link "Create CLAUDE.md" that creates the file with a minimal template

2. The panel reads from `aiAwareStore.getAllAiAware()` filtered to the current vault.

3. Respects `highlightAiAware` setting — when off, the panel is still visible (it's a deliberate user surface), but a small note appears in its header: "Badges are hidden in your settings."

### Validation criteria

- [ ] Panel renders correctly in both themes
- [ ] Collapse/expand persists per vault (similar pattern to file tree expanded folders)
- [ ] Click on item opens the corresponding file
- [ ] Count badge accurate
- [ ] Empty state displays correctly with working "Create CLAUDE.md" affordance
- [ ] **Matheo's smoke test**:
  1. Open a vault with several AI-aware files
  2. Expand the AI Context panel — verify list
  3. Click each — verify file opens
  4. Open an empty vault (or one without any AI-aware files)
  5. Trigger "Create CLAUDE.md" — verify file created with template, panel updates, file opens

### Expected commit

`feat(ai-ready): AI Context panel in sidebar`

---

## STEP 6 — Command palette commands

**Objective**: expose the AI-aware features through the command palette.

### Mission

Register three new commands in the registry (via PLAN-COMMAND-SYSTEM's pattern):

1. **`ai.show-aware-files`** — "Show AI-aware files in vault"
   - When activated: opens the command palette in File mode with results filtered to AI-aware files only
   - Equivalent to opening Cmd+P with a virtual filter applied

2. **`ai.copy-as-prompt`** — "Copy file as AI prompt"
   - When activated (with a file open): copies the file content to clipboard
   - Optionally with a minimal preamble (decide at kickoff with Matheo):
     ```
     # Source: <relative_path>
     # Type: <AI-aware category if applicable>
     
     <file content>
     ```
   - Visible only when `activeFile !== null`
   - Toast on success: "Copied as AI prompt"

3. **`ai.open-claude-md`** — "Open project CLAUDE.md"
   - When activated: if the current vault has a `CLAUDE.md` at the root, opens it
   - If not, creates one with a minimal template:
     ```markdown
     # CLAUDE.md
     
     > Instructions for Claude when working in this project.
     
     ## Context
     
     <describe your project>
     
     ## Conventions
     
     - <convention 1>
     - <convention 2>
     ```
   - Then opens the file

All three commands respect the existing command palette UX (fuzzy search by label, group "AI", etc.).

### Validation criteria

- [ ] Cmd+K shows all three commands with correct labels and group
- [ ] `ai.show-aware-files` filters the file list correctly
- [ ] `ai.copy-as-prompt` copies the correct content to clipboard (verify with paste into a text field)
- [ ] `ai.open-claude-md` creates or opens correctly
- [ ] Toast feedback works
- [ ] **Matheo's smoke test**: trigger each command from Cmd+K and verify behavior

### Expected commit

`feat(ai-ready): command palette integration`

---

## STEP 7 — Full audit + closure

**Objective**: end-to-end validation of the AI-ready feature.

### Mission

1. Walk through every detection case with real files:
   - `CLAUDE.md` at vault root → badge + chip + panel entry
   - `AGENTS.md` somewhere in the vault → same
   - `.cursor/rules.md` → same
   - A file with `audience: ai` in frontmatter → same
   - A file with `audience: [ai, human]` → same
   - A file with `audience: claude-code` → chip says "AI-targeted: claude-code"
   - A file without any of these → no badge, no chip, not in AI Context panel

2. Walk through all three commands and verify behavior in various states.

3. Test the Settings toggle in both states.

4. Verify accessibility:
   - Badge is identifiable to screen readers (proper `aria-label`)
   - Tooltip is keyboard-accessible
   - Panel is keyboard-navigable

5. Performance check on a large vault (1000+ files including several AI-aware): vault open time should not regress noticeably.

6. Documentation:
   - JOURNAL.md entry summarizing the chantier
   - DESIGN-PRINCIPLES.md — add a paragraph about "the AI-aware visual category" in §10 (Component-specific guidelines)
   - BACKLOG.md — close v1 items, add v2 candidates (AI-aware file diff history, MCP-style integrations, more agents)
   - README.md — short section "AI-ready: Markus recognizes the files you share with AI"

7. Final Matheo smoke test with all the above.

### Validation criteria

- [ ] Full matrix passes
- [ ] No leftover debug code
- [ ] Documentation updated
- [ ] Performance acceptable on large vaults
- [ ] Accessibility verified
- [ ] **Matheo's final smoke test**: signed off

### Expected commit

`chore(ai-ready): final audit and documentation`

---

## QUESTIONS ANTICIPATED

### "What if a user has many AI-aware files and the badges feel noisy?"

The Settings toggle handles this — they turn off badges, keep the AI Context panel for navigation. Two layers of opt-in: badges (default on, easy off) and the panel (always on, but collapsed by default).

### "What if a new AI tool emerges with a new convention?"

The detector module is a curated table. Adding a new pattern is a 2-line PR. Document the criteria for inclusion (significant adoption, clear naming convention, not vendor-specific marketing).

### "What if the file is AI-aware but the user wants to mark it as not-AI-aware?"

v1 has no override. The detection is automatic and not user-configurable per-file. If real usage shows this is needed, a `markus-ai-aware: false` frontmatter override could be added in v2.

### "Why not just send the file content to an LLM to detect the category?"

Frontmatter sovereignty. Detection must be deterministic, fast, and offline. Pattern-matching is sufficient — the conventions are deliberate, the files are named to be recognized.

### "What if Matheo wants to add 'AI-aware' to non-markdown files (e.g., `.cursorrules` plain text)?"

`.cursor/rules` is already covered (path-based). The detection module is generic — extending to non-.md files is straightforward if needed. But the editor only opens markdown, so showing badges on non-markdown files would be odd. Out of scope for v1.

### "What if a vault has 50+ AI-aware files?"

The AI Context panel scrolls. The Cmd+K `ai.show-aware-files` is the better entry point at that scale. Real usage will tell us whether to add filtering inside the panel.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-AI-READY.md.

Prerequisites:
- main is stable, no unresolved blocker
- PLAN-COMMAND-SYSTEM ✅ (the command palette is the entry point for the new AI commands in Step 6)
- PLAN-FRONTMATTER-UI ✅ (frontmatter parsing is shared with this plan)
- DESIGN-PRINCIPLES.md is your design source of truth

Read PLAN-AI-READY.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative for visuals
- NO LLM ANYWHERE in this plan. Detection is deterministic. Any AI call belongs in PLAN-AI-COMMANDS.
- Frontmatter sovereignty: files are never sent anywhere automatically.

Next step: STEP 1 — Detection module + tests.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```

---

## RELATIONSHIP TO OTHER PLANS

- **PLAN-FRONTMATTER-UI** parses frontmatter. This plan consumes the parsed frontmatter to detect `audience: ai`-style markers.
- **PLAN-COMMAND-SYSTEM** provides the command registry. This plan adds three commands to it (Step 6).
- **PLAN-SETTINGS** owns the settings schema. This plan extends it to v3 (Step 3 migration).
- **PLAN-AI-COMMANDS** (dropped) would have been the next plan in the AI series — the LLM-calling feature. Markus has decided against any LLM usage for now, so this plan deliberately stands alone: AI-READY is 100% deterministic, no LLM, ever.

---

## NOTES ON THIS PLAN

This is Markus's clearest 2026 differentiator. The technical work is small — pattern matching, badges, a panel, three commands. The product positioning impact is large — Markus becomes "the markdown editor that gets the AI era," and that positioning is currently unclaimed.

The temptation will be to add LLM features here. Resist. The whole point is to show that **AI-aware recognition does not require any AI call**. Detection is deterministic. The user keeps full control. The marketing line writes itself: "Markus recognizes your AI-collaboration files. It doesn't read them, doesn't send them, doesn't index them. It just respects them."
