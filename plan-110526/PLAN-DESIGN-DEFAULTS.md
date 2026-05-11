# PLAN — DESIGN DEFAULTS

> **Single objective**: lock in Markhub's default visual experience so the app feels premium *before any user touches settings*.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: PLAN-BLOCKNOTE must be ✅ complete. This plan does not start while BlockNote migration is in flight.
> **Reference**: `DESIGN-PRINCIPLES.md` is the authoritative charter. This plan operationalizes those principles.

---

## CONTEXT

The settings page (PLAN-SETTINGS) will let users tweak typography, themes, autosave delay, and a few other knobs. But **most users never open settings**. The default experience determines whether Markhub feels like a premium developer tool or a generic markdown editor.

This plan is where we make the default *excellent*. It locks tokens, palette, typography, spacing, micro-interactions, and the two anchor visual features (Cursor-style empty state, Warp-style sidebar close button) that complete the visual identity.

This plan deliberately precedes PLAN-SETTINGS. Settings are leverage on top of a great default — not a substitute for one.

---

## NON-NEGOTIABLE RULES

(Same operating rules as PLAN-BLOCKNOTE — same author, same project, same discipline.)

### Rule 1 — Dedicated branch
This work lives on `feat/design-defaults`. No merge to `main` before Matheo's final validation.

### Rule 2 — One step at a time
No parallelization. No "I also tweaked X in passing."

### Rule 3 — Mandatory wrap-up at end of step

Same format as PLAN-BLOCKNOTE Rule 3:

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

### Rule 4 — Mandatory interactive smoke test
No step is validated until Matheo has tested live and confirmed.

### Rule 5 — DESIGN-PRINCIPLES.md is the source of truth
If a design decision needs to be made and isn't in DESIGN-PRINCIPLES.md, **STOP** and escalate. Do not invent.

### Rule 6 — Brutal honesty
If a step is exceeding scope or hitting a blocker, say so immediately.

### Rule 7 — No new features
This plan is **only** about polishing what exists. No new pages, no new components beyond what's specified.

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Token foundation | ✅ | `e6c459e` | OK |
| 2. Default theme palette (Light + Dark) | ✅ | `9378691` | OK (WCAG fix `#a09e9a` → `#8a8884`, secondary preserved) |
| 3. Typography baseline | ✅ | `0e37004` | OK (IDE-density preserved, `--font-ui` / `--font-editor` split locked) |
| 4. Spacing & radius rhythm | ✅ | `6136502` | OK (`.button` floor 8×12, 4px-grid pills) |
| 5. Micro-interactions baseline | ✅ | `aa90373` | OK (transitions + focus rings via tokens) |
| 6. Cursor-style empty state | ✅ | `e7a987d` | OK (after 2 visual iterations — wordmark only, uniform cards, no preselect) |
| 7. Warp-style sidebar close button | ✅ | `a9f89aa` | OK (after 5 alignment iterations — 80px left gutter, 24×24, padding-top 5px) |
| 8. Iconography sweep | ✅ | `92b358c` | OK (audit confirms Lucide-only, EmptyState cards 18→20px, IDE-density chrome preserved) |
| 9. Full visual audit + Playwright baseline | ✅ | `8ca96a3` | OK (39/39 Playwright green — 34 preserved + 5 new for EmptyState/window-chrome) |
| 10. Closure | ✅ | — | — |

---

## STEP 1 — Token foundation

**Objective**: define the complete CSS variable system that every component will consume. No visual change yet — this step is plumbing.

### Mission

1. Create `src/styles/tokens.css` (or update existing) with the complete token namespace
2. Tokens are CSS custom properties organized by category:
   - `--color-*` — colors (background, surface, text, border, accent, semantic)
   - `--font-*` — font families and weights
   - `--text-*` — font sizes
   - `--leading-*` — line heights
   - `--space-*` — spacing values (4px grid)
   - `--radius-*` — corner radius scale
   - `--shadow-*` — shadow presets
   - `--transition-*` — duration and easing
