# PLAN — CLI: `markus` in the PATH

> **Single objective**: ship a `markus` shell command, installable from the app, that opens a folder as a vault or a `.md` file directly from the terminal.
> Read at the start of every Claude Code session working on this plan.
> **Prerequisite**: `feat/editor-polish` resolved or paused cleanly. `main` stable, no unresolved blocker.
> **Reference**: Writer's changelog 2026-04-20 and 2026-04-23 documents the exact pattern we follow. This is not research; this is a known recipe.

---

## CONTEXT

Markus positions itself as a developer-grade markdown editor (Warp / Cursor / Linear lineage). One signal of that positioning is **table-stakes for dev tools**: a shell command in the PATH. Without it, a developer who installs Markus immediately senses "this isn't a real dev tool, it's a notes app." Cursor has `cursor`, VS Code has `code`, Sublime has `subl`, Writer (closest competitor) has `writer`. Markus needs `markus`.

The CLI itself is small: `markus .` opens the current folder as a vault, `markus README.md` opens a single file (and uses its parent folder as the vault). The implementation is well-trodden — Cursor, VS Code, and Writer all use the same Tauri-friendly pattern: a single multi-call executable, a single-instance plugin, and an install command behind a menu item with an admin auth prompt.

This is **not** a differentiator. It is a credibility prerequisite. It costs little and removes a friction point that would otherwise color the whole product perception negatively.

---

## NON-NEGOTIABLE RULES

Same operating rules as PLAN-BLOCKNOTE / PLAN-SETTINGS / PLAN-COMMAND-SYSTEM / PLAN-THEMING:

