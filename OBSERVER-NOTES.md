# OBSERVER NOTES — porting a UI into Paper via MCP

> Living log of practical observations while operating on a Paper file via the MCP server. Written in **portable voice** (the user, the project, the codebase) so this document can be lifted directly into a future shareable skill. No project-specific names unless strictly necessary.

## Purpose

These notes are gathered while reproducing a real application's UI inside Paper.design as an asset library. They capture the friction points, conventions that work, and gotchas — the kind of knowledge that doesn't live in any official guide but matters when doing the work end-to-end.

## Setup conventions that worked

### Process state

- Paper Desktop must already be running and the target `.paper` file must already be open in it before the agent session starts. The Paper MCP server is local (`http://127.0.0.1:29979/mcp`) and the CLI tests the connection **once at session boot**. If the server wasn't reachable at that moment, the connection status stays `Failed` until the agent session is restarted — there is no hot-reconnect.
- Practical consequence for the user: launch Paper Desktop first, open the target file, **then** start the agent session.

### File creation

- The user creates and opens the `.paper` file themselves via Paper Desktop's File → New menu. The MCP server does not expose a tool to create or open a file from the agent side; it only operates on whatever document is currently open.
- The agent identifies the active file via `get_basic_info` (returns `fileName`, `pageId`, `rootNodeId`).

### MCP round-trip validation

A minimum round-trip is worth doing before any real work, as a smoke test of the agent ↔ Paper Desktop pipeline:

1. `get_basic_info` — confirm the expected file is open, `artboardCount: 0` for a fresh file.
2. `create_artboard` — small probe artboard, e.g. 320×180 with a centered label.
3. `write_html` — insert a recognizable text into the probe artboard.
4. `get_screenshot` — verify the agent sees what the user sees on canvas.
5. `delete_nodes` — remove the probe artboard.
6. `get_basic_info` — re-confirm `artboardCount: 0`.

Total cost: 6 MCP calls. Well within reasonable budget.

## Tool behavior — first session observations

### `get_basic_info`

- Cheap, idempotent. Returns the page id, the root node id (used as a parent for top-level operations), and a list of artboards. Use it as the first call of any session and as a verification step after destructive operations.

### `create_artboard`

- Returns the artboard's node id, plus its position (`top`, `left`) and size. The position is auto-chosen by Paper to land in the next empty slot on the canvas — the agent does not control it. The artboard always becomes a top-level node on the page; its parent is implicitly the page root.
- The `styles` object must include `width` and `height` in `px`. The artboard defaults to `display: flex; flexDirection: column;` if not specified — useful default.

### `write_html`

- Targets an existing node id (typically the artboard id when first populating it). Uses `mode: "insert-children"` to append, or `mode: "replace"` to swap the node with the new HTML.
- The first call into an artboard typically creates a wrapping `<div layer-name="...">` to act as a content frame inside the artboard's flex layout. This is the cleanest pattern for later editing — addressing the content frame by its layer name rather than mixed top-level children.
- Only inline styles are supported. No external CSS, no class selectors, no CSS variables at the HTML level (Paper variables are referenced via the Paper UI, not in HTML strings — TBD in a later step).

### `get_screenshot`

- Default scale `1` is enough to verify layout. `scale: 2` is reserved for fine-detail inspection. Returns JPEG by default; pass `transparent: true` for PNG with alpha.
- Always screenshot after a non-trivial mutation. It is the cheapest way to keep the agent and the user looking at the same thing.

### `delete_nodes`

- Recursive. Deleting an artboard deletes all descendants. Returns the list of deleted ids.
- After a delete, immediately re-run `get_basic_info` to verify the canvas state matches the intended one. The Paper UI might have other in-flight selections.

### `finish_working_on_nodes`

- Required per Paper's own guide at the end of any work session: it removes the "agent is working on this" indicator from the canvas. Call with no arguments to release all indicators at once. Cheap, no-op if nothing was being marked.

## Save behavior

- Paper Desktop saves the open file automatically as edits happen — there is no need to issue a manual save command from the agent side. The probe round-trip above (create artboard → screenshot → delete) leaves the on-disk file in the empty state it was at session start; the user does not need to issue Cmd+S.
- Practical consequence: a session that ends mid-work leaves the canvas in whatever state the last tool call put it in. If a step's wrap-up is "the canvas should look like X at this point", that state is durable.
- Caveat (not yet observed firsthand): the user might still see a Save indicator in the title bar briefly while saving happens. This has not blocked any operation.

## Costs and budget

- Paper's free tier allows roughly **100 MCP calls per week**. A round-trip validation step costs ~6 calls; a real production step (multi-artboard build with screenshots and review checkpoints) can cost 20–40 calls easily.
- Implication: pace the work, batch screenshots only after meaningful mutations, and prefer cloning (`<x-paper-clone>`) over re-emitting equivalent HTML when a similar element already exists on canvas.

## Design conventions that travel

These hold regardless of the project being ported:

- **Single asset file**: keep every artboard in one `.paper` file. Paper has no concept of branches, so exploration on top of an asset library happens by duplicating the file (`<base>-explo-<name>.paper`), never by mutating it in place.
- **Artboard naming**: use slash-separated namespaces (`chrome/sidebar`, `screen/empty-state`, `modal/confirm-delete`). It scales beyond ~20 artboards and lets the user filter mentally without searching.
- **Tokens upstream**: the codebase remains the single source of truth for design tokens. Paper variables mirror them by name — they are never edited inside Paper.
- **No invention**: when porting an existing UI, the live app is the reference, not a redesigned interpretation. If a measurement is unclear, screenshot the live app and match visually.

## MCP limitations

### No variable-creation tool

The Paper MCP surface exposes node operations (create/update/move/delete artboards and frames, write inline-styled HTML, get screenshots, get JSX/styles) but **no tool to create, read, or set Paper variables**. The tools available at the time of writing are: `get_basic_info`, `get_selection`, `get_children`, `get_tree_summary`, `get_node_info`, `get_jsx`, `get_computed_styles`, `get_fill_image`, `get_font_family_info`, `get_screenshot`, `get_guide`, `create_artboard`, `write_html`, `update_styles`, `set_text_content`, `rename_nodes`, `move_nodes`, `duplicate_nodes`, `delete_nodes`, `export`, `export_combined_pdf`, `finish_working_on_nodes`.

Practical consequence: when a plan calls for "import design tokens into Paper as variables", the agent cannot do that programmatically. Three workable strategies:

1. **Code-side reference document** (chosen here): maintain a structured tokens reference file in the project repo (`PAPER-TOKENS.md` or equivalent). The agent emits the literal values inline in `write_html` calls, sourcing them from the reference document. The codebase remains the single source of truth; Paper just holds the rendered output.
2. **Manual paste**: the user opens Paper's variables panel and pastes the tokens by hand, then style values in artboards bind to them through the Paper UI. The agent still emits inline values when writing HTML (variable binding is a UI-only action), but the user can later rebind through Paper's bindings drawer.
3. **Wait for the capability**: skip variables entirely until the MCP grows a `set_variables` tool (Pencil already has one — Paper might catch up).

Strategy 1 is the only one that's fully agent-driven and survives a future MCP change without rework.

### Naming convention for the reference document

- Mirror CSS token names exactly. `--color-bg-raised` → `color-bg-raised` (drop the leading `--`).
- Keep semantic aliases (`--font-ui`, `--text-base`, etc.) — they document intent, not just values.
- Note which tokens are theme-scoped (per-theme CSS) vs theme-agnostic (`:root`).

## Open questions for later steps