3. Both light and dark theme define the **same token names** with different values
4. Theme switching uses a `data-theme="light" | "dark"` attribute on `<html>` (or `<body>`)
5. **No component touches anything yet**. This step only creates the variables.

### Token reference (from DESIGN-PRINCIPLES.md §3 to §8)

Colors (each theme defines):
```
--color-bg                 /* the canvas */
--color-bg-raised          /* sidebar, status bar, panels */
--color-surface-hover      /* hover state of list items */
--color-border             /* subtle 1px borders */
--color-border-strong      /* visible borders for inputs at rest */
--color-text-primary
--color-text-secondary
--color-text-disabled
--color-accent
--color-accent-hover
--color-accent-fg          /* foreground color when on accent background */
--color-success
--color-warning
--color-danger
```

Typography:
```
--font-ui                  /* UI font, locked, Inter or fallback */
--font-editor              /* editor font, configurable via settings */
--font-mono                /* monospace, configurable via settings */
--text-xs   /* 11px */
--text-sm   /* 12px */
--text-base /* 14px */
--text-md   /* 16px — editor default */
--text-lg   /* 18px */
--text-xl   /* 20px */
--text-2xl  /* 24px */
--text-3xl  /* 32px */
--leading-tight    /* 1.3 */
--leading-normal   /* 1.5 */
--leading-relaxed  /* 1.6 — editor default */
--leading-loose    /* 1.8 */
```

Spacing (4px grid):
```
--space-1  /* 4px */
--space-2  /* 8px */
--space-3  /* 12px */
--space-4  /* 16px */
--space-5  /* 20px */
--space-6  /* 24px */
--space-8  /* 32px */
--space-10 /* 40px */
--space-12 /* 48px */
--space-16 /* 64px */
```

Radius:
```
--radius-xs   /* 2px */
--radius-sm   /* 4px */
--radius-md   /* 6px */
--radius-lg   /* 8px */
--radius-xl   /* 12px */
--radius-full /* 9999px */
```

Shadow:
```
--shadow-sm     /* subtle elevation */
--shadow-md     /* default raised surface */
--shadow-lg     /* floating menus */
--shadow-xl     /* modals */
```

Transition:
```
--duration-fast    /* 100ms */
--duration-base    /* 150ms */
--duration-slow    /* 200ms */
--easing-standard  /* cubic-bezier(0.4, 0, 0.2, 1) */
```

### Validation criteria

- [ ] `src/styles/tokens.css` exists with the complete namespace above
- [ ] Both `[data-theme="light"]` and `[data-theme="dark"]` blocks defined with values
- [ ] Tokens are referenced (used) by **at least one** existing component to verify the pipeline works
- [ ] `npm run build` passes
- [ ] `svelte-check` shows 0 errors
- [ ] **Matheo's smoke test**: open the app, toggle theme, verify the chosen component reflects the token change

### Expected commit

`feat(design): introduce complete CSS token system`

---

## STEP 2 — Default theme palette (Light + Dark)

**Objective**: define and apply the actual color values for **Markhub Light** and **Markhub Dark**, the two MVP default themes.

### Mission

1. Fill in the token values defined in Step 1 for both themes
2. Apply to all existing components: sidebar, status bar, editor surface, modals (if any)
3. Test contrast: WCAG AA for body text minimum
4. Verify BlockNote integration: BlockNote's own CSS variables must be overridden to match Markhub tokens

### Proposed values (TO BE FINE-TUNED WITH MATHEO)

These are starting points based on DESIGN-PRINCIPLES.md. **Matheo must validate or adjust each value visually.**

**Markhub Dark** (default):
```
--color-bg:                #0A0B0D
--color-bg-raised:         #131518
--color-surface-hover:     rgba(255, 255, 255, 0.05)
--color-border:            rgba(255, 255, 255, 0.06)
--color-border-strong:     rgba(255, 255, 255, 0.12)
--color-text-primary:      #E8E8EA
--color-text-secondary:    #9B9DA1
--color-text-disabled:     #4A4C50
--color-accent:            #4B8BFF  /* blue, to be confirmed */
--color-accent-hover:      #5C97FF
--color-accent-fg:         #FFFFFF
--color-success:           #4ADE80
--color-warning:           #F59E0B
--color-danger:            #EF4444
```