1. **Dedicated branch**: `feat/cli-install`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step (test URL, procedure, what's visible)
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**: if the macOS auth flow misbehaves, STOP and escalate
6. **Brutal honesty** on scope and blockers
7. **No new features** beyond CLI install/uninstall, argument parsing, and the menu wiring. No telemetry, no usage analytics, no auto-detection of vaults from shell history.

---

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN — CLI v1

- A `markus` shell command, installable to `/usr/local/bin/markus` on macOS, via a symlink to the app binary inside the bundle.
- The Markus binary becomes a **multi-call executable**: dispatch on `argv[0]` basename — if invoked as `markus`, run CLI mode; if invoked as `Markus`, run app mode.
- Argument handling in CLI mode:
  - No arguments → launches Markus normally (current behavior)
  - One argument that is a directory → open as the active vault in the focused window (or launch a new instance if Markus isn't running)
  - One argument that is a `.md` / `.markdown` / `.mdx` file → open the file; its parent directory becomes the vault if not already known
  - Path resolution: relative paths resolved against the current working directory, then canonicalized
- `tauri-plugin-single-instance` integration:
  - If Markus is already running, the second invocation hands its arguments off to the running instance instead of launching a duplicate
  - The running instance receives the arguments via the plugin's handler and opens the requested path
- Install / uninstall flow:
  - A menu item under the Markus application menu: "Install 'markus' Command in PATH"
  - Click triggers a Tauri command (`install_cli`) that:
    - Checks if `/usr/local/bin/markus` already exists
    - If a symlink pointing to the current app: no-op, success
    - If a non-symlink (real file): refuses, returns an error to surface in UI
    - If `/usr/local/bin` is not user-writable: escalates via `osascript` admin auth prompt
    - On success: creates the symlink, updates the menu label to "Uninstall 'markus' Command from PATH"
  - The same menu item toggles label and behavior based on current install state (`cli_status` command)
- Pattern: the install code lives inside the main Markus binary (no second binary target, no extra build artifact)

### OUT — Reported to v2 or beyond

- Windows / Linux install flows (different mechanisms: `setx PATH` on Windows, `~/.local/bin` symlink on Linux). To be added as separate steps in a future plan once macOS is validated.
- Additional CLI commands beyond opening (no `markus list`, no `markus search`, no piping markdown to stdout, no `markus --help` exhaustive flag system in v1 — only `--version` and `--help` minimal output)
- Shell completions (bash/zsh/fish)
- Drag-drop registration as default markdown handler (separate concern: file associations)
- Auto-update of the symlink across Markus versions (the symlink points to the .app bundle path, which Tauri's installer keeps stable across updates — verify in Step 5)

### OUT — Permanent

- Embedded help system / man page
- CLI scripting features (subcommands, plugins, hooks)
- Network-aware CLI (`markus open https://...`)
- CLI access to vault contents from outside the GUI (no headless mode)

---

## ARCHITECTURE OVERVIEW

### Multi-call executable

The Markus Rust binary inspects `std::env::args().next()` at startup. If the basename of `argv[0]` is `markus` (lowercase), enter CLI mode. Otherwise (`Markus`, the bundle's normal entry point), enter app mode.

CLI mode:
1. Parse arguments (`std::env::args().skip(1)`)
2. If empty → invoke single-instance hand-off with no arguments → launches the app normally
3. If one argument → resolve and canonicalize the path, then hand off
4. If invalid (more than one arg, missing file, etc.) → print a brief usage line to stderr and exit 1

App mode = current behavior, untouched.

### Single-instance hand-off

`tauri-plugin-single-instance` is added to `Cargo.toml`. Its handler receives a list of arguments from the secondary invocation:

```rust
.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
    // argv = the arguments from the second invocation
    // resolve a target path from argv, then route it to the open_target helper
    handle_cli_args(app, argv, cwd);
}))
```

A shared `open_target.rs` module (mirroring Writer's pattern) handles three entry points:
- Drag-drop on the app icon (existing macOS `RunEvent::Opened`)
- CLI invocation hand-off
- Future: file association (out of scope here)

All three resolve a path → `Path` enum (`Directory(PathBuf)` or `File(PathBuf)`) → existing vault/file opening logic.

### Install / Uninstall

Two Tauri commands in `src-tauri/src/commands/cli.rs`:

```rust
#[tauri::command]
fn cli_status() -> CliStatus {
    // returns: NotInstalled | Installed(target) | BadTarget(target)
}

#[tauri::command]
async fn install_cli() -> Result<(), String> {
    // 1. compute symlink source: bundle .app/Contents/MacOS/Markus
    // 2. compute symlink dest: /usr/local/bin/markus
    // 3. if dest exists and is symlink to source → done
    // 4. if dest exists and is non-symlink → error
    // 5. attempt direct symlink creation
    // 6. if EACCES → escalate via osascript with admin prompt
}

#[tauri::command]
async fn uninstall_cli() -> Result<(), String> {
    // remove the symlink at /usr/local/bin/markus, only if it's ours
}
```

The menu item is built via Tauri's native menu API and toggles based on `cli_status()`. A small `CliMenuItem` wrapper holds a managed state reference so the label can be updated via `MenuItem::set_text` after each successful install/uninstall.

### Path resolution and security

CLI argument paths are:
1. Resolved against `cwd` (passed from the plugin handler)
2. Canonicalized via `std::fs::canonicalize`
3. Validated as readable
4. Validated against `.md` / `.markdown` / `.mdx` extension if it's a file

No path-traversal concerns at this layer (the CLI legitimately opens any path the user has access to). But: **never write to a path provided via CLI without explicit user action in the UI**. The CLI is read-mostly.

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Single-instance plugin + arg routing skeleton | ⏳ | — | — |
| 2. Multi-call executable dispatch | ⏳ | — | — |
| 3. Path resolution + opening logic (shared module) | ⏳ | — | — |
| 4. Install command (Tauri command + symlink + osascript) | ⏳ | — | — |
| 5. Uninstall command + status detection | ⏳ | — | — |
| 6. Menu wiring (toggle label, dynamic state) | ⏳ | — | — |
| 7. Full audit + closure | ⏳ | — | — |

---

## STEP 1 — Single-instance plugin + arg routing skeleton

**Objective**: introduce `tauri-plugin-single-instance` and wire its handler to a no-op argument route. No CLI yet — this step proves that a secondary launch is intercepted by the running instance.

### Mission

1. Add `tauri-plugin-single-instance` to `src-tauri/Cargo.toml`
2. Register the plugin in the main Tauri builder with a handler:
   ```rust
   .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
       // for this step: just log argv and cwd to console
       println!("Secondary instance launched: argv={:?}, cwd={}", argv, cwd);
   }))
   ```
3. Verify behavior on macOS:
   - Launch Markus normally
   - From a second terminal, run the bundled binary directly (`open -a Markus`) — the running instance must receive a focus event, NOT spawn a duplicate window
   - The handler must log argv

### Validation criteria

- [ ] Plugin compiles cleanly (`cargo check`)
- [ ] First launch behaves as before
- [ ] Second launch focuses the existing window instead of duplicating
- [ ] Handler logs argv and cwd to stderr
- [ ] `cargo test`: green
- [ ] **Matheo's smoke test**: launch Markus, then try to launch a second instance via Finder or `open -a Markus.app` — verify only one window remains and the existing one comes to front

### Expected commit

`feat(cli): add single-instance plugin with no-op handler`

---

## STEP 2 — Multi-call executable dispatch

**Objective**: make the Markus binary detect whether it was invoked as `markus` (CLI mode) or as the regular app (`Markus`), and branch accordingly. No symlink yet — testing is done by manually copying or aliasing the binary.

### Mission

1. In `src-tauri/src/main.rs`, before any Tauri initialization:
   ```rust
   fn main() {
       let argv0 = std::env::args().next().unwrap_or_default();
       let basename = std::path::Path::new(&argv0)
           .file_name()
           .and_then(|s| s.to_str())
           .unwrap_or("");
       
       if basename == "markus" {
           cli_main();
       } else {
           app_main();
       }
   }
   ```
2. Create `src-tauri/src/cli.rs` with `cli_main()`:
   - Parse `std::env::args().skip(1).collect::<Vec<_>>()`
   - For this step: print arguments to stderr and exit (no opening logic yet)
3. `app_main()` contains the current Tauri builder code (move it out of `main`)

### Validation criteria

- [ ] `cargo build` produces a working binary
- [ ] Running the binary normally launches the app
- [ ] Manually creating a symlink `ln -sf /path/to/Markus.app/Contents/MacOS/Markus /tmp/markus` and running `/tmp/markus foo bar` prints `foo bar` to stderr and exits cleanly
- [ ] No regression in normal app launch
- [ ] **Matheo's smoke test**: create the manual symlink, run it with various arguments (no args, one folder path, one file path), verify each prints the expected argv

### Expected commit

`feat(cli): multi-call dispatch on argv[0] basename`

---

## STEP 3 — Path resolution + opening logic (shared module)

**Objective**: build the shared opener (`open_target.rs`) used by CLI hand-off, drag-drop, and future entry points. Wire it from both the single-instance handler (Step 1) and the CLI mode (Step 2).

### Mission

1. Create `src-tauri/src/open_target.rs`:
   ```rust
   pub enum OpenTarget {
       Vault(PathBuf),
       File(PathBuf),
       None,
   }
   
   pub fn resolve_from_args(argv: &[String], cwd: &Path) -> Result<OpenTarget, String> {
       // empty → None
       // one arg → canonicalize against cwd, check if dir or file, validate extension if file
       // more than one → error
   }
   
   pub fn dispatch(app: &AppHandle, target: OpenTarget) -> Result<(), String> {
       // forward to existing vault/file opening logic via Tauri events or direct store updates
   }
   ```
2. In CLI mode (`cli_main`):
   - Use the single-instance plugin's "send to primary" mechanism (the plugin auto-handles this — secondary process exits immediately after handing args off to the running primary, or, if no primary exists, becomes the primary itself)
   - Specifically: instead of doing work in `cli_main`, just pass through. The single-instance plugin in the primary takes over.
   - Document this clearly in code comments — the cli.rs file becomes very thin.
3. In the single-instance handler (Step 1 location), wire to `resolve_from_args` then `dispatch`
4. Existing drag-drop handler (`RunEvent::Opened` on macOS) refactored to also call `resolve_from_args` + `dispatch` for consistency

### Validation criteria

- [ ] `markus /some/folder` (via manual symlink) opens that folder as the active vault
- [ ] `markus /some/file.md` opens that file (its parent becomes the vault if new)
- [ ] `markus` (no args) launches the app cleanly
- [ ] `markus /nonexistent/path` prints an error to stderr, exits 1, app not launched
- [ ] `markus a b c` (multiple args) prints usage and exits 1
- [ ] Drag-drop a folder onto the Markus app icon: same behavior as `markus /that/folder`
- [ ] **Matheo's smoke test**: full matrix — no args, folder arg, .md arg, .markdown arg, non-existent path, multiple args, plus drag-drop equivalents

### Expected commit

`feat(cli): shared open_target module wired from CLI and drag-drop`

---

## STEP 4 — Install command (symlink + osascript escalation)

**Objective**: implement the install Tauri command that creates the symlink in `/usr/local/bin/markus`, with admin auth fallback when needed.

### Mission

1. Create `src-tauri/src/commands/cli.rs` with:
   - `cli_status() → CliStatus` enum (`NotInstalled`, `Installed`, `BadTarget`)
   - `install_cli() → Result<(), String>` async
2. Logic for `install_cli`:
   - Compute source: `/Applications/Markus.app/Contents/MacOS/Markus` (or wherever the bundle lives, resolved via Tauri's `resource_dir` or similar)
   - Compute dest: `/usr/local/bin/markus`
   - If dest exists and is a symlink to source → success no-op
   - If dest exists and is anything else → return error: "A file already exists at /usr/local/bin/markus that isn't ours. Remove it manually first."
   - Attempt `std::os::unix::fs::symlink(source, dest)`
   - On `EACCES` (permission denied): spawn `osascript -e 'do shell script "ln -s ... ..." with administrator privileges'`
   - If osascript succeeds: success
   - If osascript fails (user cancelled the auth dialog): return error: "Install cancelled."
3. Register the command in the Tauri builder
4. Frontend: temporary debug button somewhere (e.g., Settings) that invokes the command and shows the result. The proper menu wiring is Step 6.

### Validation criteria

- [ ] `cli_status` returns correct state in all three cases (no symlink, our symlink, foreign file)
- [ ] `install_cli` creates the symlink when `/usr/local/bin` is writable
- [ ] `install_cli` triggers the admin prompt when needed
- [ ] After install: `which markus` from any terminal returns `/usr/local/bin/markus`
- [ ] After install: running `markus ~/Documents/some-vault` from any terminal opens that vault in Markus
- [ ] **Matheo's smoke test**:
  1. From a fresh state (no symlink), trigger install via debug button → admin prompt appears → enter password → symlink created
  2. Open a new terminal, run `which markus` → returns the symlink path
  3. Run `markus .` from inside a folder with `.md` files → that folder opens as a vault in Markus
  4. Trigger install again → no-op success

### Expected commit

`feat(cli): install command with symlink and admin auth escalation`

---

## STEP 5 — Uninstall command + status detection

**Objective**: implement uninstall, with safety checks.

### Mission

1. Add `uninstall_cli() → Result<(), String>` to `src-tauri/src/commands/cli.rs`:
   - Check `/usr/local/bin/markus` exists and is a symlink we own (points into the Markus bundle)
   - If yes: remove it. Admin escalation if needed (same osascript pattern)
   - If it's not ours: refuse to remove
2. Refine `cli_status` to also check the symlink target is sane (not pointing to a stale or moved bundle)
3. Frontend: add an uninstall debug button next to the install button (still temporary; menu wiring in Step 6)

### Validation criteria

- [ ] `uninstall_cli` removes the symlink when it's ours
- [ ] `uninstall_cli` refuses to remove non-symlink files at that path
- [ ] After uninstall: `which markus` returns nothing
- [ ] After uninstall: `cli_status` returns `NotInstalled`
- [ ] **Matheo's smoke test**: install → verify works → uninstall → verify gone → reinstall → verify works again

### Expected commit

`feat(cli): uninstall command with safety checks`

---

## STEP 6 — Menu wiring

**Objective**: replace the temporary debug buttons with a real menu item that toggles between install and uninstall based on current state.

### Mission

1. In the native Tauri menu setup, add a menu item under the Markus application menu:
   - Initial label: read `cli_status()` and set to "Install 'markus' Command in PATH" or "Uninstall 'markus' Command from PATH" accordingly
2. Click handler:
   - If currently installed → call `uninstall_cli`
   - If currently not installed → call `install_cli`
   - After either: refresh the label via `MenuItem::set_text` using the new state
3. Remove the temporary debug buttons from Settings
4. Optionally surface a small confirmation/toast on success ("CLI installed — open a terminal and try `markus --help`") — TBD with Matheo

### Validation criteria

- [ ] Menu item appears under the Markus menu
- [ ] Label reflects current state at app launch
- [ ] Click installs or uninstalls as expected
- [ ] Label updates after the action
- [ ] **Matheo's smoke test**: launch Markus, check menu label, click → action runs → label updates → relaunch app → label still reflects state

### Expected commit

`feat(cli): native menu wiring for install/uninstall`

---

## STEP 7 — Full audit + closure

**Objective**: end-to-end validation of the CLI feature.

### Mission

1. Full matrix test:
   - Fresh install → `cli_status` is `NotInstalled` → menu says "Install"
   - Install → admin prompt → success → `cli_status` is `Installed` → menu says "Uninstall"
   - `markus .` from terminal → opens current dir as vault
   - `markus ~/Documents/note.md` → opens file
   - `markus` with no args → launches app or focuses existing
   - `markus /nonexistent` → stderr error, no app launch
   - Uninstall → admin prompt if needed → success → `cli_status` is `NotInstalled`
2. Edge cases:
   - Markus already running, second `markus` invocation: focuses existing window, opens the target
   - Markus not running, first `markus` invocation: launches Markus and opens the target
   - Markus updated to a new version: symlink still works (the .app bundle path stays stable)
3. Documentation:
   - JOURNAL.md entry summarizing the chantier
   - BACKLOG.md: close CLI v1 items, add v2 candidates (Windows/Linux install flows, shell completions)
   - README.md or a docs page: a brief "Install the `markus` command" section
4. Final Matheo smoke test with all of the above
5. Cleanup any debug code, temporary buttons, console logs from earlier steps

### Validation criteria

- [ ] Full matrix passes
- [ ] No leftover debug code
- [ ] Documentation updated
- [ ] **Matheo's final smoke test**: signed off on each behavior

### Expected commit

`chore(cli): final audit, documentation, cleanup`

---

## QUESTIONS ANTICIPATED

### "What if `/usr/local/bin` doesn't exist on the user's system?"

Step 4 should check and create it (via osascript if needed). Document the behavior. Real macOS systems have this path by default, but Homebrew users may have shifted to `/opt/homebrew/bin` on Apple Silicon. v1 targets `/usr/local/bin`; `/opt/homebrew/bin` becomes a v2 enhancement.

### "What if the user moves Markus.app to a different folder after install?"

The symlink points to the .app bundle. If the bundle moves, the symlink breaks. `cli_status` should detect this (BadTarget state) and prompt the user to reinstall via the menu. Handled in Step 5.

### "What about Tauri auto-updater interactions?"

Tauri's updater (when we add it) replaces the .app bundle in-place. The symlink continues to point to the same path. No interaction needed. Verify in Step 7.

### "What if Matheo wants Windows/Linux support during this plan?"

Polite refusal. "Noted in BACKLOG.md for v2." macOS-first to validate the pattern. Windows uses a different mechanism (PATH env var manipulation, often via `setx`). Linux is straightforward but should use `~/.local/bin` not `/usr/local/bin`. Both deserve their own steps.

### "Why not embed the install logic as a shell script the user runs?"

Because of UX. A menu item with one click + admin prompt is dramatically more discoverable than "run this curl | sh." The pattern is industry-standard (Cursor, VS Code, Writer all do it).

### "What if Markus is opened from Spotlight or Finder while a `markus .` is processing?"

The single-instance plugin handles this. Whichever invocation comes first becomes the primary; subsequent invocations hand off. No race condition.

---

## STARTUP PROMPT FOR CLAUDE CODE

```
You're starting work on PLAN-CLI.md.

Prerequisites:
- main is stable, no unresolved blocker
- feat/editor-polish resolved or cleanly paused

Read PLAN-CLI.md BEFORE any action. The full pattern is documented; this is implementation, not research. Writer (joelbqz/writer-computer) implemented the same pattern publicly — its changelog 2026-04-20 and 2026-04-23 are valid references for technical detail.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- macOS only in v1. Windows/Linux are deferred.
- No feature creep: only install/uninstall, argument parsing, menu wiring.

Next step: STEP 1 — Single-instance plugin + arg routing skeleton.

At the start, confirm you've read the plan, give me your attack plan for Step 1, and wait for my GO before coding.
```

---

## NOTES ON THIS PLAN

This is the smallest of the three priority plans and the highest-leverage per hour spent. The pattern is well-known. The risk is low. The visibility to a developer testing Markus is high — within 30 seconds of installing, they'll discover the menu item, click it, and have `markus` working from any terminal.

The cleanup at the end (Step 7) is important. Debug buttons, console.logs, and temporary code from Steps 4-5 must be removed cleanly. The final delivered state should look as if the menu was always there.
