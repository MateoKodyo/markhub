---

---

# PLAN — UI PORT TO PENCIL

> **Single objective**: port Markhub's current UI into Pencil (pencil.dev) to obtain a faithful **v0 reference**, then use Pencil as the playground for UI/UX explorations driven by Claude Code via MCP. Read at the start of every Claude Code session working on this plan. **Mirror plan**: `PLAN-UI-PORT-PAPER.md` — same steps, same validation criteria, same scope. Only the tool and the workflow specifics differ. The point of running both is to compare the two tools honestly on identical work. **Reference**: `DESIGN-PRINCIPLES.md` defines what the UI must look like. This plan is about reproducing it inside Pencil, not redefining it.

***

## CONTEXT

Same context as `PLAN-UI-PORT-PAPER.md`: offload UI/UX exploration onto a canvas modifiable by Claude Code via MCP, leaving the Svelte codebase clean. Pencil is the second candidate. **No conclusion is drawn until both plans are complete.**

***

## TOOL PROFILE — PENCIL

Key facts that shape this plan:

* Pencil **lives inside the IDE** (Cursor / VS Code / Claude Code CLI). It is not a separate desktop app.

* Files are `.pen` (JSON), stored **directly in the project repo**. They are versioned by Git like any other file.

* Pencil ships a local **MCP server**. Claude Code reads and modifies `.pen` files via MCP tool calls.

* Pencil ships UI framework kits (Shadian, Halo, Lunarus, Nitro). For Markhub we use **none of them** — we reproduce our own design system from `DESIGN-PRINCIPLES.md`.

* No weekly MCP call limit comparable to Paper's free tier (verify in Step 1).

### Decision on v0 protection — Git branches

Because `.pen` files live in the repo and Git versioning is native, we protect v0 with **Git branches**, not file duplication:

* `feat/ui-port-pencil` branch holds the v0 baseline. A commit tagged `ui-pencil-v0` is the lock.

* Each exploration = a new branch off `ui-pencil-v0`: `explo/sidebar-right`, `explo/inverted-theme`, etc.

* "Going back to v0" = `git checkout ui-pencil-v0`.

* Side-by-side comparison = `git worktree` (two checkouts, two Pencil instances).

This is the natural workflow for a repo-resident design file. Duplicating .pen files would work too but feels redundant when Git is right there.

***

## NON-NEGOTIABLE RULES

Same operating discipline as `PLAN-BLOCKNOTE.md`:

1. **Dedicated branch**: `feat/ui-port-pencil`. All work — `.pen` files, scripts, screenshots, plan notes — lives here.

2. **One step at a time**, no parallelization.

3. **Mandatory wrap-up format** at the end of each step:

```text
═══════════════════════════════════════════════════
✅ STEP X COMPLETED (PENCIL)
═══════════════════════════════════════════════════

WHAT WAS DONE
[list]

CURRENT GIT STATE
Branch: [name]
Latest commit: [hash + message]

⚠️ HOW MATHEO TESTS THIS LIVE ⚠️

OPEN PENCIL:
1. Ensure you're on branch [branch]
2. In your IDE, open: design/markhub.pen
3. Pencil canvas should render

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

4. **Mandatory smoke test by Matheo**: Matheo opens the `.pen` in the IDE, compares against Markhub running on `localhost:1420`, validates.

5. **No hacking around**: if Pencil's MCP can't do something cleanly, STOP and escalate.

6. **Brutal honesty** on tool limitations, alignment discrepancies (Pencil is known to have 4-8px drift on complex layouts per public reports — flag if seen).

7. **No design drift**: reproduce, don't redesign. Use Markhub's own tokens, not Pencil's bundled UI kits.

***

## PROGRESS TABLE

| Step                      | Status | Output (Git ref)             | Matheo validation |
| ------------------------- | ------ | ---------------------------- | ----------------- |
| 1. Setup + MCP connection | ⏳      | —                            | —                 |
| 2. Design tokens import   | ⏳      | commit `tokens`              | —                 |
| 3. Chrome port            | ⏳      | commit `chrome`              | —                 |
| 4. Editor surface port    | ⏳      | commit `editor`              | —                 |
| 5. v0 snapshot lock       | ⏳      | tag `ui-pencil-v0`           | —                 |
| 6. Iteration loop test    | ⏳      | branch `explo/sidebar-right` | —                 |
| 7. Comparative assessment | ⏳      | `ASSESSMENT-PENCIL.md`       | —                 |

***

## STEP 1 — Setup + MCP connection

**Objective**: Pencil installed in the IDE, MCP server running, Claude Code able to read/write a `.pen` file. No content yet.

### Mission

1. Install the Pencil extension in the IDE of choice (Claude Code or Cursor).

2. Verify Pencil's MCP server starts automatically when a `.pen` file is opened (per Pencil docs at `docs.pencil.dev`).

3. Create `design/markhub.pen` (empty) at the project root.

4. Add the Pencil MCP entry to Claude Code's MCP config if not auto-detected.

5. From Claude Code, verify the connection: list available Pencil MCP tools, read the current canvas state (should be empty).

6. From Claude Code, create one test rectangle via MCP. Verify it appears on the Pencil canvas in the IDE.

7. Delete the test rectangle. Canvas is empty.

8. Commit: `chore(pencil): scaffold empty design.pen`. Verify the `.pen` file is properly diffable in Git (JSON, not binary).

### Validation criteria

* [ ] Pencil extension installed
* [ ] `design/markhub.pen` exists, opens, is tracked in Git
* [ ] Claude Code lists Pencil MCP tools without error
* [ ] Round-trip works (create → see in IDE → delete → gone)
* [ ] `.pen` file is human-readable JSON in Git diffs (or at minimum diffable in a meaningful way)
* [ ] **Matheo's smoke test**: open the `.pen` in the IDE, see empty canvas; check `git status` is clean after commit

### Expected output

`design/markhub.pen` (empty, committed).

***

## STEP 2 — Design tokens import

**Objective**: get Markhub's tokens into Pencil so subsequent steps reference them, not raw hex values.

### Mission

1. Claude Code reads `DESIGN-PRINCIPLES.md` and any token file in the Markhub repo.

2. Via MCP, create in Pencil:

   * A **color palette** (Markhub Dark default theme tokens)

   * **Text styles** (UI body, h1, h2, h3, UI small)

   * A **spacing reference artboard** showing the 4px grid scale

3. **Do not** use any of Pencil's bundled UI kits (Shadian/Halo/Lunarus/Nitro). All styles defined from Markhub's own tokens.

4. Commit: `feat(pencil): import Markhub design tokens`.

### Notes on Pencil-specific behavior

* Pencil's components and styles are part of the `.pen` JSON. They are inspectable in diffs.

* If a style is named, name it identically to the CSS variable it mirrors (e.g., `color-bg-raised`).

### Validation criteria

* [ ] Color palette matches the dark theme values
* [ ] At least 5 reusable text styles defined
* [ ] Spacing reference artboard visible on canvas
* [ ] **Matheo's smoke test**: open the `.pen` in the IDE, eyeball palette against live app CSS; inspect a Git diff to verify the tokens are sensibly named

### Expected output

`design/markhub.pen` updated, committed.

***

## STEP 3 — Chrome port (sidebar, status bar, window controls)

**Objective**: reproduce Markhub's chrome on the canvas at 1:1 fidelity.

### Mission

1. Create an artboard at the real app's window size (e.g., 1440×900).

2. Via MCP, reproduce:

   * Window controls area with Warp-style sidebar toggle

   * Sidebar: vault dropdown header, file list with rest/hover/active states, all referencing token styles

   * Status bar: pills, save indicator, theme toggle

3. Use Pencil's layout primitives. Flag any 4-8px alignment drift seen during reproduction (known weakness per public reports).

4. Commit: `feat(pencil): port chrome to canvas`.

### Source of truth

Claude Code reads `src/lib/components/` for structure and dimensions. **No invention.**

### Validation criteria

* [ ] Sidebar matches the live app at 1:1
* [ ] Status bar matches at 1:1
* [ ] Window controls area present and correctly positioned
* [ ] No use of Pencil's bundled UI kits
* [ ] Alignment drift documented in commit message if any
* [ ] **Matheo's smoke test**: IDE next to Markhub live; visual diff is minimal

### Expected output

`design/markhub.pen` with chrome complete, committed.

***

## STEP 4 — Editor surface port

**Objective**: reproduce the editor area on the canvas, including empty state and populated state.

### Mission

1. Add two artboards:

   * Cursor-style empty state (per `PLAN-DESIGN-DEFAULTS.md` Step 6)

   * File-open artboard: chrome + editor area with sample content (frontmatter `<details>`, headings, paragraphs, code block, table), mirroring BlockNote rendering

2. Preview/Source switch in the top-right of the editor area is included.

3. Headings respect negative letter-spacing per `DESIGN-PRINCIPLES.md` §3.

4. Commit: `feat(pencil): port editor surface and empty state`.

### Validation criteria

* [ ] Empty state matches the spec at 1:1
* [ ] File-open artboard matches the live app with a real `.md` file open
* [ ] Editor typography matches `DESIGN-PRINCIPLES.md` §3
* [ ] **Matheo's smoke test**: open a known `.md` in live app, compare against the Pencil file-open artboard

### Expected output

`design/markhub.pen` complete v0 candidate, committed.

***

## STEP 5 — v0 snapshot lock

**Objective**: lock the v0 reference via a Git tag.

### Mission

1. Verify the working tree is clean on `feat/ui-port-pencil`.

2. Final commit if any pending: `chore(pencil): finalize v0 baseline`.

3. Apply Git tag: `git tag ui-pencil-v0 -m "Pencil v0 reference — Markhub UI port complete"`.

4. Push the tag.

5. Create `PORT-PENCIL-NOTES.md` documenting:

   * Tag name and commit hash

   * Pencil extension version used

   * MCP setup notes

   * Known limitations encountered during the port (alignment drift, etc.)

6. Verify by checking out the tag in a fresh worktree and opening the `.pen`: every artboard renders correctly.

### Validation criteria

* [ ] Tag `ui-pencil-v0` exists, points to a clean commit
* [ ] `PORT-PENCIL-NOTES.md` committed
* [ ] Checkout from tag in a worktree renders the canvas correctly
* [ ] **Matheo's smoke test**: walk through every artboard at the tag, compare with live app, explicit "this is v0" sign-off

### Expected output

Tag `ui-pencil-v0` + `PORT-PENCIL-NOTES.md`.

***

## STEP 6 — Iteration loop test

**Objective**: validate the exploration workflow on a real, surgical UI change.

### Mission

1. From `ui-pencil-v0`, create a new branch: `git checkout -b explo/sidebar-right ui-pencil-v0`.

2. Matheo gives the same surgical instruction as in the Paper plan: *"Move the sidebar to the right side of the window and adjust the status bar accordingly."*

3. Claude Code:

   * Reads the current canvas via MCP

   * Applies the change to the file-open artboard only

   * Commits: `explo(pencil): sidebar on the right`

4. Matheo opens the `.pen` in the IDE, reviews.

5. Second iteration: Matheo asks for an adjustment. Claude Code applies it and commits.

6. Matheo decides keep or revert. Reverting = `git checkout ui-pencil-v0` (or open a worktree to compare side-by-side).

7. Optional: set up `git worktree add ../markhub-v0 ui-pencil-v0` to view v0 and explo at the same time in two IDE windows.

### What is being measured (this is the whole point)

* How many MCP calls did the change cost?

* How fast did the canvas update?

* Did Claude Code touch only the intended elements, or did it edit unrelated parts of the `.pen`?

* Is the Git diff of the `.pen` readable? Can Matheo review the change in a diff viewer?

* How easy was it to "go back to v0" (a `git checkout` vs Paper's file swap)?

* Side-by-side via worktree: does it work?

### Validation criteria

* [ ] At least one full iteration completed
* [ ] `ui-pencil-v0` tag still points to the original commit, untouched
* [ ] `.pen` diff inspectable in Git (commit shows what changed)
* [ ] Side-by-side comparison was possible (worktree or two checkouts)
* [ ] **Matheo's smoke test**: confirm the loop felt usable, log friction points in `PORT-PENCIL-NOTES.md`

### Expected output

Branch `explo/sidebar-right` with at least 2 commits + observations in `PORT-PENCIL-NOTES.md`.

***

## STEP 7 — Comparative assessment

**Objective**: write the honest assessment of Pencil for Markhub's iteration workflow. Feeds the final Paper-vs-Pencil decision.

### Mission

Create `ASSESSMENT-PENCIL.md` in the repo with the **same five sections** as the Paper assessment, each scored 1-5 and justified in 2-3 sentences:

1. **Port fidelity** — how close did v0 land to the live app?

2. **Iteration friction** — how many turns to change one thing? Did Claude Code reach the right element?

3. **v0 preservation** — was the Git tag/branch approach clean? Any near-misses?

4. **Workflow friction** — IDE setup, MCP setup pain, alignment drift, `.pen` diff readability?

5. **Claude Code ↔ Pencil communication** — clarity of MCP tools, error messages, surprises

Also include:

* Approximate MCP call count (if observable)

* Time spent (rough)

* Three bullet-pointed "blockers if any"

* Three bullet-pointed "delights"

### Validation criteria

* [ ] `ASSESSMENT-PENCIL.md` exists with all five scored sections
* [ ] Same five-axis structure as `ASSESSMENT-PAPER.md` (so the two are directly comparable)
* [ ] **Matheo's read-through**: assessment matches his felt experience; he co-signs

### Expected output

`ASSESSMENT-PENCIL.md` (in repo).

***

## STARTUP PROMPT FOR CLAUDE CODE

```text
You're starting work on PLAN-UI-PORT-PENCIL.md.

Mirror plan: PLAN-UI-PORT-PAPER.md was completed first with identical steps. We're now running the Pencil version to compare. Do not look at the Paper plan or the Paper assessment during your work — we want an independent run.

Read PLAN-UI-PORT-PENCIL.md and DESIGN-PRINCIPLES.md BEFORE any action.

Main rules:
- One step at a time
- Mandatory wrap-up format at end of step (test procedure, Git state, comparison notes)
- Mandatory interactive smoke test by Matheo before advancing
- No design invention: reproduce the live app as defined by DESIGN-PRINCIPLES.md
- v0 protection is via Git tag (ui-pencil-v0)
- Do not use Pencil's bundled UI kits (Shadian/Halo/Lunarus/Nitro). Markhub tokens only.
- Flag any alignment drift seen during the port (known Pencil weakness)

Next step: STEP 1 — Setup + MCP connection.

At the start, confirm you've read both documents, give me your attack plan for Step 1, and wait for my GO before coding.
```
