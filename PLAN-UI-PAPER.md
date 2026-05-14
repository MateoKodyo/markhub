---

---

# PLAN — UI PORT TO PAPER

> **Single objective**: port Markhub's current UI into Paper (paper.design) to obtain a faithful **v0 reference**, then use Paper as the playground for UI/UX explorations driven by Claude Code via MCP. Read at the start of every Claude Code session working on this plan. **Mirror plan**: `PLAN-UI-PORT-PENCIL.md` — same steps, same validation criteria, same scope. Only the tool and the workflow specifics differ. The point of running both is to compare the two tools honestly on identical work. **Reference**: `DESIGN-PRINCIPLES.md` defines what the UI must look like. This plan is about reproducing it inside Paper, not redefining it.

***

## CONTEXT

Markhub's UI is built in Svelte and currently runs in a Tauri shell. Iterating on UI/UX inside the live codebase is slow: every "what if" requires editing Svelte, rebuilding, and reviewing. The goal is to offload exploration to a design canvas that can be modified surgically by Claude Code via MCP, while keeping the Svelte codebase clean and stable.

Paper is one of two candidates. The other is Pencil. Both plans are run independently to evaluate which tool produces the better iteration loop for Markhub. **No conclusion is drawn until both plans are complete.**

***

## TOOL PROFILE — PAPER

Key facts that shape this plan:

* Paper is a **standalone desktop app**. It does not live in the IDE.

