# PAPER-TOKENS — design tokens reference for the Paper asset library

> Single source of truth for token values used in `markhub-assets.paper`. Mirrors `src/app.css` and `src/styles/themes/markhub-dark.css` exactly. Update this file the moment the CSS changes, then re-export the affected artboards.
>
> **Why this file exists** (and why tokens are not Paper variables): the Paper MCP server does not expose a tool to create or edit Paper variables programmatically. Until that capability ships (or until the user populates the Paper variables panel by hand), the agent uses this document as a virtual variable library and emits the literal values inline in `write_html` calls. See `OBSERVER-NOTES.md` § "MCP limitations" for details.
>
> **Theme scope**: only `markhub-dark` is reproduced in the asset library. The live app has 4 themes; the landing-page exports use Markhub Dark because it is the product's signature mood and matches the warm-near-black backdrop the landing copy plays against.

## Colors

### Backgrounds (3-tier hierarchy)

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg-sidebar` | `#060504` | Sidebar / chrome — most recessed |
| `--color-bg` | `#0a0908` | Main editor canvas / default body |
| `--color-bg-raised` | `#121110` | Popovers, dialogs, slash menu |

### Surfaces (translucent overlays on top of backgrounds)

| Token | Value | Role |
| --- | --- | --- |
| `--color-surface-veil` | `rgba(255,255,255,0.03)` | Panels, pills (default state) |
| `--color-surface-active` | `rgba(255,255,255,0.05)` | List item active state |
| `--color-surface-hover` | `rgba(255,255,255,0.025)` | Hover veil |
| `--color-surface-strong` | `#16151400` | (zero-alpha — reserved slot) |

### Borders

| Token | Value | Role |
| --- | --- | --- |
| `--color-border-strong` | `rgba(226,226,226,0.16)` | Containment, scrollbar thumb |
| `--color-border` | `rgba(255,255,255,0.08)` | Default panel border |
| `--color-border-subtle` | `rgba(255,255,255,0.04)` | Faint dividers |

### Text

| Token | Value | Role |
| --- | --- | --- |
| `--color-text-primary` | `#faf9f6` | Warm parchment — headings, primary text |
| `--color-text-body` | `#afaeac` | Ash gray — body reading |
| `--color-text-secondary` | `#868584` | Stone gray — meta / chrome |
| `--color-text-muted` | `#666469` | Tertiary, links |
| `--color-text-disabled` | `#4a4c50` | Disabled controls |

### Buttons (chrome button surface)

| Token | Value | Role |
| --- | --- | --- |
| `--color-button-bg` | `#353534` | Earth gray |
| `--color-button-text` | `#afaeac` | Body color on buttons |
| `--color-button-bg-hover` | `#3f3f3e` | Hover state |

### Accent (the only saturated color in the app)

| Token | Value | Role |
| --- | --- | --- |
| `--color-accent` | `#3b82f6` | Primary CTA, focus ring, active highlights |
| `--color-accent-hover` | `#4f8ff7` | CTA hover |
| `--color-accent-text` | `#ffffff` | Text on accent |
| `--color-accent-fg` | `#ffffff` | Alias of `--color-accent-text` |
| `--color-selection` | `rgba(59,130,246,0.32)` | Text selection background |

### Status

| Token | Value | Role |
| --- | --- | --- |
| `--color-status-ok` | `#4ade80` | Success dot, toast OK |
| `--color-status-warn` | `#fbbf24` | Warning |
| `--color-status-error` | `#f87171` | Error / destructive |
| `--color-success` | alias of `--color-status-ok` | |
| `--color-warning` | alias of `--color-status-warn` | |
| `--color-danger` | alias of `--color-status-error` | |
| `--color-danger-bg` | `rgba(248,113,113,0.08)` | Destructive header bar in `ConfirmDialog` |
| `--color-danger-border` | `rgba(248,113,113,0.25)` | Destructive borders |

### Backdrop

| Token | Value | Role |
| --- | --- | --- |
| `--color-backdrop` | `rgba(0,0,0,0.5)` | Modal / overlay backdrop |

## Shadows

