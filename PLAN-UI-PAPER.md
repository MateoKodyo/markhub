---

---

# PLAN — UI ASSETS LIBRARY IN PAPER

> **Single objective**: produce a complete **asset library** of Markhub's UI inside Paper.design, ready to screencap for landing-page production. Every screen, modal, menu, popover, and atomic UI piece of the live app must exist as a faithful artboard inside one Paper file. Read at the start of every Claude Code session working on this plan.
> **Reference**: `DESIGN-PRINCIPLES.md` defines what the UI must look like. This plan reproduces the existing UI of Markhub, it does not redesign anything.

***

## CONTEXT

Markhub's UI is built in Svelte and runs in a Tauri shell. To produce a landing page that highlights the product's features, we need high-fidelity static visuals of every meaningful screen and component — not generic stock UI.

Two ways to get there: (a) screenshot the live app for every state, which is brittle and requires reproducing every state by hand each time; (b) reproduce the UI once inside Paper, where every artboard can be exported on demand at the right resolution, in the right state, with consistent backgrounds. Option (b) is what this plan delivers. Side benefit: the artboards become a stable design surface for future UI explorations.

***

## TOOL PROFILE — PAPER

Key facts that shape this plan:

* Paper is a **standalone desktop app**. It does not live in the IDE.
* Files are stored locally / in Paper's cloud; **not** in the project's Git repo.
* Paper exposes an **MCP server** that Claude Code connects to. Claude Code reads and modifies the open canvas through MCP tool calls.
* The canvas renders **real HTML/CSS**. Exports are PNG / SVG / "Copy as React" / HTML.
* **MCP server is local** (`http://127.0.0.1:29979/mcp`) — Paper Desktop must be running for the connection to succeed.
* Free tier limit: ~100 MCP calls per week. Plan accordingly; some steps will exceed this in a single session, so anticipate paid tier or weekly chunking.
* No native Git integration. The `.paper` file lives outside the repo.

### Output file convention

A single Paper file contains the whole asset library:

* `markhub-assets.paper` — the live working file containing every screen, modal, menu, and component as separate named artboards on a shared canvas.

Paper has no concept of branches, so explorations on top of this asset library happen in **duplicates**:

* `markhub-explo-<name>.paper` — duplicated from `markhub-assets.paper` when an exploration starts. Never modify the master.

***

## NON-NEGOTIABLE RULES

1. **Single Paper file**: everything lives in `markhub-assets.paper`. Each artboard is named explicitly (e.g. `chrome/sidebar`, `screen/empty-state`, `modal/confirm-delete`, `palette/cmd-k`).

2. **One step at a time**, no parallelization. Each step finishes with a gate.

3. **Mandatory wrap-up format** at the end of each step:

```text
═══════════════════════════════════════════════════
✅ STEP X COMPLETED (PAPER ASSETS)
═══════════════════════════════════════════════════

WHAT WAS DONE
[list of artboards added/updated]

ARTBOARD INVENTORY ON CANVAS NOW
[grouped list — palette, screens, modals, menus, components]

MCP CALLS USED THIS WEEK
[N / ~100 free tier]

⚠️ HOW MATHEO TESTS THIS LIVE ⚠️

OPEN PAPER:
1. Launch Paper desktop app
2. Open file: markhub-assets.paper
3. Locate artboard(s): [name(s)]

TEST PROCEDURE:
1. [action]
2. [expected visual vs Markhub running on localhost:1420]

COMPARISON WITH MARKHUB LIVE APP
[side-by-side notes: what matches, what doesn't]

DECISIONS MADE
[list]

⏸ AWAITING YOUR SMOKE TEST + VALIDATION BEFORE PROCEEDING.
```

4. **Mandatory smoke test by Matheo**: open Paper, compare against Markhub running on `localhost:1420`, validate.

5. **No hacking around**: if Paper's MCP can't do something cleanly, STOP and escalate. Do not fake the output.

6. **Brutal honesty**: if a step exceeds the MCP weekly budget or reveals a tool limitation, say so immediately. Track call count step by step.

7. **No design drift**: reproduce the live app as defined by `DESIGN-PRINCIPLES.md` and the Svelte components in `src/lib/components/`. No invention. If a measurement is unclear, take a screenshot of the live app and match visually.

8. **Token references everywhere**: artboard fills, text styles, spacing — bind to the variables defined in STEP 2. No raw hex outside of the variable definitions.

