# PLAN — THEMING

> **Single objective**: deliver Markhub's theme system — 4 curated themes, OS-aware auto switching, and a Warp-style theme picker — as the visual identity layer that completes the design defaults.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: PLAN-DESIGN-DEFAULTS must be ✅ complete (token foundation, default Light + Dark themes applied, typography baseline in place).
> **Reference**: `DESIGN-PRINCIPLES.md` governs the visual language. This plan extends §4 (Color) with the full theme catalog and the OS-follow mechanism.

---

## CONTEXT

PLAN-DESIGN-DEFAULTS locks in two themes (Markhub Light, Markhub Dark) as the default visual experience. This plan extends that base to **4 curated themes total**, adds **OS-aware automatic switching** (the Warp pattern: one theme for system-light, one for system-dark), and delivers a **dedicated theme picker UI** that lives inside the Settings modal.

The philosophy is **curated and closed** (decided 13 May 2026): 4 themes designed by us, no user-created themes, no import/export, no marketplace. The bet is that 4 carefully crafted themes do more for product identity than 50 mediocre ones.

This plan does **not** ship a theme editor or any user-side theme creation. Those remain on BACKLOG.md for v2 consideration only if real users ask for them.

---

## NON-NEGOTIABLE RULES

Same operating rules as PLAN-BLOCKNOTE, PLAN-DESIGN-DEFAULTS, PLAN-COMMAND-SYSTEM, and PLAN-SETTINGS:

