# DESIGN PRINCIPLES — MARKHUB

> **Status**: v0.1 — generated 2026-05-10. Reference document, not a workplan.
> **Purpose**: formalize the visual and interaction direction Markhub already follows, so it can be defended consistently against drift.
> **Scope**: this document is descriptive, not prescriptive of new directions. It captures the philosophy in place since the start of the project (Warp / Cursor / Linear inspiration) and gives Claude Code a clear charter.

---

## 1. POSITIONING — WHAT MARKHUB IS

Markhub is a **markdown editor for developers** that aims to make markdown a comfortable alternative to Word for everyday writing. The bet: markdown is portable, AI-readable, versionable, open — and if the editing experience is *better* than Word, not just equivalent, devs (and beyond) will adopt it.

Three commitments flow from this:

1. **Strict respect for markdown**. No layout features that don't exist in the spec. No proprietary blocks. No custom rendering that breaks portability. What you save on disk must be valid markdown, openable in any other editor.
2. **Visual and interaction comfort above the baseline**. Default typography, spacing, micro-interactions must already make the user *want* to write. Settings are leverage, not a crutch.
3. **Dev-tool DNA**. Vault = filesystem. Files = `.md` on disk. Git-friendly by construction. Keyboard-rich. Performant on large vaults. No proprietary format, no opaque database, no "sync via our cloud."

These three commitments form the spine. Every design decision is measured against them.

---

## 2. VISUAL UNIVERSE — THE THREE REFERENCES

Markhub belongs to a specific visual school: the modern premium developer-tool school of the last 3–4 years. Three references define the universe.

### Warp

What we take from Warp:
- **Window chrome design**. The small icon buttons next to the macOS traffic lights (sidebar toggle, etc.) are a Warp signature. Compact, monochrome, sit in the title bar without taking visual real estate.
- **Comfortable dark backgrounds**. Warp doesn't use pure black. The fill is a very dark gray with subtle warmth, never harsh.
- **Command surface centrality**. Warp puts the command/search palette at the heart of interaction. Markhub follows that for Cmd+K / Cmd+P.
- **Minimal but never empty**. Warp's empty states and idle states are calm, never sad or barren.

### Cursor

What we take from Cursor:
- **The empty state pattern**. The launch screen with logo, name, and a 2×2 grid of primary actions, plus a recent-projects list below. Sober, useful, no fluff. Direct inspiration for Markhub's empty state.
- **Raised surface treatment**. Cards, panels, modals are slightly raised on a darker base, with extremely subtle borders (often `rgba(255,255,255,0.06)` or similar). Never heavy shadows.
- **Restrained CTA contrast**. Primary buttons are visible without screaming. The "Try Agents Window" tile in Cursor's empty state is a perfect example: it stands out with light-on-dark contrast inversion rather than saturated color.
- **Density: comfortable in the canvas, compact in the chrome**. Cursor's defaults are generous in padding *on the writing surface*. Markhub matches that for the editor body, the EmptyState launcher, modals and dialogs — the surfaces the user *reads and writes in*. Chrome (status bar pills, badges, inline toolbar buttons, breadcrumb, mode toggle) is allowed to be IDE-tight: 11–14px icons, 4px-grid micro-padding, no minimum-touch-target floor. Compact density on the canvas is a future setting, not a default; compact density in chrome is the default. *(Nuance captured 2026-05-11 during PLAN-DESIGN-DEFAULTS STEP 4 + STEP 8 — emerged as a real tension when bumping pill paddings would have ballooned the status bar visually.)*

### Linear

What we take from Linear:
- **Typography discipline**. Inter (or close equivalent) as the UI font. Negative letter-spacing on display sizes (`-0.02em` to `-0.04em` on large titles) — this single detail separates premium tools from amateur tools.
- **Disciplined accent color**. Linear's purple/blue accent appears in very specific places: primary CTAs, active states, key focus indicators. It is never decorative.
- **Short, custom transitions**. 120–180ms is the sweet spot. Custom easing (`cubic-bezier(0.4, 0, 0.2, 1)` or sharper) on every state change.
- **Visible but elegant focus rings**. Not Chrome's default blue. A clean ring in the accent color or a subtle outline-style ring.
- **Consistent rounded corners**. Linear is rigorous: every component uses the same radius scale. No mixing 4px and 8px and 12px randomly.

### What the three share

These three tools agree on a grammar that Markhub adopts wholesale:

- Near-black backgrounds, not pure black (pure black reads as "90s computer screen")
- Raised surfaces with thin borders, not heavy shadows
- Sans-serif geometric typography (Inter, SF Pro, Geist, system stack)
- 4px-multiple spacing rhythm
- Restrained accent colors used as **signal**, not decoration
- Icon families: monoline, single-weight (Lucide, Phosphor, Heroicons)
- Subtle but always-present hover states
- Honest disabled states (specific opacity, not vague gray)

