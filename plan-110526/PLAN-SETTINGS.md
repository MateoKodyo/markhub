# PLAN — SETTINGS v1

> **Single objective**: deliver the user-facing settings surface for Markhub, persisted across sessions, covering the scope validated in the 10 May 2026 questionnaire.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: PLAN-COMMAND-SYSTEM must be ✅ complete (Settings is opened via Cmd+K → "Open Settings").
> **Reference**: `DESIGN-PRINCIPLES.md` governs the visual treatment.

---

## CONTEXT

Settings are the visible leverage layer on top of an already-great default. By the time this plan starts, the defaults are locked (PLAN-DESIGN-DEFAULTS ✅) and the command palette is in place (PLAN-COMMAND-SYSTEM ✅). Settings now becomes a coherent surface that exposes a focused set of controls to advanced users without overwhelming the rest.

The exact scope was validated in a guided questionnaire between Matheo and Claude on 10 May 2026. This plan implements that scope precisely — no more, no less.

---

## NON-NEGOTIABLE RULES

Same operating rules as the previous plans:

1. **Dedicated branch**: `feat/settings-v1`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**
6. **Brutal honesty** on scope and blockers
7. **No new settings beyond the validated scope**. If a temptation arises ("we could also add X"), it goes in BACKLOG.md, not in this plan.

---

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN — Settings v1

#### Appearance
- Theme selector (4–5 curated presets from PLAN-DESIGN-DEFAULTS)
- Editor font family (4–5 curated choices)
- Editor font size (slider)
- Editor line height (slider)
- Editor content width (slider — the writing measure)

#### Editor
- Autosave delay (slider, 500ms–5s, default 1500ms)
- Spell check (toggle)

#### Source mode
- Monospace font for source mode (2–3 curated choices: Fira Code, JetBrains Mono, Geist Mono)

#### Files
- Confirm before permanent file deletion (toggle)

#### Behavior
- Ask before closing a modified unsaved file (toggle)

#### Advanced
- "Open config folder" button (opens Finder/Explorer at the Tauri config directory)
- Export settings (JSON download)
- Import settings (load a JSON file)
- App version indicator

### OUT — Reported to v2

- Toggle Preview/Source presence and behavior (already covered in PLAN-BLOCKNOTE Step 4)
- Focus mode / Typewriter mode
- Customizable keyboard shortcuts
- Density compact/comfortable/spacious
- Custom accent color
- Sidebar ignore patterns
- Auto-create missing folders on file creation
- Default file sort order
- UI font and font size (UI is locked, per DESIGN-PRINCIPLES.md)

### OUT — Permanent

- Telemetry / crash report toggles (no telemetry in Markhub by design)
- Developer mode toggle (no exposed dev mode)
- External links to docs / GitHub / report bug (kept minimalist; these surfaces live elsewhere)
- Theme editor (not in MVP)
- Custom keybind UI (v2 at earliest)

---

## ARCHITECTURE OVERVIEW

### Storage

Settings persist as a JSON file in the Tauri app config directory:
- macOS: `~/Library/Application Support/Markhub/settings.json`
- Linux: `~/.config/Markhub/settings.json`
- Windows: `%APPDATA%\Markhub\settings.json`

The file is read on app startup and written on every change (debounced by ~250ms to batch rapid slider movements).

### Schema

A versioned JSON schema. Future migrations are supported via the `version` field:

```typescript
interface Settings {
  version: 1;
  appearance: {
    theme: 'markhub-light' | 'markhub-dark' | 'tokyo-night' | 'solarized-light';
    editorFont: string;        // font ID from curated list
    editorFontSize: number;    // 14–20
    editorLineHeight: number;  // 1.4–1.8
    editorContentWidth: number; // 560–1200 px
  };
  editor: {
    autosaveDelayMs: number;   // 500–5000
    spellCheck: boolean;
  };
  source: {
    monoFont: 'fira-code' | 'jetbrains-mono' | 'geist-mono';
  };
  files: {
    confirmDelete: boolean;
  };
  behavior: {
    askBeforeClosingUnsaved: boolean;
  };
}
```

### Default values

Sensible defaults are defined as a constant. The settings file is created with these defaults on first launch.

### Store

A Svelte store (`settingsStore`) holds the current settings. Components subscribe to read; components call `settingsStore.update()` to write. The store automatically:
- Persists on change (debounced)
- Validates against the schema before persisting
- Applies side effects when relevant (e.g., theme change updates `data-theme` attribute)

