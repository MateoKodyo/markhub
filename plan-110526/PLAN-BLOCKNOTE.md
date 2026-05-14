# PLAN BLOCKNOTE — NON-NEGOTIABLE

> **Single objective:** fully integrate BlockNote into Markhub, replacing Crepe.
> Must be read at the start of every Claude Code session.
> **No drift allowed.** No "small extra thing in passing." No other features.
>
> **REVISION 2026-05-10 (end of day)**: the switch of `Editor.svelte` happens NOW, BEFORE the remaining UI components. See §"Revised Strategy" below.
>
> **REVISION 2026-05-10 (evening)**: two UI adjustments integrated into Step 4:
> 1. **Removal** of the floating formatting toolbar (redundant with BlockNote natives)
> 2. **Relocation** of the Preview/Source switch from the status bar to the top-right of the editor area
> The source mode IS kept in MVP (the component already exists, only its control moves).

---

## CONTEXT — WHY THIS PLAN EXISTS

On 10 May 2026, Matheo spent a full day trying to understand the state of the BlockNote migration. Diagnosis: Claude Code was shipping BlockNote code on a test route `/_blocknote-test` without clearly stating that the main app was still running on Crepe. Several hours of misunderstanding.

**Root cause**: insufficient communication from Claude Code after each delivery.

**This plan fixes that**: non-negotiable communication rule, mandatory interactive smoke test at each step with exact URL provided.

---

## REVISED STRATEGY (2026-05-10)

### Why the revision

The initial plan was:
```
2.5.a Slash → 2.5.b Toolbar → 2.5.c SideMenu → 2.5.d Tables → 2.5.e Links → 3 Polish → 4 SWITCH → 5 Cleanup
```

With this plan, the main app would have stayed on Crepe for 5 more steps, which becomes psychologically unsustainable and prevents any real-world testing.

### Revised strategy

```
2.5.a ✅ → 2.5.b ✅ (will be removed in Step 4) → 4 SWITCH (anticipated) → 2.5.c → 2.5.d → 2.5.e → 3 Polish → 5 Cleanup
```

**We switch `Editor.svelte` to BlockNote NOW**, with the slash menu already delivered. The formatting toolbar delivered in 2.5.b is **removed during the switch** (decision made evening of 10 May: redundant with BlockNote). Remaining components (drag handle, tables, link toolbar) will be written **directly in the main app** after the switch.

### What this implies

**During the intermediate phase (between the switch and the end of UI components)**:
- The main app uses BlockNote
- The slash menu works (type `/`)
- **No floating formatting toolbar**: formatting goes through slash menu, native markdown shortcuts (`**bold**`, `# h1`), and keyboard shortcuts
- BlockNote's native drag-drop should work (to be verified at smoke test)
- Block transformations via `⋮⋮` click are not yet custom (slash menu remains accessible)
- Tables: native drag works but no custom `+` / resize buttons
- Links: created via keyboard shortcut or slash menu, no dedicated toolbar
- **Preview/Source switch moved to the top-right** of the editor area (relocated from status bar)

**This is intentionally degraded**, but the app works and can be tested in real conditions.

### Benefits of the revision

1. **Immediate real-world testing**: BlockNote runs on actual files, not a fixture
2. **Early blocker detection**: if BlockNote has a fundamental issue on real files, it surfaces now, not 4 steps later
3. **Reduced cognitive fatigue**: subsequent deliveries are visible in the main app
4. **Continuous validation**: each UI component added improves the experience tangibly

### Accepted risks

- The app is temporarily less functional than with full Crepe
- If we need to roll back, it's more visible (but still technically possible: Crepe remains installed until Step 5)

---

## SINGLE OBJECTIVE

Replace Crepe with BlockNote in `Editor.svelte`, with the required Svelte UI components, visual polish, and complete Crepe cleanup.

**No other workstream starts until this is complete.**