---

## 3. TYPOGRAPHY

### UI typography (sidebar, status bar, menus, modals)

**Default**: a clean geometric sans-serif. Inter is the safe bet (free, ubiquitous, performant). System fallback acceptable.

**Sizes**:
- Default UI text: 13–14px
- Small UI text (status bar, captions): 11–12px
- Section headers in sidebar/modals: 14–15px, medium weight

**Weights**: 400 (regular), 500 (medium for emphasis), 600 (semibold for headings). No 700+ in UI chrome.

**Letter-spacing**: 0 for body, slightly negative (`-0.01em`) for medium/semibold UI text at 14px+.

**The UI font is not user-configurable.** This is locked to preserve visual consistency. The user configures the editor font, not the UI font. (Decided in the Settings questionnaire, 10 May 2026.)

### Editor typography (the writing surface itself)

**Default**: a comfortable sans-serif optimized for reading. Inter works, but a slightly more literary alternative (e.g., a humanist sans like Source Sans, or a transitional serif) can be offered as a choice.

**The editor font IS user-configurable** with 4–5 curated choices, e.g.:
- Inter (default, modern sans)
- iA Writer Quattro (literary sans, very readable)
- A serif option (Charter, Source Serif, or similar)
- A mono option (JetBrains Mono, for users who prefer mono prose)
- One more curated choice TBD

**Editor sizes**:
- Default body: 16px
- User-adjustable via slider, range 14–20px
- Line height adjustable, range 1.4–1.8 (default 1.6)

### Heading typography (inside the editor, rendered by BlockNote)

Headings inherit the editor font family but get distinct treatment:

- **H1**: 28–32px, 600 weight, letter-spacing `-0.03em`, generous top margin
- **H2**: 22–24px, 600 weight, letter-spacing `-0.025em`
- **H3**: 18–20px, 600 weight, letter-spacing `-0.02em`
- **H4–H6**: smaller increments, same weight rules
- **No italic by default** on any heading (italic headings read as amateur)
- **No all-caps** (reserved for badges/labels, not headings)

### Source-mode typography (raw markdown view)

When the user toggles to Source mode (Preview/Source switch), the view uses a **monospace font** chosen from a curated list (2–3 options):
- Fira Code (default, ligatures available)
- JetBrains Mono
- Geist Mono

This mono is configurable in settings (v1 scope). Line height stays comfortable (1.6), no other typography settings exposed for source mode.

### Code blocks (inside the editor, in Preview mode)

Inline code and code blocks use the **same monospace font** as the user's selected source-mode font, for consistency. Background is `--color-bg-raised`, padding generous.

---

## 4. COLOR

### Philosophy

Color in Markhub is **functional**, not decorative. Five colors do most of the work; everything else is restraint.

The five working colors:
1. **Background** — the canvas
2. **Surface raised** — panels, sidebar, status bar
3. **Border** — thin separation lines
4. **Text** — primary, secondary, disabled
5. **Accent** — one accent color per theme, used as signal

### Theme structure

Each theme defines a complete token set. Themes are not "just colors swapped" — they are coherent palettes with intentional mood.

**Locked catalog** (4 themes — PLAN-THEMING v1 closed 2026-05-13):

1. **Markhub Light** — warm parchment off-white, near-black text, indigo accent (`#2563EB`). The default day theme.
2. **Markhub Dark** — warm near-black canvas (`#0A0908`), warm parchment text, blue accent (`#3B82F6`). The default night theme.
3. **Cocoa** — Anthropic-ivory parchment (`#F5F0DF`), deep cocoa text (`#2D2A26`), terracotta accent (`#C15F3C`). Light family alternative — elegant, warm-brown reading mood, Claude-inspired.
4. **Forest** — mossy forest floor (`#1C211B`), warm parchment text (`#E8E5CF`), refined dark-khaki accent (`#BDB76B`). Dark family alternative — outdoor heritage / Filson-catalog mood, never Army-surplus.

Catalog is **closed**: no fifth theme, no user-created themes, no import/export. Implementation lives in `src/styles/themes/<id>.css` scoped to `[data-theme="<id>"]`; metadata in `src/lib/theming/catalog.ts`.

All four themes:
- Pass WCAG AA contrast for body text
- Have a defined accent color that survives the contrast test on its own surface
- Render BlockNote, sidebar, status bar, modals consistently
- Are reachable from Settings → Appearance via the two-slot picker (light slot + dark slot) with a Follow-system / Always-light / Always-dark mode selector above

### Forbidden in MVP themes

- Pure `#000000` background (reads dated)
- Pure `#FFFFFF` background (too harsh — use `#FBFBFA` or similar)
- Saturated decorative colors (rose, lime, hot pink, etc.) as accents
- Gradients in chrome (gradients on accent badges OK, gradients on backgrounds no)
- Glassmorphism or heavy backdrop-filter effects
- More than one accent color per theme