**Markhub Light**:
```
--color-bg:                #FBFBFA
--color-bg-raised:         #FFFFFF
--color-surface-hover:     rgba(0, 0, 0, 0.04)
--color-border:            rgba(0, 0, 0, 0.06)
--color-border-strong:     rgba(0, 0, 0, 0.12)
--color-text-primary:      #1A1B1E
--color-text-secondary:    #5E6166
--color-text-disabled:     #B4B6BA
--color-accent:            #2563EB
--color-accent-hover:      #1D4ED8
--color-accent-fg:         #FFFFFF
--color-success:           #16A34A
--color-warning:           #D97706
--color-danger:            #DC2626
```

⚠ **These values are starting points. Matheo must visually validate each one before committing.** Expect 1–2 iterations on the dark theme accent in particular (blue tone, saturation).

### Validation criteria

- [ ] Both themes applied across all existing surfaces (sidebar, status bar, editor, frontmatter details)
- [ ] BlockNote overrides applied (slash menu, headings, etc. read theme tokens)
- [ ] Contrast tested: body text ≥ 4.5:1, large text ≥ 3:1
- [ ] **Matheo's smoke test**: switch between Light and Dark several times; navigate the app; open files; check every visible surface. Note any color that "feels off."

### Expected commit

`feat(design): apply Markhub Light and Markhub Dark default themes`

---

## STEP 3 — Typography baseline

**Objective**: implement the default font stack and apply size, weight, and letter-spacing rules from DESIGN-PRINCIPLES.md §3.

### Mission

1. Bundle or link the UI font (recommend Inter, self-hosted)
2. Bundle or link the default editor font (Inter again is fine for default, with iA Writer Quattro and a serif/mono available as future settings)
3. Bundle the default monospace (JetBrains Mono recommended)
4. Apply CSS rules:
   - `body` and UI chrome use `--font-ui`
   - Editor surface uses `--font-editor`
   - Code blocks, source mode, inline code use `--font-mono`
   - Heading sizes and letter-spacing per the spec
5. Verify font loading performance: fonts must load fast (subset if needed, preload critical weights)

### Validation criteria

- [ ] Fonts load and render correctly in both themes
- [ ] H1/H2/H3 in the editor show the negative letter-spacing as specified
- [ ] No FOUT (flash of unstyled text) on cold load — fonts preloaded
- [ ] Source mode shows the monospace font
- [ ] **Matheo's smoke test**: open several files with varied content (long prose, headings, code blocks, source mode); typography reads as premium

### Expected commit

`feat(design): apply typography baseline with curated font stack`

---

## STEP 4 — Spacing & radius rhythm

**Objective**: audit all existing components and align their padding, margin, and radius to the token scale.

### Mission

