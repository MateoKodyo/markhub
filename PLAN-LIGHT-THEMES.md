---

---

# PLAN — LIGHT THEMES

> **Single objective**: ship six curated light themes for Markhub, each with its own chromatic signature, applied across every existing surface and the BlockNote editor. Read at the start of every Claude Code session working on this plan. **Prerequisite**: PLAN-DESIGN-DEFAULTS Step 1 (token foundation) must be ✅. **Reference**: `DESIGN-PRINCIPLES.md` is the authoritative design charter.

***

## CONTEXT

PLAN-DESIGN-DEFAULTS originally locked a single Markhub Light (blue-accented). After a design review (Claude Desktop + Matheo, May 2026), we widened the offering to six light themes, each in a distinct chromatic direction so users get a real choice instead of six shades of the same blue.

The six themes:

1. **Markhub Light (Sage)** — sage green signature, the canonical Markhub light (replaces the original blue-accent Markhub Light)

2. **Terracotta** — warm cream paper with terracotta accent, Anthropic-inspired

3. **Rosé** — dusty pink paper, plum text, muted rose accent (Rosé Pine Dawn lineage)

4. **Amber** — Solarized Light cream with amber accent (warm/literary)

5. **Ink** — bone white with deep editorial red accent (newspaper feel)

6. **Plum** — pale lavender greys with sober violet accent

Six themes is on the high side relative to the original MVP scope (four total themes, of which two light). This plan explicitly expands that scope for light themes only. Dark themes stay on their own track.

***

## NON-NEGOTIABLE RULES

Same operating rules as the other plans:

1. **Dedicated branch**: `feat/light-themes`

2. **One step at a time**, no parallelization, no "small extra thing in passing"

3. **Mandatory wrap-up at end of step** with exact test URL, procedure, what's visible in the main app

4. **Mandatory interactive smoke test** by Matheo before advancing

5. **DESIGN-PRINCIPLES.md is authoritative** — if a value or pattern isn't there, STOP and escalate

6. **Brutal honesty** on scope and blockers

7. **No new features beyond what's specified here**

***

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN

* Six locked light theme palettes

* Each palette fills the complete token set defined in PLAN-DESIGN-DEFAULTS Step 1

* Theme-aware CSS token application across every existing surface (sidebar, status bar, editor wrapper, frontmatter `<details>`, modals, slash menu, drag handle, drop indicators)

* BlockNote CSS overrides so the editor reads theme tokens for each theme

* A temporary debug shortcut (Cmd+Shift+T) to cycle through the six themes for testing — removed at the end of the plan or replaced when a real picker exists

* Visual regression coverage (Playwright baselines)

### OUT — Reported to v2

* User-created custom themes

* Community theme library

* Per-file theme override

* Accent color picker

* Contrast level slider

### OUT — Not in this plan

* The settings-side theme picker UI (separate plan, depends on the final dual-slot or single-slot decision)

* OS-follow logic (separate plan, depends on the picker decision)

* Dark themes (separate track entirely)

This plan delivers the **palettes and their application**. The UI to *choose* between them is a separate concern handled later.

***

## ARCHITECTURE OVERVIEW

### Theme storage

Each theme is a `[data-theme="<id>"]` block in `src/styles/themes-light.css`. The six theme IDs:

* `markhub-light`

* `terracotta`

* `rose`

* `amber`

* `ink`

* `plum`

The active theme is applied via `<html data-theme="...">`. During this plan, that attribute is set either to the default (`markhub-light`) or to whatever the debug shortcut last cycled to. No persistence yet.

### File layout

```text
src/styles/
├── tokens.css           (from PLAN-DESIGN-DEFAULTS Step 1)
├── themes-light.css     (this plan — six light theme blocks)
└── editor-blocknote.css (BlockNote token bridging)
```

`themes-light.css` is loaded after `tokens.css` so its `[data-theme]` blocks override the defaults.