### Accent usage rules

The accent color appears in:
- Primary CTA buttons
- Active/selected state indicators (e.g., active file in sidebar)
- Focus rings
- Drop indicators (block drag-and-drop)
- Link color in the editor
- Cursor in source mode

The accent **never** appears in:
- Body text
- Heading text (headings stay neutral)
- Borders (borders are neutral gray)
- Backgrounds (except on hover states of accented buttons)

---

## 5. SPACING AND RHYTHM

### Grid

Everything aligns to a **4px grid**. Padding, margin, gap, size — all values are multiples of 4. No 7px, no 13px, no random spacing.

### Common values

- `4px` — tight inline gap
- `8px` — default inline gap, button internal padding (vertical)
- `12px` — default vertical rhythm between related items
- `16px` — section spacing within a panel
- `24px` — major section spacing
- `32px` — top-level layout spacing
- `48px+` — page-level spacing (empty state, modals)

### Button and input padding

Minimum padding for interactive elements:
- Vertical: 8px
- Horizontal: 12px

This is the floor. Buttons in modals, primary CTAs, and important controls go up to `10px × 16px` or more. Tiny "compact" buttons are not in the default vocabulary.

### Editor content max-width

The writing area has a maximum measure (line width) configurable by the user. Defaults to roughly 680–720px (around 70–75 characters per line at default font size) for reading comfort. The user can widen it to 1200px or narrow it to 560px.

The **container itself** (header, sidebar layout) goes full width. Only the writing measure is constrained.

---

## 6. CORNER RADIUS

A consistent radius scale:

- **2px** — checkboxes, very small elements
- **4px** — input fields, small buttons
- **6px** — default buttons, dropdowns, slash menu items
- **8px** — cards, panels, modals
- **12px** — large containers (empty state cards, large modal frames)
- **9999px** — fully rounded (avatar circles, pill badges only)

**No mixing.** If buttons are 6px, all buttons are 6px. If cards are 8px, all cards are 8px.

---

## 7. BORDERS AND SHADOWS

### Borders

Borders are **thin** (1px) and **subtle** (very low opacity). In dark themes, borders are white at low alpha (`rgba(255,255,255,0.06)` to `rgba(255,255,255,0.10)`). In light themes, borders are black at low alpha (`rgba(0,0,0,0.06)` to `rgba(0,0,0,0.10)`).

Borders are used for:
- Separating raised surfaces from background (subtle inner border)
- Input field outlines
- Dividing menus and dropdowns from page

Borders are **not** used for:
- Decoration
- Adding visual weight to important elements (use raised surface + slight shadow instead)

### Shadows

Shadows are **layered and subtle**, never single hard drops.

Common shadow recipe for a raised surface:
```
box-shadow:
  0 1px 2px rgba(0, 0, 0, 0.04),
  0 4px 12px rgba(0, 0, 0, 0.06);
```

For floating menus (slash menu, dropdowns):
```
box-shadow:
  0 4px 16px rgba(0, 0, 0, 0.12),
  0 1px 2px rgba(0, 0, 0, 0.08);
```

In dark themes, shadows still work — they deepen the perceived separation. They are not removed.

**Forbidden**: heavy 10–20px drop shadows (reads cartoonish), neon glows (reads gaming), inset shadows on buttons (reads dated).

---

## 8. MICRO-INTERACTIONS

### Transition duration

- **Default**: 150ms
- **Faster (instant feel)**: 100ms — for hover states on small elements
- **Slower (deliberate)**: 200–250ms — for entering/exiting modals
- **Never longer than 300ms** in Markhub UI. Animations that drag are perceived as lag.

### Easing

Standard easing curve:
```
cubic-bezier(0.4, 0, 0.2, 1)
```

This is the "Material standard" curve. Used everywhere by default. Custom curves only for specific cases (bounce on success, spring on element drop — none of which exist in MVP).

### Hover states