- What's the cleanest pattern for "instances" of a chrome element across multiple screen artboards? Paper components vs. paste-and-bind — unclear from STEP 1 alone. Tentative answer after STEP 3: there is no component / library concept exposed via the MCP. The path forward for full screens (STEP 4) is `duplicate_nodes` of the chrome artboards into the screen artboard, then `update_styles` on the children whose state needs to change. This preserves node identity (handy) but does NOT create live bindings — a later edit on the chrome artboard does not propagate to the duplicates. Document the duplicate→update workflow in STEP 4 and confirm.
- Cost behavior of `write_html` calls: are large multi-element HTML strings billed as one call or many? STEP 3 emitted some chunky HTML (e.g. the status bar zone-left's 4 pills) in single calls; node count grew by ~15 each time without obvious throttling. Tentative answer: one call billed regardless of HTML size, but readability still favors smaller calls per the guide's "show real-time progress" principle.
- Does `export` to PNG via MCP respect the canvas zoom or always render at the artboard's nominal dimensions? Affects STEP 9.

## Review pass observations (post-STEPS 1–8)

A systematic screenshot review of all 18 artboards surfaced a layered picture:

### Things that worked well

- **Chrome strip artboards** — sidebar, status-bar, window-controls, tabs-bar — render faithfully once the Lucide icons are pulled verbatim. Vertical lane alignment across file rows is clean, vault dots + names + lock affordance read at the live app's intended subtlety.
- **Screens** — empty-state (Cursor-style), file-view (frontmatter card + scaled headings + code block + table), settings (rail + theme picker grid) — composition is balanced. The dark canvas with the warm gradient ambient (when applied) reads as the live product, not a generic SaaS sample.
- **Modals + menus** — confirm-delete with danger-bg header, input-dialog with focus accent + caret, context-menu with separator + danger color on Supprimer, vault-dropdown with hotkey hints — these all rendered at near 1:1 fidelity with the Svelte components.

### Things that did not work (Paper MCP limitations confirmed during review)

1. **`<x-paper-clone>` does not preserve nested flex layout precisely.** Cloning the full `screen/file-view` artboard as the backdrop for `palette/cmd-k`, `cmd-p`, `cmd-shift-f` works well when a large overlay covers the top half of the canvas — the underlying clone is visible but mostly hidden. For `palette/find-in-doc` where only a thin find-bar overlays the canvas, the cloned editor canvas exhibits visible overlap/wrap artifacts (H1 and intro paragraph rendering on the same horizontal lane, code block content overlapping itself). The internal `width: 60%; max-width: 760px; padding: 32px 64px;` constraints on the source's `.editor-canvas` are not faithfully inherited into the clone's layout pass. Workarounds, in order of preference:
   - Add a 0.5+ alpha backdrop layer between clone and overlay (used for cmd-k/cmd-p/cmd-shift-f).
   - For overlays where most of the canvas remains visible (find-in-doc), accept the artifact OR replace the clone with a minimal `placeholder-canvas` div that suggests editor content without re-emitting the full structure.

2. **Inline `<span>` styles in body text don't always render distinctly in Paper.** The BlockNote showcase paragraph used `<span style="font-weight:500">bold</span>`, `<span style="font-style:italic">italic</span>`, `<span style="text-decoration:line-through">strike</span>`, `<span style="color:#3b82f6">link</span>` inline — at scale 1 the visual distinction is subtle to the point of being absent for `bold` and `strike`. The Paper guide does mention "Rich text isn't supported in Paper" — this is the confirmation. Workaround: for landing-page hero showcases, isolate each inline annotation onto its own block-level element with surrounding context, rather than inline.

3. **State variants in the same artboard are subtle to the point of invisibility on dark themes.** `surface-hover` at `rgba(255,255,255,0.025)` is barely a 1.6% lightness lift above `bg-sidebar` (#060504). Faithful to the live app's IDE-restrained aesthetic, but for asset-library use the hover state may need an artificial bump (e.g. 0.06 instead of 0.025) to be readable in landing-page screenshots. Decision: keep faithful subtlety in the asset library; produce dedicated `inline/sidebar-states` boosted-variant artboard later if landing copy needs to highlight the state explicitly.

### Things that were missed in first pass and added during review

- `screen/empty-state` initially shipped without a file tree in the sidebar — only the FICHIERS header + filter row. The live app shows the file tree whenever an active vault is selected, regardless of whether a file is open. Fixed mid-review with 4 sample rows.

## Conventions adopted in STEP 3 (after rework)

- **SVG inline icons** instead of importing a per-icon asset library. Markhub's Svelte components use `lucide-svelte`; the MCP `write_html` accepts inline SVG with viewBox 0 0 24 24 + `stroke="currentColor"` + `stroke-width="1.5"`.

### Icon fidelity — hard-won lesson

The first STEP 3 pass redrew icons from memory and produced visible drift (FileText body missing, Settings gear approximated, Lock half-rendered). The fix path is mechanical and worth documenting:

1. **Open `node_modules/lucide-svelte/dist/icons/{kebab-name}.svelte`** for every icon the Svelte source imports. The file contains a single relevant line: `const iconNode = [["path", { "d": "..." }], ...]` — the verbatim SVG primitive list.
2. **Follow alias chains**. Some icon names are stable JS aliases pointing to renamed Svelte files: `Code2 → code-2.js → code-xml.svelte`, `AlertCircle → alert-circle.js → circle-alert.svelte`. The `.js` file contains a one-line `export { default } from "./TARGET.svelte"` — follow it.
3. **Emit verbatim**. Translate the `iconNode` array into inline SVG: `["path", {"d": "..."}]` → `<path d="..."/>`. Order and attributes must match.
4. **Stroke styling stays at the wrapper**: `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"` on `<svg>`, never on individual paths. Lucide assumes this.

Pitfall: typing path data from memory feels fast but breaks on the next code review. Two minutes of grepping the iconNode line saves an hour of rework.

### Bash recipe for batch icon extraction

```bash
for icon in plus search lock chevron-down chevron-right file-text folder folder-open file-plus folder-plus file-input copy check download monitor moon sun settings pencil save loader eye panel-left panel-right x; do
  printf '=== %s ===\n' "$icon"
  grep -h "const iconNode = " "<path>/node_modules/lucide-svelte/dist/icons/${icon}.svelte" 2>/dev/null
done
```

For aliased icons (Code2, AlertCircle):
```bash
grep "from" "<path>/.../code-2.js"  # → code-xml.svelte
grep "const iconNode = " "<path>/.../code-xml.svelte"
```
- **Artboard dimensions match shipped element sizes**: 280×900 for the sidebar (sidebar's natural full-window-height), 1440×38 for the status bar, 1440×44 for the window-chrome strip, 1440×32 for the tabs bar. Avoids the "drawn-at-a-screen-size-then-cropped" feel and keeps the exports at 1:1 with the live app.
- **Layer names follow component intent, not visual placement**: `vaults-section`, `vault-row-active`, `tab-bar-scroll`, `mode-toggle` — names match the CSS classes / Svelte component names so a future "find this in the codebase" pass is trivial.
- **State variants in the same artboard, not separate artboards**: the sidebar artboard contains rest, hover, and active list items in the same visible tree (rather than 3 separate sidebar artboards). Keeps the asset library tight and avoids artboard sprawl. Will revisit if a state needs full-screen context (e.g. modal backdrop).