9. **Project-agnostic OBSERVER notes**: maintain `OBSERVER-NOTES.md` at the repo root in portable voice ("the user", "the project", "the codebase") so the future Paper-porting skill can be assembled from it directly. Update at the end of each STEP.

***

## PROGRESS TABLE

| Step                                                                                | Status | Output                                              | Matheo validation |
| ----------------------------------------------------------------------------------- | ------ | --------------------------------------------------- | ----------------- |
| 1. Setup + MCP connection                                                           | ⏳      | empty `markhub-assets.paper` open, MCP round-trip ✓ | —                 |
| 2. Design tokens import (variables only, no presentation artboard)                  | ⏳      | tokens visible in Paper variables panel             | —                 |
| 3. App chrome (sidebar + status bar + window controls + tabs bar)                   | ⏳      | `chrome/*` artboards                                | —                 |
| 4. Main screens (empty state + file view + settings)                                | ⏳      | `screen/*` artboards                                | —                 |
| 5. Overlays (Cmd+K palette + Cmd+P switcher + Cmd+Shift+F search + find-in-doc)     | ⏳      | `palette/*` artboards                               | —                 |
| 6. Modales et menus (ConfirmDialog + InputDialog + vault dropdown + sidebar ctxmenu) | ⏳      | `modal/*` and `menu/*` artboards                    | —                 |
| 7. Inline UI (frontmatter 4 modes + source/preview switch + toast + tabs detail)    | ⏳      | `inline/*` artboards                                | —                 |
| 8. BlockNote rendering showcase (code, table, headings, blockquote, lists, checkbox) | ⏳      | `editor/blocknote-showcase` artboard                | —                 |
| 9. Export pass (every artboard exported as PNG @2x ready for landing)                | ⏳      | `assets/exports/*.png` in repo                      | —                 |

***

## STEP 1 — Setup + MCP connection

**Objective**: Paper Desktop running, MCP server connected, Claude Code can round-trip read/write the canvas. Save behavior verified (auto vs manual).

### Mission