Every interactive element has a hover state. The change is **subtle**:
- Buttons: background lightens slightly (or accent intensifies for accent buttons)
- Menu items: background fills with `--color-surface-hover`
- Links: underline appears (don't keep underline always visible in body text — reserve it for hover)

### Focus states

Keyboard focus is **always visible** and uses the accent color. Form controls and buttons have a focus ring (2px outline offset, accent color at 40% alpha). Skipping focus rings to look "cleaner" is forbidden — accessibility floor.

### Loading states

When something takes longer than ~200ms:
- Show a loading indicator (subtle spinner or progress bar)
- Disable the trigger element (with appropriate opacity)
- Never lock the entire UI

Saving has a special state: "Saving…" → "Saved ✓" with a brief transition. Already in place in the status bar.

---

## 9. ICONOGRAPHY

### Family

**One icon family**, used everywhere. Recommendation: **Lucide** (open source, modern, monoline, ~1000 icons, Svelte/React/Vue bindings, MIT license).

Acceptable alternatives if Lucide gaps appear:
- Phosphor Icons (similar style, deeper catalog)
- Heroicons (Tailwind ecosystem)

**Not mixed.** No "I'll just grab this one from Feather for this case." Stick to one.

### Size

- `14px` — inline icons in text (rare)
- `16px` — default UI icon size (buttons, menu items)
- `20px` — feature icons (empty state cards)
- `24px+` — illustrative icons (rare in Markhub, reserved for hero spots)

### Weight

Lucide ships at a single weight. Don't try to render heavy icons; the style is monoline thin.

### Color

Icons inherit text color by default. Active/highlighted icons get the accent color. Disabled icons get the disabled text color.

---

## 10. COMPONENT-SPECIFIC GUIDELINES

### Sidebar

- Background: `--color-bg-raised`
- Border-right: 1px subtle
- File items: 6px radius on hover, no radius at rest
- Active file: accent color background at low alpha + accent text color
- Vault dropdown at top: clear hierarchy, vault name in semibold

### Status bar

- Background: `--color-bg-raised` (matches sidebar)
- Border-top: 1px subtle
- Height: compact (28–32px)
- Text size: 11–12px
- Pills: 4px radius, subtle border, inline padding generous
- After Step 4 of PLAN-BLOCKNOTE: the Preview/Source switch is **removed from here** and lives in the top-right of the editor area instead

### Editor surface

- Background: `--color-bg` (the canvas, slightly darker than raised in dark mode, slightly lighter than raised in light mode — counter-intuitive but it's the Cursor/Linear pattern)
- No border around the writing measure
- Frontmatter `<details>` block: subtle raised treatment, collapsible

### Slash menu

- Background: `--color-bg-raised`
- Border: 1px subtle
- Shadow: floating-menu recipe (see §7)
- Item padding: `10px × 12px`
- Hover: `--color-surface-hover` background, radius 4px on the item
- Active (keyboard navigation): same as hover + thin accent border-left

### Modals

- Backdrop: black at 40–50% alpha (light theme) or black at 60–70% alpha (dark theme)
- Modal surface: 12px radius
- Close affordance: icon button top-right, never "X" text
- ESC key always closes

### Empty state (when no vault is open)

Follows the Cursor pattern (validated 10 May 2026):
- Centered logo + product name top-left
- 2×2 grid of action cards below
- Recent vaults list at the bottom with their paths
- Dark uniform background, no illustration
- One CTA card visually distinguished from the others (light fill, accent CTA)

---

## 11. WHAT MARKHUB IS NOT

To stay honest about positioning, here are explicit rejections.

**Markhub is not:**

- An Obsidian clone. Markhub does not aim for plugins, graphs, backlinks, daily notes. (Some of these may come later but are not the identity.)
- A Notion replacement. Markhub does not target collaborative real-time editing, comments, shared workspaces.
- An iA Writer competitor. Markhub does not target the literary scribe with focus mode and typewriter scrolling as identity features. (These may come as optional settings later.)
- A general-purpose document editor. Markhub does not have rich layout, custom fonts per paragraph, image cropping, or other Word-like features.
- A "beautiful markdown editor for bloggers." The aesthetic is dev-tool, not lifestyle-app.

**Markhub is:**

- A markdown editor for developers who write a lot.
- An everyday tool, opened multiple times a day, fast.
- A defender of `.md` as a portable, durable, AI-readable format.
- Visually aligned with Warp, Cursor, Linear.
- Boring in good ways (predictable, calm) and exciting in good ways (snappy, polished, premium-feeling).

---

## 12. HOW TO USE THIS DOCUMENT

### For Matheo

This is your reference when in doubt. "Should I add this feature? Should this button look like this? Should I introduce a new color?" → check against this doc. If the answer isn't here, the doc may need updating after discussion.

### For Claude Code

When generating any UI, follow this document as the source of truth. Do not invent new design directions. If a token, color, font, or interaction pattern is needed and not specified here, **stop and ask Matheo** before deciding.

### Updating this document

This document evolves, but **not casually**. Updates happen:
- After explicit design decisions made between Matheo and Claude (this assistant, not Claude Code)
- After a feature ships and reveals a missing principle
- After user feedback (later, when there are users)

Each meaningful update should be logged at the bottom of this file with date and rationale.

---

## CHANGELOG

- **2026-05-10** — v0.1 — Initial document generated. Captures the Warp/Cursor/Linear philosophy that has guided Markhub since the project's start. Locked the UI as non-configurable; defined the editor typography as user-configurable; established the 4-theme MVP scope; documented the locked four working colors and accent discipline.