Explicit list of workstreams **SUSPENDED** until end of migration:
- Toast system
- Sidebar drag-drop
- File tabs
- Cursor-style empty state
- Warp-style sidebar close button
- Command palette (Cmd+K / Cmd+P / Cmd+Shift+F)
- Settings page
- Outline / table of contents
- Any other polish or new feature

---

## NON-NEGOTIABLE RULES

### Rule 1 — Dedicated branch
The entire migration lives on the `feat/blocknote-migration` branch. No merge to `main` before Matheo's final validation.

### Rule 2 — One step at a time
Only one step is in progress at any time. No parallelization. No "I also did X in passing."

### Rule 3 — Mandatory communication at each delivery

At the end of every step, the wrap-up MUST include:

```
═══════════════════════════════════════════════════
✅ STEP X COMPLETED
═══════════════════════════════════════════════════

WHAT WAS DONE
[list]

AUTOMATED TESTS
[results]

⚠️ HOW MATHEO TESTS THIS LIVE ⚠️

EXACT URL:
http://localhost:[PORT]/[route]

TEST PROCEDURE:
1. [action 1]
2. [action 2]
3. [expected result]

WHAT IS VISIBLE TO THE USER IN THE MAIN APP:
[either "nothing yet" — or "feature X visible"]

MODIFIED FILES
[list]

DECISIONS MADE
[list]

⏸ AWAITING YOUR SMOKE TEST + VALIDATION BEFORE PROCEEDING.
```

**If this wrap-up is incomplete, Matheo asks for the missing info. No advancing.**

### Rule 4 — Mandatory interactive smoke test
No step is validated until Matheo has tested it live and confirmed. Green automated tests alone are not enough.

### Rule 5 — No hacking around
If a BlockNote feature doesn't work as expected, **STOP** and escalate to Matheo. No custom patches on top, no workarounds, no "I'll just code that by hand."

### Rule 6 — Brutal honesty
If at any point Claude Code sees that a step is going to exceed its scope, or discovers a blocker, **it says so immediately** without sugar-coating. No empty "progressing well, moving forward" phrases.

### Rule 7 — No new debt during migration
No new Crepe CSS patches. No new Crepe features. Crepe is in zero-maintenance mode for the entire migration.

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Install | ✅ | `abccc90` | ✅ |
| 2. Markdown round-trip | ✅ | `64f6482` | ✅ |
| 2.5.a Svelte slash menu | ✅ | `9256f57` | ⏸ smoke test pending |
| 2.5.b Svelte formatting toolbar | ✅ (to be removed in Step 4) | `c8587d7` | ⏸ obsolete — removal in Step 4 |
| **4. Editor.svelte SWITCH (anticipated)** | **⏳ NEXT STEP** | — | — |
| 2.5.c Side menu (drag handle + transform) | ⏳ | — | — |
| 2.5.d Table handles | ⏳ | — | — |
| 2.5.e Link toolbar | ⏳ | — | — |
| 3. Markhub CSS polish | ⏳ | — | — |
| 5. Crepe cleanup | ⏳ | — | — |
| 6. Closure | ⏳ | — | — |

---

## STEP 4 — Editor.svelte SWITCH (NEXT STEP — TOP PRIORITY)

**Objective**: replace Crepe with BlockNote in `Editor.svelte`. After this step, **the main app uses BlockNote**.

### Mission

Modify `src/lib/components/Editor.svelte`:

1. **Remove the import** of `@milkdown/crepe` (but do NOT uninstall the package — cleanup in Step 5)
2. **Import**:
   - `BlockNoteEditor` from `@blocknote/core`
   - Required BlockNote CSS
   - The Svelte UI component already created:
     - `BlockNoteSlashMenu.svelte`
   - **DO NOT import** `BlockNoteFormattingToolbar.svelte` — it is being removed in this step (see "UI adjustments" below)
3. **Preserve the public API**:
   - Props: `content`, `mode`, `readonly`
   - Change event for debounced autosave