| Token | Value |
| --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.2)` |
| `--shadow-md` | `0 1px 2px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.22)` |
| `--shadow-lg` | alias of `--shadow-popover` |
| `--shadow-popover` | `0 4px 16px rgba(0,0,0,0.35)` |
| `--shadow-xl` | `0 8px 24px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.25)` |

## Ambient gradient

`--gradient-ambient` — applied to `body`, gives the Warp warm-edge / cool-corner glow:

```css
radial-gradient(ellipse 1200px 600px at 50% -20%, rgba(255,170,110,0.06), transparent 60%),
radial-gradient(ellipse 800px 600px at 100% 110%, rgba(140,100,200,0.05), transparent 55%);
```

## Typography

### Font families

| Token | Value |
| --- | --- |
| `--font-sans` | `'Geist Variable', system-ui, -apple-system, 'Helvetica Neue', sans-serif` |
| `--font-mono` | `'Geist Mono Variable', 'SF Mono', 'Monaco', 'Cascadia Code', monospace` |
| `--font-ui` | alias of `--font-sans` |
| `--font-editor` | alias of `--font-sans` |

Paper accepts Google Fonts by name — use `"Geist", system-ui, sans-serif` and `"Geist Mono", monospace` inline (Variable suffix is optional in Paper; the Google delivery does the variable interpolation).

### Font size scale (IDE-calibrated + t-shirt aliases)

| Token | Value |
| --- | --- |
| `--text-micro` | `10px` |
| `--text-label` | `11px` |
| `--text-caption` | `12px` |
| `--text-ui` | `13px` |
| `--text-body` | `14px` |
| `--text-md` | `16px` — editor body default |
| `--text-subheading` | `18px` |
| `--text-xl` | `20px` |
| `--text-heading` | `24px` |
| `--text-display` | `32px` |

Aliases (same values, t-shirt naming):

`--text-xs` = `--text-label` (11px) · `--text-sm` = `--text-caption` (12px) · `--text-base` = `--text-body` (14px) · `--text-lg` = `--text-subheading` (18px) · `--text-2xl` = `--text-heading` (24px) · `--text-3xl` = `--text-display` (32px)

### Line heights

| Token | Value | Use |
| --- | --- | --- |
| `--leading-tight` | `1.3` | Heading display |
| `--leading-normal` | `1.5` | UI body |
| `--leading-relaxed` | `1.6` | Editor body |
| `--leading-loose` | `1.8` | Long-form reading |

### Letter spacing (tracking)

| Token | Value | Use |
| --- | --- | --- |
| `--tracking-display` | `-0.4px` | 32px headings |
| `--tracking-heading` | `-0.3px` | 24px headings |
| `--tracking-body` | `0px` | Body |
| `--tracking-ui` | `0px` | UI |
| `--tracking-caption` | `0.4px` | Caption / chrome |
| `--tracking-label` | `1.4px` | Uppercase micro-labels |

### Weights

| Token | Value |
| --- | --- |
| `--weight-regular` | `400` |
| `--weight-medium` | `500` |

Regular is the dominant weight across the app; Medium is reserved for buttons and active emphasis. Heavier weights are not used.

## Radius

| Token | Value |
| --- | --- |
| `--radius-xs` | `4px` |
| `--radius-sm` | `6px` |
| `--radius-md` | `8px` |
| `--radius-lg` | `10px` |
| `--radius-xl` | `12px` |
| `--radius-pill` | `50px` |

## Spacing (4px base, IDE density)

| Token | Value |
| --- | --- |
| `--space-0-5` | `2px` |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-7` | `32px` |
| `--space-8` | `48px` |
| `--space-9` | `64px` |

## Editor content layout

| Token | Value |
| --- | --- |
| `--content-max-width` | `60%` |
| `--content-padding-x` | `64px` |

## Pills (status bar, segmented controls)

| Token | Value |
| --- | --- |
| `--pill-bg` | alias of `--color-surface-veil` |
| `--pill-bg-hover` | alias of `--color-surface-hover` |
| `--pill-bg-active` | alias of `--color-surface-active` |
| `--pill-fg` | alias of `--color-text-secondary` |
| `--pill-fg-active` | alias of `--color-text-primary` |
| `--pill-radius` | alias of `--radius-sm` (6px) |
| `--pill-padding-x` | `8px` |
| `--pill-padding-y` | `3px` |
| `--pill-gap` | `4px` |
| `--pill-height` | `24px` |

## Motion (not visible in static artboards but recorded for completeness)

| Token | Value |
| --- | --- |
| `--duration-fast` | `100ms` |
| `--duration-base` | `150ms` |
| `--duration-slow` | `200ms` |
| `--easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |

## Quick semantic legend (for landing-page picks)

- **Hero backgrounds**: `--color-bg` with `--gradient-ambient` overlay.
- **Chrome / sidebar shots**: `--color-bg-sidebar`.
- **Modal / popover shots**: `--color-bg-raised` with `--shadow-popover` and `--color-backdrop`.
- **Primary CTA**: `--color-accent` background, `--color-accent-text` label, `--radius-sm`.
- **Headings on canvas**: `--font-sans`, `--weight-regular`, color `--color-text-primary`, tracking `--tracking-display` / `--tracking-heading`.
- **Body / paragraph**: `--font-sans`, `--text-md` (16px), color `--color-text-body`, line-height `--leading-relaxed`.
- **Code blocks / inline code**: `--font-mono`, `--text-body`, color `--color-text-primary` on `--color-surface-veil` background.