### Surface

The settings page is a dedicated route (`/settings`) or a modal — to be decided in Step 2. Recommendation: **modal**, because settings are infrequent and a route adds navigation friction. A modal feels closer to Linear and Cursor.

The modal is opened via:
- Cmd+K → "Open Settings"
- Direct keyboard shortcut (Cmd+, on macOS, Ctrl+, on Windows/Linux — the OS-standard for settings)
- A small gear icon in the status bar (optional, to discuss)

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Settings store + persistence | ✅ | `c4db29f` | ✅ smoke OK 2026-05-12 matin |
| 2. Modal shell + navigation | ✅ | `59893c7` | ✅ smoke OK 2026-05-12 matin |
| 3. Appearance section | 🟡 | `39d2027` + `13489ac` | ⚠️ body font/size/lh tentative remount 2026-05-14 (commit `a8bbc41`) reverted (`e95f058`) — n'a pas marché en réel ; BACKLOG |
| 4. Editor section | ✅ | `d9dd033` | ✅ smoke OK 2026-05-13 matin |
| 5. Source mode + Files + Behavior sections | ✅ | `40feb30` | ✅ smoke OK 2026-05-13 matin |
| 6. Advanced section | 🟡 code livré | `58b33c5` | smoke pending — Open config, Export/Import JSON, version |
| 7. Command palette integration | 🟡 code livré | `58b33c5` | smoke pending — 6 section deep-link commands + existing Cmd+, |
| 8. Final audit + closure | 🟡 code livré | (closure commit) | smoke audit pending |

---

## STEP 1 — Settings store + persistence

**Objective**: build the data layer. No UI yet.

### Mission

1. Create `src/lib/stores/settings.ts`:
   - Define the `Settings` interface (as in Architecture)
   - Define `DEFAULT_SETTINGS` constant with the validated defaults
   - Create a Svelte writable store wrapping the settings
   - On store change: persist to disk (debounced 250ms) via a Tauri command
2. Create a Tauri command pair:
   - `read_settings()` returns the current `Settings` JSON, or creates the file with defaults if missing
   - `write_settings(settings: Settings)` writes the JSON to disk atomically (write to temp, rename)
3. On app startup: load settings from disk, hydrate the store
4. Validation: when reading, if the JSON is malformed or schema-incompatible, fall back to defaults and log a warning in JOURNAL.md
5. Apply theme side effect: when `appearance.theme` changes in the store, update `<html data-theme="...">` immediately

### Validation criteria

- [ ] `cargo test` covers `read_settings` and `write_settings` (round-trip and corruption handling)
- [ ] Vitest tests cover the store contract (read, update, debounced persist)
- [ ] First launch creates the settings file with defaults
- [ ] Manual edit of the JSON file (with the app closed) is honored on next launch
- [ ] Theme switching via the store updates the DOM immediately
- [ ] **Matheo's smoke test**: open the app, verify the settings file exists in the config folder, edit it manually (change theme), relaunch, verify the new theme is applied

### Expected commit

`feat(settings): persistent settings store with Tauri backend`

---

## STEP 2 — Modal shell + navigation

**Objective**: build the settings modal UI shell, with section navigation.

### Mission

1. Create `src/lib/components/SettingsModal.svelte`:
   - Modal overlay with backdrop dim
   - Modal panel: ~760px wide, ~600px tall, centered, `--radius-xl`, `--shadow-xl`
   - Left rail: section navigation (Appearance, Editor, Source, Files, Behavior, Advanced)
   - Right area: the active section's controls
   - Close affordance: icon button top-right, plus Escape key
2. Section list (in order):
   - Appearance
   - Editor
   - Source mode
   - Files
   - Behavior
   - Advanced
3. State:
   - Currently active section (defaults to Appearance)
   - Local copy of settings for editing (commits to the store on every change — no separate "Save" button; changes apply live)
4. Visual style: aligns with DESIGN-PRINCIPLES.md (raised surface, subtle borders, generous padding, comfortable density)
5. The modal opens via a global function `openSettings()` exposed from the store layer

### Validation criteria