4. **Adapt frontmatter handling**:
   - Continue using `splitFrontmatter` / `joinFrontmatter` as pre/post-processing
   - BlockNote only sees the markdown body, not the YAML frontmatter
   - The native Svelte `<details>` above the editor remains unchanged
5. **Adapt saving**:
   - Subscribe to BlockNote's `editor.onChange`
   - Convert blocks → markdown via `blocksToMarkdownLossy()`
   - Append frontmatter via `joinFrontmatter` before writing to disk
   - Maintain the 1500ms debounce (store logic unchanged)
6. **Initialization**:
   - On mount: `tryParseMarkdownToBlocks(body)` to load content
   - On file change: re-create the editor or reset content
7. **Preview/Source mode** (REVISED 2026-05-10 evening):
   - The existing Preview/Source switch is **moved** from the status bar to the **top-right of the editor area**
   - The source mode continues to work as it does now (existing component, no rebuild)
   - The status bar **loses** this switch (cleanup required)
   - **No duplication**: the switch exists in a single location, just at a new position
8. **Keep the DOM structure**:
   - Full-width header with breadcrumb path
   - Centered max-width container (1280px or whatever was previously in place)
   - No modification to the status bar pills (other than removing the Preview/Source switch from it)

### UI adjustments integrated into Step 4

Two visual adjustments are part of this step's scope:

#### 1. Removal of the floating formatting toolbar (B I H1 H2 H3 link)

- The `BlockNoteFormattingToolbar.svelte` component is **deleted**
- Its wiring in `Editor.svelte` (the `formattingToolbar` extension store subscription) is **removed**
- Tests covering this component are **deleted** or adapted
- **Rationale**: redundant with BlockNote's native mechanics (slash menu, markdown shortcuts like `**bold**` and `# h1`, keyboard shortcuts)
- **Note**: Step 2.5.b delivered this component; its removal here is an assumed decision, not a failure of the previous step

#### 2. Relocation of the Preview/Source switch

- The existing switch in the status bar is **moved** to the **top-right corner** of the editor area
- **No duplication**: the switch exists in one place only, just at a new position
- The status bar is cleaned of this control
- Visual style of the switch: aligned with Markhub's UI design (Warp/Cursor/Linear inspiration) — see `DESIGN-PRINCIPLES.md` when available
- Reactive binding to the same state variable as before — no logic change in source/preview behavior

### UI wiring (slash menu only)

Reuse the exact pattern from `_blocknote-test/+page.svelte`:

```typescript
// Slash menu
const slashStore = editor.getExtension('suggestionMenu').store;
slashStore.subscribe(({ currentVal }) => {
  // bind currentVal to menuState prop of BlockNoteSlashMenu
});
```

**No formatting toolbar wiring**: the component is removed.

### Remaining BlockNote components: native default rendering

For this step, **the remaining UI components are not yet written**. BlockNote falls back to default rendering for:

- **SideMenu (drag handle `⋮⋮`)**: no visible custom handle, but block drag-and-drop MUST work natively via the ProseMirror DOM (BlockNote out-of-the-box behavior)
- **TableHandles**: no custom `+` and resize buttons, but BlockNote handles native row/col dragging
- **LinkToolbar**: no custom toolbar. Links created via markdown shortcut `[text](url)` or slash menu

This is **intentionally degraded**. Steps 2.5.c/d/e will restore these components.

### Validation criteria — Automated tests

- [ ] `cargo test`: all green
- [ ] `vitest`: all green (Crepe-specific tests may be adapted or skipped for now, to be documented)
- [ ] `svelte-check`: 0 errors, 0 warnings
- [ ] `npm run build`: OK
- [ ] Playwright visual: baselines regenerated if visual rendering changes
- [ ] **Specifically**: tests for `BlockNoteFormattingToolbar.svelte` are deleted (not just skipped)

### Validation criteria — Matheo's critical smoke test