* Files are stored locally (or on Paper's cloud); they are **not** in the project's Git repo.

* Paper exposes an **MCP server** that Claude Code can connect to. Claude Code reads and modifies the open canvas through MCP tool calls.

* The canvas renders **real HTML/CSS**. Exports are "Copy as React" / HTML.

* Free tier limit: **100 MCP calls per week**. Plan accordingly.

* No native versioning. Duplication is the cheap way to snapshot.

### Decision on v0 protection — Snapshots

Because Paper has no native Git integration and lives outside the repo, we protect v0 with **file snapshots**:

* `markhub-v0.paper` — the locked reference. Never edited after Step 5.

* `markhub-explo-<name>.paper` — one file per exploration, duplicated from v0.

This enables side-by-side comparison (open two Paper windows) and avoids any risk of v0 corruption. It costs disk space; that's acceptable.

***

## NON-NEGOTIABLE RULES

Same operating discipline as `PLAN-BLOCKNOTE.md`:

1. **Dedicated branch**: `feat/ui-port-paper` (only used for Markhub-side artifacts: scripts, screenshots, plan updates). Paper files live outside the repo.

2. **One step at a time**, no parallelization.

3. **Mandatory wrap-up format** at the end of each step:

```text
═══════════════════════════════════════════════════
✅ STEP X COMPLETED (PAPER)
═══════════════════════════════════════════════════

WHAT WAS DONE
[list]

MCP CALLS USED THIS WEEK
[N / 100]

⚠️ HOW MATHEO TESTS THIS LIVE ⚠️

OPEN PAPER:
1. Launch Paper desktop app
2. Open file: [exact filename]

TEST PROCEDURE:
1. [action]
2. [expected visual]

SCREENSHOT
[Claude Code attaches a screenshot taken via MCP if possible, OR describes the canvas state precisely]

COMPARISON WITH MARKHUB LIVE APP
[side-by-side notes: what matches, what doesn't]

DECISIONS MADE
[list]

⏸ AWAITING YOUR SMOKE TEST + VALIDATION BEFORE PROCEEDING.
```

4. **Mandatory smoke test by Matheo**: Matheo opens Paper, compares against Markhub running on `localhost:1420`, validates.

5. **No hacking around**: if Paper's MCP can't do something cleanly, STOP and escalate. Do not fake the output.

6. **Brutal honesty**: if a step exceeds the MCP weekly budget or reveals a tool limitation, say so immediately.

7. **No design drift**: this plan reproduces the existing Markhub UI as defined by `DESIGN-PRINCIPLES.md`. It does not redesign anything. Explorations happen **after** v0 is locked, in separate files.

***

## PROGRESS TABLE

| Step                                                  | Status | Output file                | Matheo validation |
| ----------------------------------------------------- | ------ | -------------------------- | ----------------- |
| 1. Setup + MCP connection                             | ⏳      | —                          | —                 |
| 2. Design tokens import                               | ⏳      | `markhub-wip.paper`        | —                 |
| 3. Chrome port (sidebar, status bar, window controls) | ⏳      | `markhub-wip.paper`        | —                 |
| 4. Editor surface port                                | ⏳      | `markhub-wip.paper`        | —                 |
| 5. v0 snapshot lock                                   | ⏳      | `markhub-v0.paper`         | —                 |
| 6. Iteration loop test                                | ⏳      | `markhub-explo-test.paper` | —                 |
| 7. Comparative assessment                             | ⏳      | `ASSESSMENT-PAPER.md`      | —                 |

***

## STEP 1 — Setup + MCP connection

**Objective**: Paper installed, MCP server running, Claude Code able to read/write the canvas. No content yet.

### Mission

1. Install Paper desktop app.

2. Create an empty file `markhub-wip.paper`. Leave it open.

3. Configure the Paper MCP server (follow Paper's docs at `paper.design`).

4. Add the MCP entry to Claude Code's MCP config.

5. From Claude Code, verify the connection: list available Paper MCP tools, read the current canvas state (should be empty).

6. From Claude Code, create one test rectangle on the canvas via MCP. Verify it appears in Paper.

7. Delete the test rectangle. Canvas is empty again.

### Validation criteria

* [ ] Paper desktop app installed and launches
* [ ] `markhub-wip.paper` exists and opens
* [ ] Claude Code lists Paper MCP tools without error
* [ ] A round-trip operation works (Claude Code creates an element → visible in Paper → Claude Code deletes it → gone from Paper)
* [ ] **Matheo's smoke test**: open Paper, see the empty canvas; check that nothing is left over from tests

### Expected output

`markhub-wip.paper` — empty, MCP-connected.

***

## STEP 2 — Design tokens import

**Objective**: get Markhub's tokens (colors, typography, spacing, radius) into Paper so that subsequent steps reference them, not raw hex values.

### Mission

1. Claude Code reads `DESIGN-PRINCIPLES.md` and any token file in the Markhub repo (`src/styles/tokens.css` if it exists, otherwise extract from `app.css`).

2. Via MCP, create in Paper:

   * A **color palette** containing the locked tokens of the default theme (Markhub Dark, since that's the working default per `PLAN-DESIGN-DEFAULTS.md`).

   * **Text styles** matching the UI font stack and the heading scale.

   * **Spacing references** documented on a side panel of the canvas (a small artboard showing the 4px grid scale visually).

3. Save.

### Notes on Paper-specific behavior

* Paper supports OKLCH and modern color spaces. Use them when source tokens warrant.

* Paper's text styles correspond loosely to "shared styles" — reuse the same style across every element of the same role.

### Validation criteria

* [ ] Color palette in Paper matches the dark theme values from `PLAN-DESIGN-DEFAULTS.md` Step 2
* [ ] At least 5 reusable text styles defined (body, h1, h2, h3, UI small)
* [ ] Spacing reference artboard visible on canvas
* [ ] **Matheo's smoke test**: open Paper, eyeball the palette against the live app's CSS variables; flag any mismatch

### Expected output

`markhub-wip.paper` — palette + text styles + spacing reference visible.

***

## STEP 3 — Chrome port (sidebar, status bar, window controls)

**Objective**: reproduce Markhub's chrome on the canvas at 1:1 fidelity.

### Mission

1. Create an artboard at the real app's window size (e.g., 1440×900).

2. Via MCP, reproduce:

   * **Window controls area**: traffic lights placeholder + Warp-style sidebar toggle button (per `PLAN-DESIGN-DEFAULTS.md` Step 7 spec)

   * **Sidebar**: vault dropdown header, file list with item states (rest, hover, active), all using token references

   * **Status bar**: pills, save indicator, theme toggle — every element from the live app

3. Use Paper's flex layout (real CSS flexbox) so the chrome behaves correctly when the artboard is resized.

### Source of truth

Claude Code reads the actual Svelte components in `src/lib/components/` to determine structure and dimensions. **No invention.** If a measurement is unclear, Claude Code takes a screenshot of the live app and matches visually.

### Validation criteria

* [ ] Sidebar matches the live app at 1:1 (Matheo eyeballs side-by-side: Paper window vs Markhub `localhost:1420`)
* [ ] Status bar matches at 1:1
* [ ] Window controls area present and correctly positioned
* [ ] All tokens referenced (no raw hex except in the palette itself)
* [ ] **Matheo's smoke test**: Paper window next to Markhub live; visual diff is minimal

### Expected output

`markhub-wip.paper` — chrome complete.

***

## STEP 4 — Editor surface port

**Objective**: reproduce the editor area on the canvas, including the empty state and a populated state.

### Mission

1. Add two new artboards alongside the chrome:

   * **Empty state artboard**: the Cursor-style empty state per `PLAN-DESIGN-DEFAULTS.md` Step 6 (top-left logo, 2×2 action grid, recent vaults list)

   * **File-open artboard**: chrome + editor area with sample content (frontmatter `<details>`, headings, paragraphs, a code block, a table) — mirror the BlockNote rendering exactly

2. The Preview/Source switch in the top-right of the editor area (per `PLAN-BLOCKNOTE.md` Step 4) is included.

3. Headings respect the negative letter-spacing rules from `DESIGN-PRINCIPLES.md` §3.

### Validation criteria

* [ ] Empty state matches the spec at 1:1
* [ ] File-open artboard matches the live app at 1:1 with a real `.md` file open
* [ ] Editor typography (sizes, weights, letter-spacing) matches `DESIGN-PRINCIPLES.md` §3
* [ ] **Matheo's smoke test**: open a known `.md` file in the live app, compare against the Paper file-open artboard

### Expected output

`markhub-wip.paper` — complete v0 candidate, all screens covered.

***

## STEP 5 — v0 snapshot lock

**Objective**: lock the v0 reference. After this step, `markhub-v0.paper` is read-only by convention.

### Mission

1. **Duplicate** `markhub-wip.paper` to `markhub-v0.paper`.

2. Open `markhub-v0.paper`, add a top-of-canvas comment: `"v0 reference — do not edit. Duplicate to explore."`

3. Document in `PORT-PAPER-NOTES.md` (created at the project root):

   * Path to `markhub-v0.paper` on disk

   * Date locked

   * MCP server config used

   * Total MCP calls consumed during port (rough estimate)

4. Verify by opening `markhub-v0.paper` in a fresh Paper session: every artboard renders correctly.

### Validation criteria

* [ ] `markhub-v0.paper` exists and opens cleanly
* [ ] Comment present
* [ ] `PORT-PAPER-NOTES.md` committed to the repo (the doc, not the .paper file)
* [ ] **Matheo's smoke test**: open `markhub-v0.paper`, walk through every artboard, compare with the live app one final time, give the explicit "this is v0" sign-off

### Expected output

`markhub-v0.paper` (locked) + `PORT-PAPER-NOTES.md` (in repo).

***

## STEP 6 — Iteration loop test

**Objective**: validate that the exploration workflow works end-to-end on a real, surgical UI change.

### Mission

1. **Duplicate** `markhub-v0.paper` to `markhub-explo-sidebar-right.paper`.

2. Open the duplicate. Close v0.

3. Matheo gives a single surgical instruction in Claude Code chat. Example: *"Move the sidebar to the right side of the window and adjust the status bar accordingly."*

4. Claude Code:

   * Reads the current canvas via MCP

   * Applies the change to the file-open artboard only

   * Reports what was changed

5. Matheo opens Paper, reviews.

6. Second iteration: Matheo asks for an adjustment. Claude Code applies it.

7. Matheo decides: keep or revert. Reverting = close the explo file, reopen v0, duplicate again with a new name.

### What is being measured (this is the whole point)

* How many MCP calls did the change cost?

* How fast did the canvas update?

* Did the change land where expected, or did Claude Code touch unrelated parts?

* How easy was it to "go back to v0"?

* Could Matheo see both v0 and the explo side-by-side (two Paper windows)?

### Validation criteria

* [ ] At least one full iteration (request → applied → reviewed → adjusted → reviewed) completed
* [ ] v0 file is unchanged after the experiment (verify by reopening and comparing)
* [ ] Side-by-side comparison was possible (two Paper windows open)
* [ ] **Matheo's smoke test**: confirm the loop felt usable, log friction points in `PORT-PAPER-NOTES.md`

### Expected output

`markhub-explo-sidebar-right.paper` + observations logged in `PORT-PAPER-NOTES.md`.

***

## STEP 7 — Comparative assessment

**Objective**: write the honest assessment of Paper for Markhub's iteration workflow. Feeds the final Paper-vs-Pencil decision.

### Mission

Create `ASSESSMENT-PAPER.md` in the repo with five sections, each scored 1-5 and justified in 2-3 sentences:

1. **Port fidelity** — how close did v0 land to the live app?

2. **Iteration friction** — how many turns to change one thing? Did Claude Code reach the right element?

3. **v0 preservation** — was the snapshot approach clean? Any near-misses where v0 was almost edited?

4. **Workflow friction** — windows juggled, app switches, MCP setup pain, weekly limit hit?

5. **Claude Code ↔ Paper communication** — clarity of MCP tools, error messages, surprises

Also include:

* Total MCP calls used end-to-end

* Time spent (rough)

* Three bullet-pointed "blockers if any"

* Three bullet-pointed "delights"

### Validation criteria

* [ ] `ASSESSMENT-PAPER.md` exists with all five scored sections
* [ ] Numbers reported (calls, time)
* [ ] **Matheo's read-through**: assessment matches his felt experience; he co-signs

### Expected output

`ASSESSMENT-PAPER.md` (in repo).

***

## STARTUP PROMPT FOR CLAUDE CODE

```text
You're starting work on PLAN-UI-PORT-PAPER.md.

Mirror plan: PLAN-UI-PORT-PENCIL.md exists with identical steps for Pencil. We're running them sequentially to compare the two tools. Do not look at the Pencil plan during your work.

Read PLAN-UI-PORT-PAPER.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time
- Mandatory wrap-up format at end of step (test procedure, MCP call count, comparison notes)
- Mandatory interactive smoke test by Matheo before advancing
- No design invention: reproduce the live app as defined by DESIGN-PRINCIPLES.md
- v0 protection is via snapshots (duplicated .paper files)
- 100 MCP calls per week limit — budget accordingly

Next step: STEP 1 — Setup + MCP connection.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```