- [ ] Modal renders correctly in light and dark themes
- [ ] Section navigation switches the right-side content
- [ ] Escape closes
- [ ] Click outside closes (with confirmation if there were unsaved changes — but since changes apply live, no confirmation needed)
- [ ] **Matheo's smoke test**: open the modal via the temporary debug trigger, navigate sections, close via Escape and click-outside, verify visual quality

### Expected commit

`feat(settings): modal shell with section navigation`

---

## STEP 3 — Appearance section

**Objective**: implement all controls in the Appearance section.

### Mission

Controls:

1. **Theme selector**:
   - Rendered as a row of theme preview cards (one per theme)
   - Each card: tiny preview of the theme's UI palette + theme name + selected indicator (accent ring or checkmark)
   - Click selects → store updates → `data-theme` updates → live preview
2. **Editor font family**:
   - Dropdown or styled radio group with 4–5 choices
   - Each choice rendered in its own typeface for visual preview
   - Selection persists to store
3. **Editor font size**:
   - Slider, range 14–20, step 1, default 16
   - Live preview: a sample paragraph below the slider updates in real time
4. **Editor line height**:
   - Slider, range 1.4–1.8, step 0.05, default 1.6
   - Same live preview paragraph
5. **Editor content width**:
   - Slider, range 560–1200 px, step 20, default ~720
   - Live preview: a wider sample shows the measure constraint visibly

Implementation notes:
- Live preview paragraph appears above all the sliders so users see all three settings affecting the same sample
- All controls bind to the settings store via two-way binding; no "Save" button

### Validation criteria

- [ ] All five controls function, persist, and apply live
- [ ] Live preview paragraph updates in real time
- [ ] Switching theme during editing applies correctly across the app (including the open editor in the background)
- [ ] Defaults match `DEFAULT_SETTINGS`
- [ ] **Matheo's smoke test**: open settings → Appearance, change each setting, verify the editor (visible in the background) responds in real time

### Expected commit

`feat(settings): appearance section with live preview`

---

## STEP 4 — Editor section

**Objective**: implement Autosave delay and Spell check controls.

### Mission

1. **Autosave delay slider**:
   - Range 500ms–5000ms, step 100ms, default 1500ms
   - Display the current value next to the slider (e.g., "1.5s")
   - The autosave logic in the editor reads from the store; no re-wiring needed if the store is the single source of truth (verify in Step 1)
2. **Spell check toggle**:
   - Standard toggle switch
   - Applied via the `spellcheck="true"` HTML attribute on the BlockNote editor surface
   - Verify: WebView in Tauri respects this attribute (test required)

### Validation criteria

- [ ] Autosave delay change reflects in actual save behavior (test: change to 500ms, type, verify save fires after 500ms)
- [ ] Spell check toggle: ON shows red underlines on misspelled words, OFF removes them
- [ ] Both settings persist across app restarts
- [ ] **Matheo's smoke test**: change autosave delay to 3000ms, modify a file, time the save; toggle spell check and verify underline behavior

### Expected commit

`feat(settings): editor section with autosave and spell check`

---

## STEP 5 — Source mode + Files + Behavior sections

**Objective**: implement the three smaller sections in one step (each is just one or two controls).

### Mission

#### Source mode section

- Monospace font selector: 2–3 choices (Fira Code, JetBrains Mono, Geist Mono)
- Same UX as the editor font selector: each choice rendered in its own typeface
- Applied to: source mode editor, code blocks in preview, inline code

#### Files section

- "Confirm before permanent deletion" toggle
- The actual delete logic (already in the file system layer) checks this setting; if true, shows a confirmation dialog; if false, deletes immediately

#### Behavior section

- "Ask before closing an unsaved modified file" toggle
- The close-file logic (in editor or file-switching code) checks this setting

### Validation criteria

- [ ] Monospace font change reflects in source mode AND in code blocks in preview
- [ ] Delete confirmation toggle works (with and without confirmation)
- [ ] Unsaved-close prompt toggle works
- [ ] All settings persist
- [ ] **Matheo's smoke test**: walk through each control, verify each side effect

### Expected commit

`feat(settings): source, files, and behavior sections`

---

## STEP 6 — Advanced section

**Objective**: implement the four advanced controls.

### Mission

1. **Open config folder button**:
   - Triggers a Tauri command that opens the app config directory in the OS file explorer
   - Use `tauri-plugin-opener` or equivalent