**URL**: `http://localhost:1420/` (the main app, NOT the test route)

**Exhaustive test procedure**:

1. Run `npm run tauri dev`
2. Click on a `.md` file in the sidebar
3. **File opening**:
   - Content appears in BlockNote (visible: new rendering, no longer Crepe)
   - Frontmatter `<details>` rendered correctly above
4. **Basic editing**:
   - Type text → appears in real time
   - "Modified" status, then "Saved" 1.5s later
5. **Disk save**:
   - Modify a file
   - Wait for autosave
   - Open the file in Finder or another editor → content updated
6. **Slash menu**:
   - Type `/` → menu appears
   - Filter by typing letters → items filtered
   - Select Heading 1 → block transformed into H1
7. **No floating formatting toolbar**:
   - Select text → verify that NO floating toolbar appears
   - Formatting works via slash menu, markdown shortcuts, keyboard shortcuts
8. **Preview/Source switch (relocated)**:
   - Verify the switch appears in the **top-right** of the editor area
   - Verify it is NO LONGER in the status bar
   - Click Source → editor switches to raw markdown
   - Click Preview → editor returns to WYSIWYG (BlockNote)
   - Round-trip OK (no content loss)
9. **Native block drag-and-drop**:
   - Try to drag a block (click-hold on the block edge, drag up/down)
   - Verify: drop indicator visible, block moved after drop
   - **Note**: no visible `⋮⋮` handle at this step (Step 2.5.c). Drag works via the block area itself
10. **Frontmatter round-trip**:
    - Open a file with frontmatter
    - Modify content (not frontmatter)
    - Save
    - Reopen → frontmatter intact, content modified
11. **Light/dark mode**:
    - Toggle theme via status bar
    - The editor switches theme (may be visually imperfect at this step, full polish in Step 3)
12. **Persistence**:
    - Close the app
    - Relaunch
    - Last opened file reopens with its content

### Bugs ACCEPTED at this step (to be fixed in 2.5.c/d/e/3)

- ⚠️ No visible `⋮⋮` drag handle (to be restored in 2.5.c)
- ⚠️ No transform menu on `⋮⋮` click (slash menu via `/` accessible in the meantime)
- ⚠️ No custom toolbar for links (markdown shortcut `[text](url)` and slash menu sufficient for transitional MVP)
- ⚠️ Tables: no custom `+` row/col buttons, native drag functional
- ⚠️ Imperfect CSS polish: colors, typography may not exactly match `design.md` (Step 3)

### Bugs FORBIDDEN at this step

- ❌ File doesn't open
- ❌ Save doesn't work (data loss)
- ❌ Frontmatter lost in round-trip
- ❌ App crash
- ❌ Sidebar / status bar / vaults regression
- ❌ Block drag-and-drop completely impossible (BlockNote native drag must at minimum allow moving a block)
- ❌ Preview/Source switch broken or absent
- ❌ Formatting toolbar still visible (must be fully removed)

If any of these bugs appear: **STOP**, immediate escalation to Matheo, rollback possible (Crepe still installed).

### Expected commit

`feat(editor): replace Crepe with BlockNote, remove redundant formatting toolbar, relocate Preview/Source switch`

### Documentation to update

- `MIGRATION-NOTES.md`: section on the switch, decisions made, temporarily accepted bugs, and the two UI adjustments
- `JOURNAL.md`: detailed entry of the switch

---

## STEP 2.5.c — SideMenu (drag handle ⋮⋮ + transform menu)

**Objective**: restore the visible drag handle and the click-transform menu, **directly in the main app** (since BlockNote runs there after Step 4).

### Mission

- Create `src/lib/components/BlockNoteSideMenu.svelte`
- Consume BlockNote's `SideMenu` extension via `editor.getExtension('sideMenu').store.subscribe`
- Rendering: `⋮⋮` + `+` button to the left of the block on hover
- Drag: handled natively by BlockNote (no custom pointer events)
- Drop indicator: handled by BlockNote's `DropCursor` plugin
- Click on `⋮⋮`: opens a transformation menu (Heading 1, 2, 3, Text, List, Quote, Code block)
- Wire into `Editor.svelte`