1. **Dedicated branch**: `feat/theming`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step (test URL, procedure, what's visible)
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**: if a theme value isn't right, iterate with Matheo, don't hack around
6. **Brutal honesty** on scope and blockers
7. **No new themes beyond the 4**. Tempting additions go in BACKLOG.md, not in this plan.

---

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN — Theming v1

- **4 curated themes** (full token sets, both UI and BlockNote-aware):
  1. **Markhub Light** (already drafted in PLAN-DESIGN-DEFAULTS — finalized here)
  2. **Markhub Dark** (already drafted in PLAN-DESIGN-DEFAULTS — finalized here)
  3. **Solar** (new — warm light theme, cream base, Solarized Light inspiration)
  4. **Tokyo** (new — saturated dark theme, deep blue base, Tokyo Night inspiration)
- **OS-aware auto switching** (Warp pattern):
  - One theme assigned to "when system is in light mode"
  - One theme assigned to "when system is in dark mode"
  - A top-level mode setting: `Follow system` (default) / `Always light` / `Always dark`
- **Theme picker UI** inside Settings → Appearance:
  - Two slots: "Light theme" and "Dark theme"
  - Each slot displays the 2 compatible themes as preview cards
  - Each card shows a mini-rendering of actual markdown content (heading, paragraph, inline code, link) in that theme
  - Click a card to select that theme for its slot
- **Theme metadata file** per theme: name, family (light/dark), description, accent name (e.g., "Indigo", "Amber")
- **Smooth transitions** when the theme switches (no flash, no layout jump)

### OUT — Reported to v2 or beyond

- User-created themes
- Import/export of themes
- Theme marketplace or community gallery
- Live theme editor (sliders, color pickers)
- Per-vault theme override
- More than 4 themes
- Custom accent color within a theme
- Sepia / High contrast / accessibility variants

### OUT — Permanent

- Auto theme generation from a single accent color
- Theme inheritance / theme variants

---

## ARCHITECTURE OVERVIEW

### Storage format: pure CSS

Each theme is a self-contained CSS file in `src/styles/themes/`:

```
src/styles/themes/
  markhub-light.css
  markhub-dark.css
  solar.css
  tokyo.css
```

Each file contains a single CSS block scoped to its `data-theme` attribute:

```css
[data-theme="markhub-dark"] {
  --color-bg: #0A0B0D;
  --color-bg-raised: #131518;
  /* ... full token set ... */
}
```

All 4 files are imported once at app boot via `app.css`. Switching themes = updating the `data-theme` attribute on `<html>`. No runtime JS-driven CSS injection, no JSON parsing, no flash.

**Decision (13 May 2026)**: pure CSS over JSON-driven. Performance is better, complexity is lower, and the curated-and-closed scope doesn't need runtime flexibility. If the philosophy ever shifts to open/user-created themes, the migration to a JSON-driven loader is a single isolated step — no rewrites required elsewhere.

### Theme metadata

A small TypeScript module exposes the theme catalog:

```typescript
// src/lib/theming/catalog.ts
export interface ThemeMeta {
  id: 'markhub-light' | 'markhub-dark' | 'solar' | 'tokyo';
  name: string;          // user-facing name
  family: 'light' | 'dark';
  description: string;   // one-line tagline
  accentName: string;    // e.g., "Indigo", "Cream"
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'markhub-light',
    name: 'Markhub Light',
    family: 'light',
    description: 'Clean off-white with a confident indigo accent.',
    accentName: 'Indigo',
  },
  // ... 3 more
];
```

### OS-aware switching

A small theming module orchestrates the active theme:

```typescript
// src/lib/theming/manager.ts
type FollowMode = 'system' | 'always-light' | 'always-dark';

interface ThemePreference {
  mode: FollowMode;
  lightTheme: ThemeId;    // which theme to use when light is active
  darkTheme: ThemeId;     // which theme to use when dark is active
}
```

The manager:
1. Reads the preference from the settings store
2. Subscribes to `window.matchMedia('(prefers-color-scheme: dark)')` for OS changes
3. Resolves the active theme based on mode + preferences + OS state
4. Updates `<html data-theme="...">` accordingly
5. On any change (preference or OS): re-resolves and updates

Transitions are smooth thanks to CSS `transition` properties already defined on key surfaces (PLAN-DESIGN-DEFAULTS §5).

### Settings store integration

The existing settings schema (PLAN-SETTINGS Step 1) is extended:

```typescript
interface Settings {
  version: 2;  // bumped for migration
  appearance: {
    themeMode: 'system' | 'always-light' | 'always-dark';   // new
    lightTheme: ThemeId;                                     // new
    darkTheme: ThemeId;                                      // new
    // theme: ThemeId  ← REMOVED (replaced by the trio above)
    editorFont: string;
    editorFontSize: number;
    editorLineHeight: number;
    editorContentWidth: number;
  };
  // ... rest unchanged
}
```

Migration from v1 (single `theme` field) to v2 (mode + lightTheme + darkTheme):
- If `theme === 'markhub-light'`: `themeMode = 'system'`, `lightTheme = 'markhub-light'`, `darkTheme = 'markhub-dark'`
- If `theme === 'markhub-dark'`: same as above
- For any other v1 value: fall back to defaults

### BlockNote token bridge

BlockNote has its own CSS variable namespace (e.g., `--bn-colors-editor-background`). Each theme file ends with a `@layer` or explicit overrides that map Markhub tokens onto BlockNote tokens. This is already partially done in PLAN-DESIGN-DEFAULTS Step 2 for the two default themes — this plan completes it for the two new themes (Solar and Tokyo).

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Theming infrastructure (manager + catalog + migration) | ✅ | (à venir) | 2026-05-13 |
| 2. Solar theme | ⏳ | — | — |
| 3. Tokyo theme | ⏳ | — | — |
| 4. Theme picker UI (Settings → Appearance) | ⏳ | — | — |
| 5. OS-follow mechanism + transitions | ⏳ | — | — |
| 6. Full audit + closure | ⏳ | — | — |

---

## STEP 1 — Theming infrastructure

**Objective**: build the orchestration layer (catalog, manager, settings migration) without yet adding new themes. After this step, the existing 2 themes still work, but they're routed through the new infrastructure.

### Mission

1. Create `src/lib/theming/catalog.ts`:
   - Define `ThemeId`, `ThemeMeta`, `ThemeFamily` types
   - Export the `THEMES` array (initially with only the 2 existing themes)
2. Create `src/lib/theming/manager.ts`:
   - Export `applyTheme(id: ThemeId)` — sets `<html data-theme="...">`
   - Export `resolveActiveTheme(prefs: ThemePreference, osPrefersDark: boolean) → ThemeId`
   - Export `initThemeManager()` — wires the matchMedia listener, subscribes to the settings store, applies on changes
3. Update the settings schema (PLAN-SETTINGS Step 1):
   - Add `version: 2`
   - Add `themeMode`, `lightTheme`, `darkTheme` fields
   - Remove the old `theme` field
   - Write the migration function: v1 → v2
4. Update the settings store hydration: on app boot, if the loaded file is v1, run the migration and persist v2
5. Replace the existing theme application logic with calls to `initThemeManager()` at app root
6. Verify: the app still behaves correctly with the 2 existing themes. Toggling the system between light and dark switches the active theme automatically.

### Validation criteria

- [ ] `src/lib/theming/catalog.ts` and `manager.ts` exist
- [ ] Settings schema is v2 with the new fields
- [ ] Migration from v1 → v2 covered by unit tests
- [ ] `matchMedia('(prefers-color-scheme: dark)')` listener active and triggers theme update
- [ ] `svelte-check`: 0 errors
- [ ] No regression on the existing Light and Dark themes
- [ ] **Matheo's smoke test**:
  1. Launch the app — current theme applies as before
  2. Open System Preferences → switch OS theme from Light to Dark (and vice versa)
  3. Markhub follows automatically with a smooth transition (no flash)
  4. Open the settings JSON file manually, verify it's now v2 with `themeMode`, `lightTheme`, `darkTheme`

### Expected commit

`feat(theming): introduce theme catalog, manager, and OS-aware switching infrastructure`

---

## STEP 2 — Solar theme

**Objective**: design and ship the third theme — a warm light theme inspired by Solarized Light, with a distinct mood from Markhub Light.

### Mission

1. Create `src/styles/themes/solar.css` with the full token set scoped to `[data-theme="solar"]`
2. Add Solar to the `THEMES` catalog
3. Add the BlockNote token overrides at the bottom of the file
4. Iterate with Matheo on values until visually validated

### Starting values (TO BE VALIDATED WITH MATHEO)

These are the proposed starting points. Expect iteration.

```css
[data-theme="solar"] {
  /* Canvas */
  --color-bg: #FDF6E3;              /* cream base */
  --color-bg-raised: #FFFBF0;       /* slightly brighter */
  --color-surface-hover: rgba(101, 123, 131, 0.08);

  /* Borders */
  --color-border: rgba(101, 123, 131, 0.12);
  --color-border-strong: rgba(101, 123, 131, 0.20);

  /* Text */
  --color-text-primary: #586E75;    /* deep slate */
  --color-text-secondary: #93A1A1;
  --color-text-disabled: #C0C8C9;

  /* Accent — warm amber, distinct from Markhub Light's indigo */
  --color-accent: #B58900;
  --color-accent-hover: #CB9A0A;
  --color-accent-fg: #FDF6E3;

  /* Semantic */
  --color-success: #859900;
  --color-warning: #CB4B16;
  --color-danger: #DC322F;
}
```

### Identity check

Solar must be **visually distinct** from Markhub Light at a glance:
- Cream warm base vs. Markhub Light's off-white neutral base
- Amber accent vs. Markhub Light's indigo accent
- Slate-blue text vs. Markhub Light's near-black text
- Overall mood: literary, warm, reading-comfortable (vs. Markhub Light's clean office mood)

### Validation criteria

- [ ] `src/styles/themes/solar.css` exists with complete token set
- [ ] Theme listed in catalog with metadata
- [ ] BlockNote overrides applied — slash menu, headings, code blocks, links all read Solar tokens
- [ ] Contrast: body text ≥ 4.5:1 against background
- [ ] No regression on other themes
- [ ] **Matheo's smoke test**:
  1. Open Settings → Appearance (still uses the old single-theme selector — replaced in Step 4)
  2. Select Solar — wait, this control doesn't exist yet
  3. **Alternative smoke test for this step**: manually set `<html data-theme="solar">` via DevTools or temporarily wire a debug shortcut
  4. Verify Solar renders across the app: sidebar, status bar, editor, slash menu
  5. Open a file with varied content — headings, paragraphs, inline code, links, code blocks — and confirm the mood is "warm literary" not "harsh"

### Expected commit

`feat(theming): add Solar theme (warm light)`

---

## STEP 3 — Tokyo theme

**Objective**: design and ship the fourth theme — a saturated dark theme inspired by Tokyo Night, with a distinct mood from Markhub Dark.

### Mission

Same shape as Step 2, applied to a deep-blue saturated dark.

### Starting values (TO BE VALIDATED WITH MATHEO)

```css
[data-theme="tokyo"] {
  /* Canvas */
  --color-bg: #1A1B26;              /* deep midnight blue */
  --color-bg-raised: #24283B;       /* lifted panel */
  --color-surface-hover: rgba(192, 202, 245, 0.07);

  /* Borders */
  --color-border: rgba(192, 202, 245, 0.08);
  --color-border-strong: rgba(192, 202, 245, 0.16);

  /* Text */
  --color-text-primary: #C0CAF5;    /* lavender-tinted white */
  --color-text-secondary: #9AA5CE;
  --color-text-disabled: #565F89;

  /* Accent — vivid magenta-pink, distinct from Markhub Dark's blue */
  --color-accent: #BB9AF7;
  --color-accent-hover: #C8ACFA;
  --color-accent-fg: #1A1B26;

  /* Semantic */
  --color-success: #9ECE6A;
  --color-warning: #E0AF68;
  --color-danger: #F7768E;
}
```

### Identity check

Tokyo must be **visually distinct** from Markhub Dark at a glance:
- Deep blue base vs. Markhub Dark's neutral near-black
- Magenta/purple accent vs. Markhub Dark's blue accent
- Lavender-white text vs. Markhub Dark's pure light gray
- Overall mood: late-night coding, saturated, atmospheric (vs. Markhub Dark's clean professional mood)

### Validation criteria

- [ ] `src/styles/themes/tokyo.css` exists with complete token set
- [ ] Theme listed in catalog
- [ ] BlockNote overrides applied
- [ ] Contrast: body text ≥ 4.5:1
- [ ] **Matheo's smoke test**: same protocol as Step 2, with Tokyo

### Expected commit

`feat(theming): add Tokyo theme (saturated dark)`

---

## STEP 4 — Theme picker UI

**Objective**: replace the current single-theme selector in Settings → Appearance with the two-slot picker (light theme + dark theme) and the mode selector.

### Mission

1. Create `src/lib/components/settings/ThemePicker.svelte`
2. Layout inside Settings → Appearance (top of the section, before font controls):

```
┌─────────────────────────────────────────────────────────┐
│  Theme mode                                              │
│  ○ Follow system    ○ Always light    ○ Always dark     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Light theme                                             │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │  [preview]      │  │  [preview]      │                │
│  │  Markhub Light  │  │  Solar          │                │
│  │  Indigo         │  │  Amber          │                │
│  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Dark theme                                              │
│  ┌─────────────────┐  ┌─────────────────┐                │
│  │  [preview]      │  │  [preview]      │                │
│  │  Markhub Dark   │  │  Tokyo          │                │
│  │  Blue           │  │  Violet         │                │
│  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

3. Each theme card:
   - Width ~240px, height ~140px
   - Background uses that theme's `--color-bg-raised`
   - Renders a **mini markdown preview**: a tiny H1 ("Heading"), a paragraph line, an `inline code` span, a link, a faint separator. All rendered in the card's theme tokens.
   - Theme name below the preview in the card's text-primary color
   - Accent name in secondary color
   - Selected state: 2px ring in the accent color of the card's theme + checkmark icon
   - Hover: subtle lift (shadow-md → shadow-lg)
   - Click: selects that theme for the corresponding slot
4. Mode selector at the top:
   - Three radio buttons (or a segmented control)
   - "Follow system" is default
   - Changing the mode triggers immediate re-resolution by the theme manager
5. Selecting a theme:
   - Updates the settings store
   - Triggers `applyTheme()` if that theme matches the current active family
   - Updates the visual selection state on the card
6. Disable logic:
   - If mode is "Always light": the dark theme cards are slightly dimmed (still selectable for future use)
   - If mode is "Always dark": the light theme cards are slightly dimmed
   - "Follow system": both fully active

### Mini-preview rendering

The card preview is hand-coded HTML/CSS inside the card, **not** a screenshot:

```html
<div class="theme-preview" data-theme-preview="solar">
  <div class="preview-heading">Heading</div>
  <div class="preview-para">Lorem ipsum <code>inline</code> and a <a>link</a></div>
  <div class="preview-separator"></div>
  <div class="preview-cursor"></div>
</div>
```

A separate CSS file `theme-preview.css` defines styles that read tokens from the card's `data-theme-preview` attribute. Each card forces its theme context via the same attribute pattern, allowing them to render independently of the globally active theme.

### Validation criteria

- [ ] Theme picker renders correctly in both themes (light and dark UI contexts)
- [ ] Mode selector functions: switching mode triggers re-resolution
- [ ] Selecting a light theme card updates the light slot, dark card updates the dark slot
- [ ] Mini-previews accurately reflect each theme's mood at small scale
- [ ] Selected state visually clear
- [ ] Disabled state respects mode
- [ ] **Matheo's smoke test**:
  1. Open Settings → Appearance
  2. Switch mode to "Follow system"
  3. Select Markhub Light as light theme, Tokyo as dark theme
  4. Change OS theme — Markhub follows the right Markhub theme for each OS state
  5. Switch mode to "Always dark" — Markhub stays on Tokyo regardless of OS
  6. Switch back to "Follow system", select Solar as light, Markhub Dark as dark
  7. Test all combinations are honored

### Expected commit

`feat(theming): theme picker with light/dark slots and mini-previews`

---

## STEP 5 — OS-follow mechanism + transitions polish

**Objective**: refine the OS-follow behavior and ensure transitions feel premium.

### Mission

1. Verify the matchMedia listener is robust:
   - Initial state correctly read on app boot
   - Listener properly cleaned up on app teardown (no leak)
   - Edge case: OS theme change during a modal being open — modal updates smoothly
2. Smooth transition:
   - Add a `transition` property on `--color-bg`, `--color-bg-raised`, `--color-text-primary`, `--color-border` at the root level
   - Duration: 200ms with `--easing-standard`
   - **Exception**: no transition on the editor surface itself if it causes visible flicker on heavy content — to be tested
3. No flash on app cold start:
   - Theme is resolved and applied **before** the first paint
   - This may require a small `<script>` block in `index.html` that reads the stored preference and sets `data-theme` before Svelte hydrates
4. Test edge cases:
   - First launch (no stored settings): defaults to `system` mode, Markhub Light for light slot, Markhub Dark for dark slot
   - Settings file corrupted: falls back to defaults gracefully
   - OS changes theme while app is in background: app catches up on focus

### Validation criteria

- [ ] OS theme changes propagate smoothly with a 200ms transition, no flash
- [ ] App cold start: no flash of wrong theme
- [ ] Edge cases handled without errors
- [ ] **Matheo's smoke test**:
  1. Cold-launch the app multiple times with various OS theme states — never see a flash
  2. Change OS theme while the app is active — smooth transition
  3. Send app to background, change OS, foreground app — theme catches up
  4. Open settings during an OS theme change — the picker reflects the new state

### Expected commit

`feat(theming): polish OS-follow transitions and prevent cold-start flash`

---

## STEP 6 — Full audit + closure

**Objective**: end-to-end validation of the theming system.

### Mission

1. Walk through every screen and state in all 4 themes:
   - Empty state
   - Vault open, file selected
   - Frontmatter expanded and collapsed
   - File with all content types (headings, paragraphs, code blocks, tables, lists, links)
   - Source mode (verify mono fonts behave well in all themes)
   - Slash menu open
   - Settings modal open
   - Theme picker itself
2. Take Playwright visual baselines for each theme on key screens
3. Verify accessibility:
   - Contrast ratios pass WCAG AA in all 4 themes
   - Focus rings visible in all 4 themes
   - Selected/hover states distinguishable
4. Update documentation:
   - DESIGN-PRINCIPLES.md §4 — replace the "4 locked themes" placeholder with the final list and finalized rationale
   - JOURNAL.md — entry summarizing the theming work
   - BACKLOG.md — close theming-v1 items, add any deferred items (theme editor, etc.)
5. Final smoke test with Matheo: guided walk-through, each theme, each state, sign-off

### Validation criteria

- [ ] All 4 themes render correctly across every app surface
- [ ] Playwright visual baselines locked
- [ ] WCAG AA verified for body text in all themes
- [ ] No outstanding visual inconsistencies
- [ ] Documentation up to date
- [ ] **Matheo's final smoke test**: signed off on each theme

### Expected commit

`chore(theming): final audit and documentation update`

---

## QUESTIONS ANTICIPATED

### "What if Solar or Tokyo colors don't land on the first iteration?"

Expected. The starting values in Steps 2 and 3 are starting points, not final. Plan for 1–2 iterations per theme. The structure of the step doesn't change; only the hex values do.

### "What if the matchMedia listener doesn't fire on a specific OS / WebView version?"

Document the platform in JOURNAL.md. The fallback is the "Always light" / "Always dark" mode — the user can opt out of OS follow if it's broken on their setup. Add a small console warning in dev mode if `matchMedia` is unavailable.

### "What if Matheo wants a fifth theme during the plan?"

Polite refusal. "Noted in BACKLOG.md for v2." Scope stays locked.

### "What about the mini-preview content? What if a theme renders poorly at small scale?"

The mini-preview is intentionally minimal (heading, paragraph, inline code, link, cursor). If a theme reads poorly at this scale, it's a signal the theme needs work — iterate on the theme, not on the preview.

### "What about the editor font in each theme?"

Editor font is a separate setting (PLAN-SETTINGS Step 3), independent of theme. The theme controls colors only. A user can pair any editor font with any theme.

### "What about syntax highlighting in code blocks?"

Code blocks in BlockNote use a syntax highlighting library (likely Prism or Shiki). Each theme must define overrides for the syntax token colors (keyword, string, number, comment, etc.) to match the theme's mood. This work is folded into Steps 2 and 3 — each theme file includes its syntax palette at the bottom.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-THEMING.md.

Prerequisites:
- PLAN-BLOCKNOTE must be ✅ fully complete
- PLAN-DESIGN-DEFAULTS must be ✅ fully complete
- DESIGN-PRINCIPLES.md is your design source of truth

Read PLAN-THEMING.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative for visuals
- The 4-theme scope is locked. No additions.
- Curated philosophy: no user theme creation, no import/export, no marketplace.

Next step: STEP 1 — Theming infrastructure.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```

---

## RELATIONSHIP TO OTHER PLANS

- **PLAN-DESIGN-DEFAULTS** posed the foundation: tokens, the 2 default themes, typography, micro-interactions. This plan extends it with 2 more themes and OS-follow logic.
- **PLAN-SETTINGS** defines the Settings modal shell. This plan replaces the simple theme dropdown there with the two-slot theme picker. The migration is forward-compatible.
- **PLAN-COMMAND-SYSTEM** adds `view.toggleTheme` as a registered command. After this plan ships, `view.toggleTheme` toggles between the light and dark slots when in "Follow system" mode, or cycles through themes when in "Always" mode. Update the command's behavior accordingly during Step 5.

---

## NOTES ON THIS PLAN'S MATURITY

This plan is **structurally complete** but contains **starting-point values** for Solar and Tokyo (Steps 2 and 3). These values will be iterated visually with Matheo before being committed. The structure of the steps, the picker UI design, the OS-follow mechanism, the storage approach, and the catalog model are all final.

What's open: exact hex values for Solar and Tokyo, the precise wording of theme descriptions, and the final visual polish of mini-previews. These resolve during the steps, not in advance.

Everything else is locked.
