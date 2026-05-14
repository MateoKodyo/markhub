# PLAN — FRONTMATTER UI

> **Single objective**: deliver a polished, dedicated UI block for YAML frontmatter at the top of every markdown file, with a clean read mode and a dedicated edit mode.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: PLAN-DESIGN-DEFAULTS must be ✅ complete (this plan consumes the design tokens).
> **Reference**: `DESIGN-PRINCIPLES.md` governs the visual treatment.
> **Scope reminder**: this plan is **only about the UI of the frontmatter block**. Parsing uses `js-yaml`. No vault linting, no LLM, no auto-cleaning of malformed YAML.

---

## CONTEXT

Frontmatter in Markhub is currently rendered as a raw `<details>` HTML block above the BlockNote editor (decision recorded in PLAN-BLOCKNOTE §4: the native Svelte `<details>` above the editor remains unchanged during the migration). That was a migration-era compromise.

This plan replaces that placeholder with a proper UI block: a quiet, beautifully rendered read view by default, and a dedicated edit mode when the user wants to modify metadata. The block sits **outside** the BlockNote editor surface — BlockNote only sees the markdown body, the frontmatter is handled at the `Editor.svelte` level.

The bet: frontmatter is one of the most-touched surfaces in any structured markdown workflow (tags, status, dates, links). Making it feel premium changes how Markhub feels overall.

---

## NON-NEGOTIABLE RULES

Same operating rules as the previous plans.