### Validation criteria

- [ ] Vitest tests: mount, render `⋮⋮` and `+`, click opens menu
- [ ] Playwright E2E test in main app
- [ ] **Matheo's smoke test in the MAIN APP**:
  - Open a file
  - Hover on a block → `⋮⋮` and `+` appear on the left
  - Drag a block up/down via `⋮⋮`: blue insertion line visible in real time
  - Drop: block moved instantly to drop position
  - Smooth drag in a single motion (not two-step)
  - Click on `⋮⋮`: transformation menu opens
  - Click on a menu item: block transformed

### Expected commit

`feat(blocknote-ui): side menu with native drag and transform menu`

---

## STEP 2.5.d — TableHandles

**Objective**: restore table controls in the main app.

### Mission

- Create `src/lib/components/BlockNoteTableHandles.svelte`
- Consume BlockNote's `TableHandles` extension
- Rendering: drag handles at row/col edges, `+` buttons to add
- Wire into `Editor.svelte`

### Validation criteria

- [ ] Vitest tests
- [ ] Matheo's smoke test in the MAIN APP:
  - Create a table via slash menu (`/table`)
  - Hover on a cell → handles visible
  - Column resize via drag: works
  - `+` row button adds a row
  - `+` col button adds a column
  - Drag a row to reorder: works with drop indicator

### Expected commit

`feat(blocknote-ui): table handles svelte`

---

## STEP 2.5.e — LinkToolbar

**Objective**: restore a dedicated toolbar for link editing in the main app.

### Mission

- Create `src/lib/components/BlockNoteLinkToolbar.svelte`
- Consume BlockNote's `LinkToolbar` extension
- Rendering: popup above the link with editable URL field + "Open" / "Remove" buttons
- Wire into `Editor.svelte`

### Validation criteria

- [ ] Vitest tests
- [ ] Matheo's smoke test in the MAIN APP:
  - Create a link via markdown shortcut or slash menu
  - Click on the link → toolbar appears
  - Modify the URL → change applied
  - "Open" button → opens the link
  - "Remove" button → removes the link

### Expected commit

`feat(blocknote-ui): link toolbar svelte`

---

## STEP 3 — Markhub design.md CSS Polish

**Objective**: apply the Markhub design system to all BlockNote components in the main app.

### Mission

- Inventory all CSS variables and classes exposed by BlockNote
- Map onto `design.md` tokens (or the future `DESIGN-PRINCIPLES.md` if available)
- Apply overrides in `src/styles/editor-blocknote.css` (or `app.css`)
- No `!important` everywhere. Clean specificity bumping if needed.
- Verify light + dark mode on all components

### Elements to style

- Headings (h1-h6): IDE-density sizes, sans-serif font, no italic
- Slash menu: `--color-bg-raised` background, hover items `--color-surface-hover`
- Preview/Source switch (top-right): aligned with global UI design
- Drag handle (`⋮⋮`): opacity 0.4 by default, 1 on hover, 0.15s transition
- Drop indicator: 2px fine line, `--color-accent` color
- Code blocks: raised background, clean language picker
- Tables: borders, headers, hover states
- Task list checkboxes: accent colors when checked

### Validation criteria

- [ ] Playwright visual test: regenerate baselines in dark + light
- [ ] Matheo's smoke test: navigate the app, test each visual feature, dark + light
- [ ] Visual consistency with sidebar/status bar

### Expected commit

`feat(blocknote): apply Markhub design system to editor`

---

## STEP 5 — Crepe Cleanup

**Objective**: remove all traces of Crepe from the project.

### Mission