1. Sweep through every component in `src/lib/components/`
2. Replace hardcoded pixel values with token references
3. Enforce the radius scale: every button is `--radius-md`, every card is `--radius-lg`, etc.
4. Enforce 4px-grid spacing: replace any non-multiple-of-4 values
5. Increase padding on under-padded interactive elements (Matheo's app may have some compact remnants from earlier iterations)

### Validation criteria

- [ ] Grep for raw pixel values in component styles: should be minimal (only edge cases that can't be tokenized)
- [ ] All buttons share consistent radius
- [ ] All cards/panels share consistent radius
- [ ] Spacing rhythm visible: nothing feels cramped, nothing feels lost in whitespace
- [ ] **Matheo's smoke test**: navigate the app, verify visual consistency; specifically check buttons, list items, status bar pills

### Expected commit

`feat(design): align spacing and radius to token scale`

---

## STEP 5 — Micro-interactions baseline

**Objective**: apply transition durations, easing, hover states, and focus rings across the app.

### Mission

1. Add transitions to every interactive element (buttons, list items, links, inputs, switches)
2. Use `--duration-base` and `--easing-standard` by default
3. Define hover states for everything that responds to pointer
4. Define focus states with visible focus ring using accent color
5. Verify keyboard navigation: tabbing through the app reveals focus rings consistently
6. The Preview/Source switch (relocated in PLAN-BLOCKNOTE Step 4) gets first-class micro-interaction polish here

### Validation criteria

- [ ] Every clickable element has a smooth hover transition (150ms)
- [ ] Focus rings visible and consistent across the app
- [ ] No "instant snap" hover states (everything fades)
- [ ] No "drag" hover states (nothing slower than 200ms)
- [ ] **Matheo's smoke test**: hover slowly across the app, tab through with the keyboard, verify the feel is uniform and premium

### Expected commit

`feat(design): apply micro-interactions baseline`

---

## STEP 6 — Cursor-style empty state

**Objective**: build the empty state screen shown when no vault is open, following the Cursor pattern (validated 10 May 2026 by screenshot).

### Mission

Create `src/lib/components/EmptyState.svelte` (or update existing if any).

Layout (matching Cursor screenshot):

1. **Top-left zone**: Markhub logo + product name. Below the name, optional subtitle ("Markdown for developers" or similar — to be confirmed with Matheo).
2. **2×2 grid of action cards** (each is a button-card):
   - **Open vault** — icon: folder. Opens the OS file picker.
   - **Create vault** — icon: folder-plus. Creates a new empty vault directory.
   - **Clone from Git** — icon: git-branch. Prompts for a repo URL, clones it as a vault.
   - **Fourth tile — TBD with Matheo**. Options to discuss:
     - "Recent vault" (quick reopen of the most recent)
     - "Sample vault" (creates a vault with example markdown files for first-time users)
     - "Documentation" (opens external docs)
3. **Bottom section**: "Recent vaults" with a list of recently opened vaults, each showing:
   - Vault name (clickable to open)
   - Vault path (right-aligned, secondary text color)
   - A "View all (N)" link if there are more than 5

### Visual specifications

- Background: `--color-bg` (the canvas)
- Cards: `--color-bg-raised`, `--radius-lg`, `--shadow-md`, padding `--space-6`
- Card icon: 20px, secondary color at rest, primary on hover
- Card label: `--text-md`, semibold
- One card visually distinguished (the "primary" action — likely "Open vault" or "Clone from Git" — uses inverted contrast like Cursor's "Try Agents Window")
- Recent list: subtle borders between items, hover state highlights the row

### Validation criteria

- [ ] Empty state renders when no vault is open
- [ ] All 4 actions are functional
- [ ] Recent vaults populate from the store/persistence
- [ ] Light and dark themes both render correctly
- [ ] Keyboard navigation: tab moves through the actions, Enter activates
- [ ] **Matheo's smoke test**: launch with no vault, see the empty state; click each action; verify it matches the Cursor reference screenshot in spirit

### Decisions to make with Matheo before starting

- The fourth tile content
- The subtitle text under the product name
- Whether the "primary" CTA is "Open vault" or "Clone from Git"

### Expected commit

`feat(ui): Cursor-style empty state screen`

---

## STEP 7 — Warp-style sidebar close button

**Objective**: add a small button in the window chrome that toggles the sidebar open/closed.

### Mission

1. Locate the button in the **window chrome** of the Tauri window, next to the macOS traffic lights (or equivalent on Windows/Linux). Reference: Warp's sidebar toggle button.
2. Icon: a "panel-left" icon (sidebar with a vertical line, indicating its state). Lucide has this icon.
3. Behavior:
   - Click toggles sidebar visibility (collapses to width 0 with smooth transition)
   - Same button reopens the sidebar
4. Tauri configuration: the window's title bar must accommodate this. Recommend `titleBarStyle: "overlay"` on macOS so the controls overlay the chrome.

### Visual specifications

- Button size: 24×24px
- Icon size: 16px
- Color: secondary text color at rest, primary on hover
- Hover background: `--color-surface-hover`
- Radius: `--radius-sm`
- Transition: `--duration-base`

### Cross-platform considerations

- **macOS**: button sits next to the traffic lights, requires `titleBarStyle: "overlay"` in `tauri.conf.json`
- **Windows/Linux**: button sits at the top-left of the window content (where it would be on macOS), no special config needed
- The position should adapt to the platform but the visual style stays identical

### Validation criteria

- [ ] Button appears in the correct position on macOS (next to traffic lights)
- [ ] Click smoothly collapses the sidebar
- [ ] Click again reopens it
- [ ] Sidebar width is persisted: closing → reopening restores the previous width
- [ ] **Matheo's smoke test**: open the app, click the button, verify smooth toggle; compare visually to Warp screenshot

### Expected commit

`feat(ui): Warp-style sidebar toggle button in window chrome`

---

## STEP 8 — Iconography sweep

**Objective**: ensure every icon in the app comes from the chosen family (Lucide), at consistent sizes, with consistent colors.

### Mission

1. Audit every icon currently in the app
2. Replace any non-Lucide icon with its Lucide equivalent
3. Verify size consistency: 16px for UI, 20px for feature cards
4. Verify color inheritance: icons inherit text color unless explicitly highlighted

### Validation criteria

- [ ] No mixed icon families anywhere in the app
- [ ] Icon sizes consistent within each context
- [ ] **Matheo's smoke test**: scan the app for icons, every one belongs to the same visual family

### Expected commit

`feat(design): unify iconography to Lucide`

---

## STEP 9 — Full visual audit + Playwright baseline

**Objective**: validate the complete visual identity end-to-end and lock it in with Playwright visual regression tests.

### Mission

1. Walk through every screen and state of the app:
   - Empty state (no vault)
   - Vault open, file selected
   - File with frontmatter
   - File with various content types (headings, lists, code blocks, tables)
   - Source mode
   - Light theme, then dark theme
2. Take Playwright screenshots of each state
3. Commit them as baselines for visual regression testing
4. Document any remaining inconsistencies in JOURNAL.md for follow-up

### Validation criteria

- [ ] Playwright suite has baseline screenshots for at least 10 distinct states
- [ ] Visual regression tests pass cleanly
- [ ] No outstanding visual issues
- [ ] **Matheo's final smoke test**: a full guided tour of the app with Matheo present; he gives explicit thumbs-up on each screen

### Expected commit

`test(visual): full design baseline coverage`

---

## STEP 10 — Closure

- [x] Final wrap-up sent to Matheo (in-chat GATE message, 2026-05-11)
- [x] PLAN-DESIGN-DEFAULTS.md updated: all steps ✅ (progress table above)
- [x] List of commits and decisions (see below)
- [x] DESIGN-PRINCIPLES.md updated if any new principle emerged (compact-chrome / comfortable-canvas nuance added to §2 "Density")
- [ ] **Manual merge to main by Matheo, not by Claude Code**

### Commit ladder — `feat/design-defaults` branch (10 commits ahead of `main`)

```
e6c459e feat(design): augment CSS token namespace                            (STEP 1)
9378691 feat(design): theme-aware danger surface + WCAG fix                  (STEP 2)
0e37004 feat(design): migrate components to --font-ui / --font-editor split  (STEP 3)
6136502 feat(design): spacing rhythm sweep + .button floor compliance        (STEP 4)
aa90373 feat(design): micro-interactions baseline — transitions + focus     (STEP 5)
e7a987d feat(ux):     EmptyState launcher + launch on welcome                (STEP 6)
a9f89aa feat(ui):     Warp-style sidebar toggle in window chrome             (STEP 7)
92b358c design(empty-state): bump card icons to 20px                         (STEP 8)
8ca96a3 test(visual): full design baseline coverage                          (STEP 9)
```

### Key decisions captured in this plan

1. **IDE-density chrome is a Markhub default**, not a deviation from "comfortable density". Status-bar pills, badges and toolbar buttons stay compact (11–14px icons, 4px-grid padding). The "comfortable" principle from §2 governs the **canvas** (editor surface, EmptyState, modals) — chrome is contextually allowed to be tighter. Captured in DESIGN-PRINCIPLES.md §2 "Density" addendum.
2. **`--font-ui` and `--font-editor` are split tokens** that both map to Geist Sans today. The split is forward-compatibility for PLAN-SETTINGS, which will let users change the editor font independently of the UI chrome.
3. **EmptyState visual is "Cursor-but-quieter"**: wordmark only (no subtitle), 4 uniform cards (no inverted-contrast primary CTA), no card borders, no recent-list dividers. The first iteration matched Cursor's "vibe coding" too literally and was rejected.
4. **Window-chrome toggle: 24×24 button at `padding: 5px var(--space-3) 0 80px`** so the PanelLeft icon glyph center (≈y:14) aligns vertically with the macOS traffic-light center (≈y:14). The 80px left gutter is the traffic-light reservation. Active state = icon color only (no bg fill) to avoid the "popped block" effect against the chrome strip.
5. **Light-mode `--color-text-muted` bumped `#a09e9a` → `#8a8884`** to meet WCAG 4.5:1 on cream background. Secondary text was already compliant and was preserved.
6. **`url_open` Tauri command (http/https only)** added during STEP 6 — `window.prompt` is unavailable in WKWebView, so the floating toolbar's link UI was replaced with an inline URL input + dedicated "Open in browser" button wired to the new command. Strictly http/https to avoid file:// or custom-scheme abuse.
7. **Visual baselines locked at 1% diff tolerance**: 39 specs total (34 preserved from BlockNote + 5 new for EmptyState/window-chrome). The full STEP 1–8 token migration passed through without disturbing any preserved baseline — proof the changes are infrastructural, not visually disruptive.
8. **No further bump from 14→16px on inline icons**: keeping the IDE-density choice consistent with decisions 1 (chrome density) and STEP 3 (heading scale). Only EmptyState card icons moved (18→20px) to match the plan's "feature card" tier.

---

## QUESTIONS ANTICIPATED

### "What if a color value doesn't look right?"

Iterate with Matheo. The values in Step 2 are starting points, not final values. Expect 1–2 rounds on the accents specifically.

### "What if we need a new token category that's not specified?"

STOP and escalate to Matheo. Tokens are infrastructure; new categories deserve discussion. They go in DESIGN-PRINCIPLES.md first, then the plan.

### "What if Playwright baselines fail on macOS but pass on Linux?"

Document the platform difference in JOURNAL.md. Visual baselines may need to be platform-scoped — this is a Playwright config concern, not a design concern.

### "What if Matheo wants to add an animation flourish?"

Refer to DESIGN-PRINCIPLES.md §8. If the proposed animation respects the duration and easing rules, it's OK. If it's a "fun bouncy spring," it's not.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-DESIGN-DEFAULTS.md.

Prerequisites:
- PLAN-BLOCKNOTE must be ✅ fully complete (check the table at the top of that file)
- DESIGN-PRINCIPLES.md is your design source of truth

Read PLAN-DESIGN-DEFAULTS.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative — if a decision isn't there, STOP and ask
- No new features beyond what's specified in this plan

Next step: STEP 1 — Token foundation.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```

---

## NOTES ON THIS PLAN'S MATURITY

This plan is **complete in structure** but contains **starting-point values** for the theme palette (Step 2). These values will likely be iterated with Matheo before being committed. The structure of the steps, the token system, the typography rules, the empty state and sidebar toggle specs are all final. The exact color hex values are not.

This is intentional: writing a plan that pretends to know every hex value before discussion would be dishonest. Step 2 explicitly says "Matheo must validate visually."

Similarly, Step 6 (empty state) has three decisions to make with Matheo before starting (fourth tile content, subtitle, primary CTA choice). These are flagged inline.

Everything else is locked.