1. **Dedicated branch**: `feat/frontmatter-ui`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step (test URL, procedure, what's visible)
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**: if a parsing edge case appears, STOP and escalate
6. **Brutal honesty** on scope and blockers
7. **Deterministic only**: parsing via `js-yaml`, validation via typed schema. No AI in this plan, anywhere.
8. **No new features beyond this plan's scope**: no vault-wide linting, no tag autocomplete from the whole vault, no "Quick add note" sidebar. Those are separate plans.

---

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN — v1

- A dedicated `FrontmatterBlock.svelte` component rendered above the BlockNote editor
- **Read mode** (default): values displayed as styled rows, not raw YAML. Compact, scannable, premium-feeling.
- **Edit mode** (toggled): the user explicitly enters edit mode to modify values
- Two edit sub-modes inside edit mode:
  - **Structured edit** (default): field-by-field editing with type-aware controls (text input, date picker, tag chips)
  - **Raw YAML edit** (advanced fallback): a monospace textarea with the raw YAML, for cases the structured view can't handle
- Round-trip integrity: anything the user can edit, when saved, produces valid YAML that round-trips correctly with the existing `splitFrontmatter` / `joinFrontmatter` pipeline
- Collapsible block (collapsed/expanded state persists per file)
- Visual treatment per DESIGN-PRINCIPLES.md (raised surface, subtle border, comfortable density)
- Common field types recognized with typed rendering:
  - `string` (title-like fields)
  - `date` / `datetime` (rendered as date pickers in edit mode)
  - `array of strings` (rendered as tag chips)
  - `boolean` (rendered as toggle)
  - `number`
  - Fallback: anything else falls through to raw text input

### OUT — Reported to a future plan or v2

- **Schema definition per vault** (e.g., `.markhub/frontmatter-schema.yml` to declare required fields per file type). Decision: in v1, schema is **inferred** from existing keys, not declared. A schema feature is a separate plan if it ever happens.
- **Tag autocomplete from the whole vault**: would require a vault-wide tag index. Out of scope here. Tags in v1 are just chips of free strings, with autocomplete only against tags already present in the current file.
- **Frontmatter templates** ("New note with template X"): separate concern.
- **Wikilinks / backlinks inside frontmatter values**: explicit no for v1. Markhub does not adopt Obsidian-isms by default.
- **Bulk frontmatter operations across files**: separate plan if ever.
- **Validation against external schemas** (JSON Schema, OpenAPI, etc.): no.
- **Custom field types beyond the six listed above**: anything exotic falls back to raw text.

### OUT — Permanent

- AI-assisted frontmatter cleanup (souveraineté — frontmatter must stay 100% local)
- Auto-generation of frontmatter values
- Hidden / proprietary frontmatter fields invisible to other markdown tools

---

## ARCHITECTURE OVERVIEW

### Data flow

The existing `splitFrontmatter(content) → { frontmatter, body }` and `joinFrontmatter({ frontmatter, body }) → content` helpers (already in place per PLAN-BLOCKNOTE §4) remain the contract.

`FrontmatterBlock.svelte` receives `frontmatter` as a parsed object (from `js-yaml.load`) and emits an updated object on every change. `Editor.svelte` joins it back with the body before writing to disk. The autosave debounce (1500ms by default, configurable per PLAN-SETTINGS) applies as before.

### Parsing

`js-yaml` is the only parser. Two helpers in `src/lib/frontmatter/parser.ts`:

- `parseFrontmatter(yaml: string): { ok: true, data: object } | { ok: false, error: string, raw: string }`
- `serializeFrontmatter(data: object): string`

The parser is **non-destructive on error**: if the YAML is malformed, the read mode shows an error banner with the raw YAML and a single button "Edit raw YAML" that opens the raw edit sub-mode. The user fixes it manually. No "auto-fix" attempts.

### Type inference

In read mode and structured edit mode, each value's type is inferred from its JS type after parsing:

- `string` → text row (or date row if it matches an ISO date pattern)
- `number` → number row
- `boolean` → toggle row
- `Array<string>` → chip row
- `Array<anything else>` → falls back to raw text representation, edit forces raw mode
- `object` (nested) → falls back to raw mode (v1 does not support nested structured editing)

Inference is **per-key**, not globally. A frontmatter with `title: "Hello"` and `published: true` produces two distinct row types.

### State model

A single Svelte store `frontmatterStore` (scoped to the open file) holds:

```typescript
interface FrontmatterState {
  data: Record<string, unknown>;     // the current parsed frontmatter
  mode: 'read' | 'edit-structured' | 'edit-raw';
  collapsed: boolean;                 // per-file, persisted
  parseError: string | null;          // null when the YAML is valid
  dirty: boolean;                     // unsaved changes flag (the autosave already handles disk)
}
```

The store is replaced wholesale when a different file is opened.

### Persistence of collapsed state

Per-file collapsed state lives in a small map persisted to disk alongside the file's editor state (cursor position, scroll position — if those exist already). If not, a separate JSON map keyed by file path under the Tauri app config dir.

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Parser + store foundation | ✅ | `aa93a83` (bundled) | 2026-05-13 |
| 2. Read mode (default rendering) | ✅ | `aa93a83` (bundled) | 2026-05-13 |
| 3. Structured edit mode | ✅ | `aa93a83` (bundled) | 2026-05-13 |
| 4. Raw YAML edit mode | ✅ | `650fb68` | 2026-05-14 |
| 5. Type-specific controls (date, tags, toggle) | ✅ | `af51767` | 2026-05-14 |
| 6. Collapsed state + persistence | ✅ | `0a07bb8` | 2026-05-14 |
| 7. Visual polish + DESIGN-PRINCIPLES alignment | ✅ | next commit | 2026-05-14 |
| 8. Closure | ✅ | this commit | 2026-05-14 |

---

## STEP 1 — Parser + store foundation

**Objective**: build the data layer. No visible UI change yet — the existing `<details>` block stays in place.

### Mission

1. Create `src/lib/frontmatter/parser.ts` with:
   - `parseFrontmatter(yaml: string)` returning a discriminated union
   - `serializeFrontmatter(data: object)` returning a YAML string
   - Both fully unit-tested (round-trip, malformed input, edge cases: empty frontmatter, multi-line strings, arrays, nested objects)
2. Create `src/lib/stores/frontmatter.ts`:
   - Svelte writable store wrapping `FrontmatterState`
   - Action functions: `setMode(mode)`, `setData(data)`, `setCollapsed(bool)`
   - On `setData`: re-serialize, validate round-trip, emit the new YAML to `Editor.svelte`
3. `Editor.svelte` consumes the store but **does not yet render the new block** — it continues to render the existing `<details>` placeholder. This is plumbing only.

### Validation criteria

- [ ] Unit tests for parser: ≥10 cases, all green
- [ ] Unit tests for store contract
- [ ] `svelte-check`: 0 errors
- [ ] No visible change in the app (existing `<details>` still renders)
- [ ] **Matheo's smoke test**: open several files with varied frontmatter, verify nothing visible has broken. Check the dev console: the store should populate on file open.

### Expected commit

`feat(frontmatter): parser and store foundation`

---

## STEP 2 — Read mode (default rendering)

**Objective**: replace the `<details>` placeholder with the new read-mode rendering.

### Mission

1. Create `src/lib/components/FrontmatterBlock.svelte`
2. In read mode, render a clean rows layout:
   - Each row: key on the left (secondary text color, fixed-width column ~120px), value on the right (primary text color)
   - All values rendered as text in v1 (typed rendering comes in Step 5)
   - Block container: `--color-bg-raised`, `--radius-lg`, subtle 1px border, padding `--space-4`
   - Top-right of the block: a small "Edit" icon button (pencil from Lucide), opens structured edit mode
3. Empty state: if the file has no frontmatter, show an empty placeholder with "Add frontmatter" affordance (clicking starts a new empty frontmatter in edit mode)
4. Error state: if the YAML is malformed, show a red-tinted banner with the raw YAML and an "Edit raw YAML" button (which jumps to Step 4's mode once it exists; until then, the button is wired but does nothing)
5. Replace the old `<details>` block in `Editor.svelte` with `FrontmatterBlock.svelte`

### Validation criteria

- [ ] Read mode renders correctly in light and dark themes
- [ ] Files with frontmatter show the new block instead of the old `<details>`
- [ ] Files without frontmatter show the empty state
- [ ] A deliberately malformed YAML (e.g., bad indentation) shows the error banner without crashing
- [ ] **Matheo's smoke test**: open files of each kind (with frontmatter, without, with malformed YAML), verify each renders correctly

### Expected commit

`feat(frontmatter): read mode with rows rendering`

---

## STEP 3 — Structured edit mode

**Objective**: implement the structured edit sub-mode with plain text inputs for every field. Type-specific controls come in Step 5.

### Mission

1. In `FrontmatterBlock.svelte`, when `mode === 'edit-structured'`:
   - Each row becomes editable: the value column is replaced with a text input
   - Key is editable too (single click on the key turns it into an input)
   - At the bottom of the list: a "+ Add field" button that adds a new empty row
   - Each row has a "✕" button on the right to delete the field (with a small undo affordance? — decision in step kickoff)
2. Edit mode header (top-right of the block):
   - "Done" primary button (returns to read mode)
   - "Switch to raw YAML" secondary button (jumps to raw edit, Step 4)
   - "Cancel" tertiary button (reverts changes since entering edit mode)
3. Changes in edit mode update the store on every keystroke (debounced 200ms to avoid thrashing). The save-to-disk autosave is unchanged — it picks up the changes from the store like any other content change.
4. Validation: if a key collides with an existing one, show inline error and prevent save
5. Empty values: empty string is allowed; the key remains in the frontmatter with an empty value

### Validation criteria

- [ ] Click "Edit" icon → block switches to edit mode
- [ ] Each row editable, can rename key and value
- [ ] Add field works
- [ ] Delete field works
- [ ] Cancel reverts changes
- [ ] Done returns to read mode
- [ ] Autosave fires correctly when in edit mode
- [ ] Disk file reflects changes (verify with external editor)
- [ ] **Matheo's smoke test**: full flow — open file, edit several fields, add a new field, delete one, save (Done), verify the on-disk file matches expectations

### Expected commit

`feat(frontmatter): structured edit mode`

---

## STEP 4 — Raw YAML edit mode

**Objective**: implement the raw edit fallback for advanced cases and malformed YAML.

### Mission

1. When `mode === 'edit-raw'`:
   - The block content is replaced with a `<textarea>` (or CodeMirror minimal mode if it integrates cleanly) showing the raw YAML
   - Monospace font (`--font-mono`), appropriate height, internal scroll if long
   - Live validation: as the user types, parse the YAML; if invalid, show a red border + error message below the textarea
2. Header buttons in raw mode:
   - "Done" → parse; if valid, switch to read mode and update store; if invalid, prevent leaving raw mode (show error)
   - "Switch to structured" → parse; if valid, switch to structured edit; if invalid, prevent
   - "Cancel" → revert
3. Entry points to raw mode:
   - From structured edit: the "Switch to raw YAML" button
   - From read mode error banner: the "Edit raw YAML" button (now functional)
   - Optionally: from read mode, a small "Raw" link in the edit menu (TBD)

### Validation criteria

- [ ] Raw mode shows accurate YAML, monospace, editable
- [ ] Live validation visible (red border + message)
- [ ] Done is blocked while YAML is invalid
- [ ] Successful Done updates the store and returns to read mode
- [ ] Switching back to structured edit works when YAML is valid
- [ ] **Matheo's smoke test**: enter raw mode, deliberately break the YAML (e.g., bad indentation), verify error message; fix it, verify Done becomes available; switch to structured mode, verify the fields match

### Expected commit

`feat(frontmatter): raw YAML edit mode`

---

## STEP 5 — Type-specific controls (date, tags, toggle)

**Objective**: enhance the structured edit mode with typed controls for the four common cases.

### Mission

In structured edit mode, render value controls based on inferred type:

1. **Dates** (`string` matching ISO date pattern, OR `Date` after parse):
   - Date picker control (native `<input type="date">` is acceptable in v1 — it's enough and looks fine with the right CSS)
   - Displayed in read mode as a formatted date ("12 May 2026" or similar, per locale)
2. **Tags / arrays of strings**:
   - Rendered as a row of chip components
   - Each chip: rounded, subtle background, small "✕" to remove
   - At the end of the chips: a small input to add a new tag (Enter or comma to confirm)
   - Autocomplete suggestions: **only from tags already present in the current file's frontmatter**. No vault-wide indexing in v1.
3. **Booleans**:
   - Rendered as a toggle switch
   - Read mode displays as "yes / no" text or a small icon
4. **Numbers**:
   - Rendered as `<input type="number">`
5. **Everything else (objects, mixed arrays, multi-line strings)**:
   - Read mode shows a placeholder text "(complex value — switch to raw to edit)"
   - Structured edit disables that field with a tooltip "Edit in raw YAML"

### Validation criteria

- [ ] Dates render with a date picker in edit mode
- [ ] Tag chips render correctly, can be added and removed
- [ ] Toggles work for booleans
- [ ] Numbers behave as numbers (preserved as numbers, not strings, in the serialized YAML)
- [ ] Complex values fall back gracefully to a "raw only" affordance
- [ ] **Matheo's smoke test**: create a test file with a date, a tag array, a boolean, a number, and an object; verify each renders correctly in both read and edit modes

### Expected commit

`feat(frontmatter): typed controls for date, tags, boolean, number`

---

## STEP 6 — Collapsed state + persistence

**Objective**: implement the collapse/expand affordance and persist the collapsed state per file.

### Mission

1. Add a chevron icon in the top-left of the block
2. Click toggles between expanded (full block visible) and collapsed (only a compact summary visible)
3. Collapsed summary: one line showing key field count and tags (e.g., "5 fields · 3 tags") — exact format TBD with Matheo at kickoff
4. Persistence:
   - Per-file state, keyed by absolute file path
   - Stored in a small JSON file in the Tauri app config dir (`frontmatter-state.json`)
   - Loaded on app start, written on every state change (debounced)
5. Default for new files: expanded

### Validation criteria

- [ ] Toggle works, smooth transition (`--duration-base`)
- [ ] Collapsed state persists across file changes within a session
- [ ] Collapsed state persists across app restarts
- [ ] No impact on other files' states
- [ ] **Matheo's smoke test**: collapse a file's frontmatter, switch to another file, return to the first → still collapsed; restart the app → still collapsed

### Expected commit

`feat(frontmatter): collapsed state with per-file persistence`

---

## STEP 7 — Visual polish + DESIGN-PRINCIPLES alignment

**Objective**: full visual pass to ensure the block feels premium and aligns with DESIGN-PRINCIPLES.md.

### Mission

1. Review every visual aspect of the block:
   - Spacing (`--space-*` tokens, 4px grid)
   - Radius (`--radius-lg` for the block, `--radius-md` for chips and buttons)
   - Borders (1px `--color-border`)
   - Shadow (none in v1 — the block is inset, not floating)
   - Typography (UI font for keys, primary text color for values)
   - Hover and focus states on all interactive elements (Edit button, chips, inputs)
   - Transitions (`--duration-base`, `--easing-standard`)
2. Light and dark theme parity check
3. Make sure the block feels **quiet by default** — no visual noise in read mode. The block should disappear from attention until the user wants to interact with it.
4. Playwright visual baselines: read mode, structured edit, raw edit, collapsed, with frontmatter, without frontmatter, malformed YAML state — both themes

### Validation criteria

- [ ] Every interactive element has a smooth hover state
- [ ] Focus rings visible and accent-colored
- [ ] Spacing rhythm consistent
- [ ] Light/dark parity confirmed
- [ ] Playwright baselines captured
- [ ] **Matheo's final smoke test**: guided tour of every state, signing off on the feel

### Expected commit

`feat(frontmatter): visual polish and Playwright baselines`

---

## STEP 8 — Closure

- [ ] Final wrap-up sent to Matheo
- [ ] PLAN-FRONTMATTER-UI.md updated: all steps ✅
- [ ] List of commits and decisions
- [ ] DESIGN-PRINCIPLES.md updated if any new principle emerged (e.g., "quiet-by-default principle for metadata surfaces")
- [ ] BACKLOG.md updated with v2 candidates (vault-wide tag autocomplete, schema definition, templates)
- [ ] **Manual merge to main by Matheo, not by Claude Code**

---

## QUESTIONS ANTICIPATED

### "What if the user types something invalid in the structured editor (e.g., text in a number field)?"

The native `<input type="number">` handles this. For dates, the date picker handles this. For tags, every chip is a valid string. The structured editor cannot produce invalid YAML by construction.

### "What if the frontmatter is malformed when the file is opened?"

Step 2 covers this: the block shows a clear error banner with the raw YAML and a button to fix it manually in raw mode. No automatic recovery, no LLM, no guessing. The user sees the problem and fixes it themselves.

### "What if Matheo wants tag autocomplete from the whole vault?"

That's a v2 candidate. It requires a vault-wide tag index, which is a separate concern (closer to PLAN-VAULT-HEALTH territory). Note in BACKLOG.md.

### "What if a user wants to define required fields per file type?"

Schema definition is out of scope for v1. Note in BACKLOG.md. v1 infers types per-key, doesn't enforce a schema.

### "What if the structured editor renders weirdly for a deeply nested object?"

Step 5's "complex value fallback" handles this. The user is told to use raw mode for that field. v1 does not support nested structured editing.

### "What if the user wants to undo a delete-field action?"

v1 has no field-level undo. The "Cancel" button reverts all changes since entering edit mode. Field-level undo can be a v2 ergonomics improvement if real usage shows it's needed.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-FRONTMATTER-UI.md.

Prerequisites:
- PLAN-BLOCKNOTE must be ✅ fully complete
- PLAN-DESIGN-DEFAULTS must be ✅ fully complete
- DESIGN-PRINCIPLES.md is your design source of truth

Read PLAN-FRONTMATTER-UI.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative for visuals
- No AI anywhere in this plan. Parsing is js-yaml only.
- Scope is locked. No vault-wide indexing, no schema declaration, no templates.

Next step: STEP 1 — Parser + store foundation.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```

---

## NOTES ON THIS PLAN

This is a UI plan, not an infrastructure plan. The parsing layer is small and well-bounded (`js-yaml` does the heavy lifting). The interest is in making the **read mode quiet** and the **edit mode comfortable** — those are the bets.

The "quiet by default" principle is worth elevating to DESIGN-PRINCIPLES.md after this plan ships, if real usage confirms it. Metadata surfaces should disappear from attention when they're not being interacted with.