- Uninstall `@milkdown/crepe` from `package.json`
- `npm install`
- Remove all Crepe-specific CSS overrides in `app.css`
- Remove custom drag-reorder pointer events code
- Remove custom transform menu code
- Remove the `/_blocknote-test` route
- Delete `MIGRATION-NOTES.md`
- Adapt Vitest tests that mocked Crepe
- Regenerate Playwright baselines
- Update `BACKLOG.md`, `JOURNAL.md`, `STATE.md`

### Validation criteria

- [ ] `grep -r "milkdown\|crepe" src/` returns nothing
- [ ] `cargo test`: all green
- [ ] `npm run test`: all green
- [ ] `npm run check`: 0 errors, 0 warnings
- [ ] `npm run build`: OK
- [ ] `npm run test:visual`: all green with regenerated baselines
- [ ] Matheo's final smoke test

### Expected commit

`chore(editor): remove Crepe dependency and cleanup overrides`

---

## STEP 6 — Closure

- [ ] Final structured wrap-up sent to Matheo
- [ ] `PLAN-BLOCKNOTE.md` updated: migration ✅
- [ ] List of sessions, commits, hashes
- [ ] Matheo's final validation
- [ ] **The merge to `main` is done manually by Matheo, not by Claude Code.**

---

## ANTICIPATED QUESTIONS

### "What if Step 4 reveals a fatal bug?"

STOP. Honest wrap-up to Matheo. Joint decision: continue by patching (bad signal but possible), or roll back (Crepe still installed).

### "What if Matheo wants to add a feature during the migration?"

Polite refusal. "Let's finish the migration first. This feature is noted in `BACKLOG.md`."

### "What if Claude Code discovers a Crepe bug along the way?"

Note in `JOURNAL.md`, no patch. Crepe is dead from Step 4 onwards.

---

## USER GUIDE FOR MATHEO

### At the start of a Claude Code session

Write:
```
Read PLAN-BLOCKNOTE.md and continue to the next step.
```

Claude Code must:
1. Read this file in full
2. Identify the current step (first non-✅ in the progress table)
3. Follow the spec to the letter
4. Respect the non-negotiable rules
5. Send the wrap-up in the mandatory format at the end of the step

### After each wrap-up

1. Read the wrap-up
2. Verify the format is respected (test URL, procedure, what's visible)
3. Do the smoke test live according to the procedure
4. If it works: validate, move to next step
5. If it doesn't work: escalate, fix, do not advance
6. Mark the step ✅ in the progress table

---

## STARTUP PROMPT FOR CLAUDE CODE

To paste at the next start:

```
You're resuming the BlockNote migration.

Read PLAN-BLOCKNOTE.md at the project root BEFORE any action. This plan has been REVISED:
1. The Editor.svelte switch (Step 4) happens NOW, before the remaining UI components (2.5.c/d/e).
2. Step 4 includes TWO UI adjustments: (a) removal of the floating formatting toolbar (redundant with BlockNote), (b) relocation of the Preview/Source switch from the status bar to the top-right of the editor area.

Main rules:
- One step at a time, no parallelization, no "small extra thing in passing"
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible in the main app
- Mandatory interactive smoke test by Matheo before moving to the next step
- If bug discovered: STOP and escalate, no hacking around
- No other workstream (toast, outline, sidebar, empty state, command palette, settings) during the migration

Steps ✅ already done: 1, 2, 2.5.a, 2.5.b (the latter will have its component removed in Step 4).

Next step: STEP 4 — Editor.svelte SWITCH (with UI adjustments).

Follow the STEP 4 spec to the letter. At the start, confirm you've read the plan and give me your attack plan for Step 4. Wait for my GO before coding.
```

---

## IF WE NEED TO STOP

If Matheo decides at some point to abort the migration, the rollback is:

1. `git checkout main`
2. The `feat/blocknote-migration` branch is kept (not deleted)
3. Decision documented in `JOURNAL.md`

But this plan is built to go all the way. Aborting is the exception, not the safety valve.