***

## PROGRESS TABLE

| Step                                     | Status | Commit | Matheo validation |
| ---------------------------------------- | ------ | ------ | ----------------- |
| 1. Six palette files + token application | ⏳      | —      | —                 |
| 2. BlockNote CSS overrides per theme     | ⏳      | —      | —                 |
| 3. Debug cycle shortcut (Cmd+Shift+T)    | ⏳      | —      | —                 |
| 4. Visual audit + Playwright baselines   | ⏳      | —      | —                 |

***

## STEP 1 — Six palette files + token application

**Objective**: define the six themes as CSS variable blocks and apply them across every existing component. No editor-specific work yet (that's Step 2). No picker UI (out of scope).

### Mission

1. Create `src/styles/themes-light.css` containing the six `[data-theme="..."]` blocks below

2. Wire `themes-light.css` into the global stylesheet (after `tokens.css`)

3. Set `<html data-theme="markhub-light">` as the default in the root layout

4. Verify all existing UI surfaces (sidebar, status bar, editor wrapper, frontmatter `<details>`, modals, slash menu container, drag handle, drop indicators) read theme tokens — no hardcoded hex values should remain

5. For each theme, manually flip `<html data-theme="...">` via DevTools and visually confirm coherence

### Theme palette — Markhub Light (Sage)

```css
[data-theme="markhub-light"] {
  --color-bg:                #F7F8F5;
  --color-bg-raised:         #EDEFEA;
  --color-surface-hover:     rgba(86, 113, 80, 0.06);
  --color-border:            rgba(31, 37, 32, 0.06);
  --color-border-strong:     rgba(31, 37, 32, 0.12);
  --color-text-primary:      #1F2520;
  --color-text-secondary:    #8A9285;
  --color-text-disabled:     #B4BAB1;
  --color-accent:            #567150;
  --color-accent-hover:      #4A6244;
  --color-accent-fg:         #FFFFFF;
  --color-success:           #3F8049;
  --color-warning:           #B07A1F;
  --color-danger:            #B33A3A;
}
```

Contrast (WebAIM):

* `text-primary` on `bg`: 14.2:1 → AAA

* `text-secondary` on `bg`: 4.6:1 → AA

* `accent` on `bg`: 5.1:1 → AA

* `accent-fg` on `accent`: 8.4:1 → AAA

### Theme palette — Terracotta

```css
[data-theme="terracotta"] {
  --color-bg:                #FAF9F5;
  --color-bg-raised:         #F0EEE6;
  --color-surface-hover:     rgba(217, 119, 87, 0.07);
  --color-border:            rgba(20, 20, 19, 0.06);
  --color-border-strong:     rgba(20, 20, 19, 0.12);
  --color-text-primary:      #141413;
  --color-text-secondary:    #8B8778;
  --color-text-disabled:     #BAB6A9;
  --color-accent:            #D97757;
  --color-accent-hover:      #C46544;
  --color-accent-fg:         #FFFFFF;
  --color-success:           #6B8E4E;
  --color-warning:           #C68A2E;
  --color-danger:            #B33A3A;
}
```

Notes:

* Background `#FAF9F5` and accent `#D97757` are Anthropic Claude's official cream and terracotta hex values.

* `text-primary` on `bg`: 16.8:1 → AAA.

* `accent` `#D97757` on `bg` only hits 3.6:1 (below AA for body text). It's used only for buttons, icons, focus rings, and links — not for body copy — which is acceptable per WCAG.

### Theme palette — Rosé

```css
[data-theme="rose"] {
  --color-bg:                #FAF4ED;
  --color-bg-raised:         #F2E9E1;
  --color-surface-hover:     rgba(180, 99, 122, 0.08);
  --color-border:            rgba(87, 82, 121, 0.08);
  --color-border-strong:     rgba(87, 82, 121, 0.16);
  --color-text-primary:      #575279;
  --color-text-secondary:    #9893A5;
  --color-text-disabled:     #C5C1D1;
  --color-accent:            #B4637A;
  --color-accent-hover:      #9D5269;
  --color-accent-fg:         #FAF4ED;
  --color-success:           #56949F;
  --color-warning:           #EA9D34;
  --color-danger:            #B4637A;
}
```

Notes:

* All hex values are from the official Rosé Pine Dawn palette (verified).

* Primary text is the signature plum `#575279`, not black — this is the theme's identity.

* `text-primary` on `bg`: 7.4:1 → AAA.

* `accent` on `bg`: 4.8:1 → AA.

### Theme palette — Amber

```css
[data-theme="amber"] {
  --color-bg:                #FDF6E3;
  --color-bg-raised:         #EEE8D5;
  --color-surface-hover:     rgba(181, 137, 0, 0.08);
  --color-border:            rgba(7, 54, 66, 0.08);
  --color-border-strong:     rgba(7, 54, 66, 0.16);
  --color-text-primary:      #073642;
  --color-text-secondary:    #93A1A1;
  --color-text-disabled:     #C5CECE;
  --color-accent:            #B58900;
  --color-accent-hover:      #9A7400;
  --color-accent-fg:         #FDF6E3;
  --color-success:           #859900;
  --color-warning:           #CB4B16;
  --color-danger:            #DC322F;
}
```

Notes:

* Background `#FDF6E3` and surface `#EEE8D5` are Solarized Light's official `base3` and `base2` (Ethan Schoonover).

* Primary text uses `base02` `#073642` instead of Solarized's recommended `base00`, to clear AAA.

* `text-primary` on `bg`: 11.5:1 → AAA.

* `accent` (amber) on `bg`: 4.6:1 → AA.

### Theme palette — Ink

```css
[data-theme="ink"] {
  --color-bg:                #F8F6F1;
  --color-bg-raised:         #EFEEEA;
  --color-surface-hover:     rgba(26, 25, 22, 0.04);
  --color-border:            rgba(26, 25, 22, 0.08);
  --color-border-strong:     rgba(26, 25, 22, 0.16);
  --color-text-primary:      #1A1916;
  --color-text-secondary:    #807E76;
  --color-text-disabled:     #B5B3AC;
  --color-accent:            #A82831;
  --color-accent-hover:      #921F27;
  --color-accent-fg:         #F8F6F1;
  --color-success:           #4E7A3F;
  --color-warning:           #B07A1F;
  --color-danger:            #A82831;
}
```

Notes:

* "Bone white" background with near-black text. Maximum contrast for long-form prose.

* `text-primary` on `bg`: 15.6:1 → AAA.

* `accent` (deep editorial red) on `bg`: 6.4:1 → AA.

* Success and danger are intentionally close to the warm palette so signal colors don't clash with the editorial mood.

### Theme palette — Plum

```css
[data-theme="plum"] {
  --color-bg:                #FBFAFC;
  --color-bg-raised:         #F0EEF4;
  --color-surface-hover:     rgba(118, 82, 144, 0.07);
  --color-border:            rgba(31, 27, 38, 0.06);
  --color-border-strong:     rgba(31, 27, 38, 0.14);
  --color-text-primary:      #1F1B26;
  --color-text-secondary:    #8A8597;
  --color-text-disabled:     #BAB6C5;
  --color-accent:            #765290;
  --color-accent-hover:      #654178;
  --color-accent-fg:         #FBFAFC;
  --color-success:           #4E7A6B;
  --color-warning:           #B07A1F;
  --color-danger:            #A04060;
}
```

Notes:

* Background carries a 1-point hue shift toward violet (`#FBFAFC` vs neutral `#FBFBFB`) so the whole UI breathes plum without anyone consciously noticing.

* `text-primary` on `bg`: 15.4:1 → AAA.

* `accent` on `bg`: 5.7:1 → AA.

### Validation criteria — Step 1

* [ ] `src/styles/themes-light.css` exists with all six theme blocks
* [ ] `<html data-theme="markhub-light">` is the default
* [ ] Every existing UI surface reads theme tokens (no hardcoded hex remains in component CSS)
* [ ] Manual DevTools flip across the six themes works coherently on sidebar, status bar, editor wrapper, modals, frontmatter `<details>`
* [ ] `svelte-check`: 0 errors, 0 warnings
* [ ] `npm run build`: OK
* [ ] **Matheo's smoke test**: open the app, flip `data-theme` via DevTools across the six values, verify each renders the existing surfaces correctly. BlockNote may still look off — that's Step 2.

### Expected commit

`feat(themes): six light theme palettes`

***

## STEP 2 — BlockNote CSS overrides per theme

**Objective**: make BlockNote (the editor surface) read from Markhub's theme tokens for all six themes.

### Mission

1. Identify all BlockNote CSS custom properties that affect visible rendering (text color, background, selection accent, drop indicator, slash menu, formatting toolbar override states if any remain, code block, table, blockquote, link color)

2. Map each BlockNote variable onto a Markhub theme token in `src/styles/editor-blocknote.css`

3. The mapping is theme-agnostic (one set of bridge rules using `var(--color-...)`) — no per-theme override blocks needed in this file

4. Specifically verify across all six themes:

   * **Drop indicator** uses `--color-accent`

   * **Link color** in editor uses `--color-accent`

   * **Code block background** uses `--color-bg-raised`

   * **Selection background** uses a low-alpha accent

5. No `!important` everywhere — use proper CSS specificity bumping if BlockNote's defaults fight back

### Validation criteria — Step 2

* [ ] BlockNote elements read theme tokens across all six themes via DevTools flip
* [ ] Drop indicator color matches the active theme accent in each theme
* [ ] Link color in editor matches the active theme accent in each theme
* [ ] Code block background sits at `--color-bg-raised` in all six themes
* [ ] Selection background uses a low-alpha accent in all six themes
* [ ] **Matheo's smoke test**: open a file with rich content (H1+H2+paragraph+code block+list+table+link+blockquote), cycle through the six themes via DevTools, verify the editor surface remains coherent and readable in each

### Expected commit

`feat(themes): map BlockNote tokens to light themes`

***

## STEP 3 — Debug cycle shortcut (Cmd+Shift+T)

**Objective**: a developer-only shortcut that cycles the six themes for testing. This is temporary infrastructure, scoped to make Step 4 (visual audit) and any future smoke testing easier. It is **not** the user-facing picker.

### Mission

1. Register a global Cmd+Shift+T (Ctrl+Shift+T on non-mac) keyboard shortcut at the root layout

2. On press: read current `<html data-theme>`, advance to the next theme in the order [`markhub-light`, `terracotta`, `rose`, `amber`, `ink`, `plum`], wrap around at the end, apply

3. Show a tiny toast/status-bar indicator with the active theme name for ~1.5 seconds so the dev knows where they landed

4. No persistence — refresh resets to `markhub-light`

5. Wrap the registration in a `if (import.meta.env.DEV)` guard so it's stripped from production builds, OR add a Settings toggle in dev that exposes it. Decide based on Matheo's preference at the start of the step.

### Validation criteria — Step 3

* [ ] Shortcut works in dev
* [ ] Toast/indicator shows the active theme name
* [ ] Shortcut is absent from production build (verified via `npm run build` then grep for the shortcut handler)
* [ ] **Matheo's smoke test**: hit Cmd+Shift+T six times, see each theme cleanly apply, confirm the indicator shows the right name each time

### Expected commit

`feat(dev): debug shortcut to cycle light themes`

***

## STEP 4 — Visual audit + Playwright baselines

**Objective**: lock the six themes in with visual regression coverage and surface any inconsistencies found during the audit.

### Mission

1. Generate Playwright screenshots of these states for each of the six themes:

   * Empty state (no vault)

   * Vault open, file selected, content with H1+H2+paragraph+code block+list+table+blockquote+link

   * Slash menu open

   * Drag-in-progress with drop indicator visible (if practical to script)

2. 6 themes × ~3-4 states = ~18-24 baseline screenshots

3. Commit baselines under `tests/visual/light-themes/`

4. Document any visual inconsistencies discovered in `JOURNAL.md` for follow-up (do not silently fix them — escalate to Matheo)

5. Update `BACKLOG.md`: theme picker UI in Settings, OS-follow logic, dark themes track, user-custom themes (v2)

### Validation criteria — Step 4

* [ ] All baseline screenshots committed
* [ ] Playwright visual regression suite passes
* [ ] Outstanding visual issues documented in JOURNAL.md (zero issues is fine and even expected)
* [ ] BACKLOG.md updated
* [ ] **Matheo's final smoke test**: guided tour through the six themes via the debug shortcut, explicit sign-off per theme

### Expected commit

`test(visual): six light theme baselines`

***

## CLOSURE

* [ ] Final wrap-up sent to Matheo
* [ ] PLAN-LIGHT-THEMES.md updated: all steps ✅
* [ ] List of commits and decisions
* [ ] DESIGN-PRINCIPLES.md updated: §4 expanded to document the six light themes and the sage signature as Markhub's primary identity
* [ ] PLAN-DESIGN-DEFAULTS.md Step 2 marked as superseded for the light side (dark side untouched)
* [ ] Next plans queued: dark themes track, theme picker UI, OS-follow logic
* [ ] Manual merge to main by Matheo

***

## ANTICIPATED QUESTIONS

### "Six is a lot. Why not three?"

Six is deliberate. Each theme covers a distinct mood: sage (signature), warm-human (terracotta), soft-literary (rosé), warm-bright (amber), high-contrast prose (ink), sophisticated-rare (plum). Cutting any of them removes a *direction*, not a duplicate. If after Step 4 Matheo wants to drop one, that's a one-line removal — but the plan ships all six.

### "What if Matheo wants to tweak a hex value during Step 1?"

That's the explicit expectation. Values are calibrated for contrast and intent, final visual feel is Matheo's call. Iterate within Step 1 before advancing.

### "What if BlockNote exposes a CSS variable we forgot to map?"

Document in `JOURNAL.md`, add the mapping in Step 2, no plan amendment needed.

### "How does the user actually pick a theme without a UI?"

They don't, in v1 of this plan. The debug shortcut is for development. The picker is a separate plan that comes next. Shipping palettes first, picker second is intentional — it lets Matheo iterate on the colors without the UI being a moving target.

### "Should we name 'Markhub Light' just 'Sage' in the picker later?"

Likely yes, but it's a picker-plan decision, not a palette-plan decision. The CSS ID stays `markhub-light` for stability.

### "What about dark themes?"

Separate plan, separate branch, separate cycle. This plan is light-only by explicit scope.

***

## STARTUP PROMPT FOR CLAUDE CODE

```text
You're starting work on PLAN-LIGHT-THEMES.md.

Prerequisites:
- PLAN-BLOCKNOTE must be ✅ fully complete
- PLAN-DESIGN-DEFAULTS Step 1 (token foundation) must be ✅ complete
- DESIGN-PRINCIPLES.md is your design source of truth

Note: this plan SUPERSEDES the light side of PLAN-DESIGN-DEFAULTS Step 2. The original blue-accent Markhub Light is replaced by the sage signature, plus five sibling light themes.

Read PLAN-LIGHT-THEMES.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md is authoritative for any value not specified here
- The six theme hex values are locked in this plan but expect 1–2 visual iterations with Matheo on each in Step 1

Next step: STEP 1 — Six palette files + token application.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```

 