2. **Export settings button**:
   - Serializes the current settings to JSON
   - Triggers a save dialog (Tauri's standard save dialog)
   - User picks location, file is written
3. **Import settings button**:
   - Triggers an open dialog
   - User picks a JSON file
   - File is validated against the schema
   - If valid: applied to the store and persisted
   - If invalid: error toast (or inline message), no change
4. **App version display**:
   - Reads version from `package.json` or Tauri's app metadata
   - Displays as plain text: "Markhub v0.X.Y"
   - Not interactive

### Validation criteria

- [ ] "Open config folder" actually opens the Finder/Explorer at the right path
- [ ] Export produces a valid JSON file matching the schema
- [ ] Import successfully loads a valid file
- [ ] Import rejects an invalid file with a clear error
- [ ] Version display reads the correct version
- [ ] **Matheo's smoke test**: walk through each, including exporting then re-importing the same file (round-trip test)

### Expected commit

`feat(settings): advanced section with config access, export/import, version`

---

## STEP 7 — Command palette integration

**Objective**: wire the Settings modal into the command palette and add a direct keyboard shortcut.

### Mission

1. Register commands in the command registry:
   - `settings.open` → opens the Settings modal
   - `settings.open.appearance` → opens directly to Appearance section
   - `settings.open.editor` → opens directly to Editor section
   - ...one per section
2. Register the keyboard shortcut:
   - Cmd+, (macOS) / Ctrl+, (Windows/Linux) opens Settings (via the `settings.open` command)
3. Verify Cmd+K → "Open Settings" works
4. Optionally add a gear icon in the status bar that triggers `settings.open` (discussion with Matheo first)

### Validation criteria

- [ ] Cmd+, opens settings
- [ ] Cmd+K → "Open Settings" works
- [ ] Section-specific commands open at the right section
- [ ] If gear icon is added, it works
- [ ] **Matheo's smoke test**: open settings via three different paths (keyboard, command palette, optional gear icon)

### Expected commit

`feat(settings): integrate with command palette and global shortcut`

---

## STEP 8 — Final audit + closure

**Objective**: end-to-end validation of the settings system.

### Mission

1. Test every setting one by one in a fresh test vault
2. Verify persistence: change every setting, close the app, reopen, verify all changes survived
3. Test export → wipe settings → import → verify state restored
4. Test theme switching while editing (no flash, no layout jump)
5. Visual audit: settings modal matches DESIGN-PRINCIPLES.md
6. Playwright visual baseline for the settings modal in both themes
7. Documentation: update JOURNAL.md and BACKLOG.md (close items for v1, add items for v2)

### Validation criteria

- [ ] Full functional sweep passes
- [ ] Persistence verified across restarts
- [ ] Export/import round-trip works
- [ ] Visual quality matches the design system
- [ ] Playwright baselines updated
- [ ] BACKLOG.md updated with v2 items
- [ ] **Matheo's final smoke test**: guided tour of every setting, signing off on the feel

### Expected commit

`chore(settings): final audit and documentation update`

---

## QUESTIONS ANTICIPATED

### "What if the settings JSON file gets corrupted manually?"

Step 1 handles this: malformed JSON falls back to defaults, with a warning logged. No app crash. We may add a "settings backup" feature in v2 (rotating last N versions) but not in v1.

### "What if the user picks an editor font that fails to load?"

The font stack should always include a system fallback. Verify in Step 3 that each choice has a proper fallback chain. If a font fails to load in production, the fallback kicks in silently — no error shown to the user.

### "Should settings sync across machines?"

Out of scope for v1. Manual export/import is the v1 sync story. A real sync layer would be a separate plan.

### "What if Matheo wants to add a setting during this plan?"

Refuse politely: "Noted in BACKLOG.md for v2." No additions to scope mid-plan.

### "What about a global 'Reset to defaults' button?"

We discussed this in the questionnaire and Matheo did **not** include it in the scope. Settings can be reset by deleting the config file (revealed via "Open config folder"). v2 candidate.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-SETTINGS.md.

Prerequisites:
- PLAN-BLOCKNOTE must be ✅ fully complete
- PLAN-DESIGN-DEFAULTS must be ✅ fully complete
- PLAN-COMMAND-SYSTEM must be ✅ fully complete
- DESIGN-PRINCIPLES.md is your design source of truth

Read PLAN-SETTINGS.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative for visuals
- The scope is locked. No new settings beyond the validated list.

Next step: STEP 1 — Settings store + persistence.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```