1. Verify Paper Desktop is installed and launched.
2. Verify Paper MCP entry exists in `claude mcp list` and is `✓ Connected`. If not, restart Claude Code session (the MCP connection is checked at session start; a server that wasn't reachable then stays "failed" until restart).
3. Create / open `markhub-assets.paper` in Paper Desktop.
4. From Claude Code, invoke `ToolSearch query="paper"` to load the Paper MCP tool schemas, then call a read tool (e.g. `get_basic_info` or `get_tree_summary`) — should return the empty file state.
5. Round-trip write test: create one test artboard via MCP → verify visually with Matheo → delete → confirm canvas matches initial state.
6. **Verify save behavior**: after the create + delete, check whether the `.paper` file on disk reflects the empty state automatically, or requires a manual save. Document in `OBSERVER-NOTES.md`.

### Validation criteria

* [ ] Paper Desktop running, file `markhub-assets.paper` open
* [ ] `claude mcp list` shows `paper: ✓ Connected`
* [ ] Paper MCP tool schemas accessible (ToolSearch returns `mcp__paper__*` results)
* [ ] Round-trip works (create → visible to Matheo → delete → gone)
* [ ] Save behavior documented (auto-save confirmed, OR manual-save discipline articulated)
* [ ] **Matheo's smoke test**: open Paper, see canvas in expected initial state

### Expected output

`markhub-assets.paper` — empty file, MCP round-trip validated.

***

## STEP 2 — Design tokens import (variables only)

**Objective**: import Markhub Dark theme tokens into Paper as Paper variables so all subsequent artboards reference them. **No presentation artboard** (lesson learned: the codebase remains the single source of truth for tokens; replicating them in a visual board is duplication without operational leverage).

### Mission

1. Read `src/styles/themes/markhub-dark.css` and `src/app.css` :root tokens.
2. Via the Paper MCP, define the equivalent Paper variables. Categories:
   * Colors (~22): bg, surfaces, borders, text, button, accent, status
   * Spacing (~10): space-0-5 .. space-9
   * Radius (~6): radius-xs .. radius-pill
   * Font sizes (~9): text-micro .. text-display
   * Line heights (~4): leading-tight .. leading-loose
   * Tracking (~5): tracking-display .. tracking-label
   * Font families (2): font-sans, font-mono
3. Variable names mirror CSS names exactly (`color-bg-raised`, `text-display`, `space-4`).

### Validation criteria

* [ ] All variable categories present in Paper's variables panel
* [ ] Variable names match CSS names exactly
* [ ] **Matheo's smoke test**: open Paper, browse the variables panel, eyeball that values match `markhub-dark.css`

### Expected output

`markhub-assets.paper` — tokens defined, no artboards yet.

***

## STEP 3 — App chrome

**Objective**: reproduce the persistent chrome that surrounds every Markhub screen.

### Mission

Source code: `src/lib/components/Sidebar.svelte`, `StatusBar.svelte`, `Tabs.svelte` and `src/routes/+page.svelte`.

Build artboards (each at the real app's window dimensions, 1440×900 or close):

1. `chrome/sidebar` — vault dropdown header, file list with rest/hover/active states, all using token bindings.
2. `chrome/status-bar` — pills, save indicator, content-width slider, theme toggle, download button.
3. `chrome/window-controls` — traffic-lights placeholder + Warp-style sidebar toggle button (per `PLAN-DESIGN-DEFAULTS.md` Step 7).
4. `chrome/tabs-bar` — tabs row showing 3-4 sample tabs with active state, close affordance, dirty indicator.

Use Paper's flex layout (real CSS) so each artboard behaves correctly when resized.

### Validation criteria

* [ ] Each chrome artboard matches the live app at 1:1 (Matheo eyeballs side-by-side)
* [ ] All tokens referenced (no raw hex outside the variable definitions)
* [ ] **Matheo's smoke test**: Paper next to Markhub `localhost:1420`; visual diff is minimal

### Expected output

4 `chrome/*` artboards on canvas.

***

## STEP 4 — Main screens

**Objective**: reproduce the three primary full-window screens.

### Mission

1. `screen/empty-state` — Cursor-style empty state per `PLAN-DESIGN-DEFAULTS.md` Step 6: top-left logo, 2×2 action grid (Open Vault / Create Vault / Open Recent / Open Settings or similar — match the actual live state), recent vaults list at the bottom.
2. `screen/file-view` — chrome + editor area populated with a realistic `.md` file: frontmatter `<details>` block (collapsed and one expanded variant), H1, intro paragraph, H2, paragraph with inline code, code block, list, blockquote, table. Mirror the BlockNote rendering exactly.
3. `screen/settings` — settings dialog frame opened on the Apparence panel (theme picker with 2 slots, Follow-system / Always-light / Always-dark mode selector, theme tiles for the 4 catalog themes).

### Validation criteria

* [ ] Each screen matches the live app at 1:1
* [ ] Screen artboards reuse the chrome artboards from STEP 3 (not redrawn from scratch — Paper components / instances if available, otherwise paste-and-bind)
* [ ] **Matheo's smoke test**: open the corresponding state in the live app, compare visually

### Expected output

3 `screen/*` artboards on canvas.

***

## STEP 5 — Overlays

**Objective**: reproduce every command surface and search overlay.

### Mission

1. `palette/cmd-k` — command palette opened via Cmd+K with a few sample results highlighted, accent left-border on the active row, footer shortcut hints.
2. `palette/cmd-p` — file switcher with sample file list, fuzzy match highlights.
3. `palette/cmd-shift-f` — vault search (ripgrep-backed) showing results grouped by file.
4. `palette/find-in-doc` — Cmd+F find-in-document bar, with match counter and next/previous arrows.

Each overlay rendered on top of a dimmed file-view background (use the screen/file-view artboard as background, dimmed by a backdrop layer).

### Validation criteria

* [ ] Each overlay matches the live app at 1:1
* [ ] Backdrop alpha matches `--color-backdrop` (the modal backdrop token)
* [ ] **Matheo's smoke test**: open each overlay in the live app, compare

### Expected output

4 `palette/*` artboards on canvas.

***

## STEP 6 — Modales et menus

**Objective**: reproduce every modal dialog and contextual menu.

### Mission

1. `modal/confirm-delete` — `ConfirmDialog` with destructive header (`--color-danger-bg`), title, message, Cancel + Delete buttons.
2. `modal/input-dialog` — `InputDialog` for "create a new file" / "rename" — input field with focus state, Cancel + Create buttons.
3. `menu/vault-dropdown` — sidebar header dropdown listing the active vault + recents + "Open another vault…".
4. `menu/sidebar-context-menu` — right-click context menu on a file (Open / Rename / Duplicate / Reveal in Finder / Export… / Delete) and on a folder.
5. `menu/theme-picker-tile` — single theme tile detail (used in Settings) showing the picker affordance.

### Validation criteria

* [ ] Each modal/menu matches the live app at 1:1
* [ ] Modal backdrops, menu shadows match design tokens (`--shadow-popover`, `--color-backdrop`)
* [ ] **Matheo's smoke test**: trigger each in the live app, compare

### Expected output

5 `modal/*` and `menu/*` artboards on canvas.

***

## STEP 7 — Inline UI

**Objective**: reproduce the in-place UI elements that appear inside the editor area or floating in the chrome.

### Mission

1. `inline/frontmatter-collapsed` — read mode summary line.
2. `inline/frontmatter-structured-edit` — typed controls (date picker, tags chips, toggle, number stepper).
3. `inline/frontmatter-raw-yaml` — Monaco/CodeMirror-style raw YAML editor with validation state.
4. `inline/source-preview-switch` — toggle in the top-right of the editor area.
5. `inline/toast-success` and `inline/toast-error` — toast variants, positioned bottom-right.
6. `inline/tabs-detail` — single tab (rest, hover, active, dirty) close-up.

### Validation criteria

* [ ] Each inline element matches the live app at 1:1
* [ ] **Matheo's smoke test**: trigger each state in the live app

### Expected output

~6 `inline/*` artboards on canvas.

***

## STEP 8 — BlockNote rendering showcase

**Objective**: a single tall artboard showing every BlockNote rendering style with negative letter-spacing on headings, code block style, table style, etc. — useful for "Markhub renders Markdown beautifully" landing copy.

### Mission

`editor/blocknote-showcase` — one artboard containing in vertical sequence:

* H1, H2, H3, H4, H5, H6 with their token bindings
* Body paragraph with inline code, **bold**, *italic*, ~~strike~~, [link]
* Unordered list, ordered list, checklist with checked + unchecked items
* Blockquote
* Code block (mono font, raised surface, language label)
* Table (2-3 rows, header)
* Horizontal rule

### Validation criteria

* [ ] Every BlockNote rendering present
* [ ] Negative letter-spacing on headings respects `DESIGN-PRINCIPLES.md` §3
* [ ] **Matheo's smoke test**: open a `.md` file in the live app containing every block type, compare

### Expected output

1 `editor/blocknote-showcase` artboard.

***

## STEP 9 — Export pass

**Objective**: produce ready-to-use PNG exports of every artboard for the landing page.

### Mission

1. For each artboard, export as PNG @2x via Paper MCP `export` tool (or whatever Paper exposes for batch export).
2. Save to `assets/exports/` in the repo with the same naming convention as the artboards (e.g. `chrome-sidebar.png`, `screen-empty-state.png`).
3. Commit the PNGs in a single commit on `main` (or a dedicated branch if Matheo prefers).

### Validation criteria

* [ ] All artboards exported, no missing pieces
* [ ] PNG resolution sufficient for landing-page hero shots (2880px wide for a 1440px artboard at @2x)
* [ ] **Matheo's smoke test**: opens a few exports, confirms they look right at landing-page resolution

### Expected output

`assets/exports/*.png` set in the repo.

***

## STARTUP PROMPT FOR CLAUDE CODE

```text
You're starting work on PLAN-UI-PAPER.md.

Read PLAN-UI-PAPER.md, DESIGN-PRINCIPLES.md, and OBSERVER-NOTES.md (if it exists) BEFORE any action.

Main rules:
- One step at a time
- Mandatory wrap-up format at end of step
- Mandatory interactive smoke test by Matheo before advancing
- No design invention: reproduce the live app as defined by DESIGN-PRINCIPLES.md and src/lib/components/
- ~100 MCP calls per week limit on free tier — track call count step by step
- Maintain OBSERVER-NOTES.md in project-agnostic voice for the future shareable skill
- End-of-chantier deliverable: skills audit and consolidation (paper-mirror custom vs paper-desktop:* officials) — see project_paper_chantier memory

Identify the first non-✅ step in the progress table. Confirm setup state (Paper Desktop running, MCP connected), then propose your attack plan for that step and wait for GO before coding.
```
