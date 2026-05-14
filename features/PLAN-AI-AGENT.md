# PLAN — AI AGENT v1

> **Status**: 📦 BACKLOGGED — draft for future consideration. Not in active development.
> **Single objective**: deliver a non-intrusive AI editing assistant that respects Markhub's sovereignty commitments and supports both cloud and local providers from day one.
> Read at the start of every Claude Code session working on this plan (if and when activated).
> **Prerequisite**: PLAN-SETTINGS must be ✅ complete. This plan is the natural successor.
> **Reference**: `DESIGN-PRINCIPLES.md` governs both the visual treatment and the sovereignty principles that constrain this plan.

---

## STATUS — WHY THIS IS BACKLOGGED

This plan exists as a **drafted reference**, not as an active workstream. It was outlined on 2026-05-11 during a strategic discussion between Matheo and Claude about Markhub's future agent capabilities.

The plan is kept on file so that:
1. The architectural direction is fixed early (provider abstraction with local-first compatibility) and won't be rushed when the time comes
2. The scope is bounded before any pressure to "just add a chat" arises
3. Future Claude Code sessions have a clear charter when activation happens

**Activation criteria** (all required):
- PLAN-BLOCKNOTE ✅ complete
- PLAN-DESIGN-DEFAULTS ✅ complete
- PLAN-COMMAND-SYSTEM ✅ complete
- PLAN-SETTINGS ✅ complete
- Explicit GO from Matheo

Until then: **no work on this plan**. It lives in the repo as documentation of intent.

---

## CONTEXT — WHY AN AGENT IN MARKHUB

Markhub is a markdown editor for developers who write a lot — reflections, notes, drafts, documentation. The kind of writing that benefits most from an AI assistant is not code generation (other tools handle that better), but **thinking, structuring, rephrasing, and translating**.

The bet: a well-designed editing agent, invoked from the keyboard, applied to a selection, with a clear diff-preview UX, becomes a writing accelerator without taking over the writing experience. This is the **Cursor inline-edit pattern** applied to prose, not the **chat sidebar pattern** that fragments attention.

The discipline is to keep the agent **invisible until called**, **scoped to what's selected**, and **respectful of the markdown document** as the source of truth.

---

## SOVEREIGNTY — THE NON-NEGOTIABLE PRINCIPLE

`DESIGN-PRINCIPLES.md` commits Markhub to: *"no proprietary format, no opaque database, no 'sync via our cloud.'"* Adding an AI agent that silently calls a third-party API would betray this commitment.

This plan therefore enforces three sovereignty rules:

### Rule S1 — AI is opt-in, never opt-out
- AI features are **off by default** on first launch
- A first-run prompt or Settings toggle is the only way to activate them
- No background AI calls, no telemetry, no implicit usage

### Rule S2 — Provider abstraction from day one
- Cloud providers (Claude, OpenAI) and local providers (Ollama, llama.cpp) implement the **same interface**
- The user chooses the provider in Settings
- Switching providers requires no code change in the editor — only a config update

### Rule S3 — Local providers are first-class, not afterthoughts
- The very first version of the architecture includes Ollama as a working option
- Latency differences are surfaced honestly in the UI ("Local AI runs entirely on your machine — slower but private")
- No cloud-specific feature is built that cannot reasonably run locally on a mid-range modern machine

These three rules are the spine of this plan. Every design decision must align with them.

---

## NON-NEGOTIABLE RULES (OPERATING)

Same operating rules as the previous plans, plus the sovereignty rules above:

1. **Dedicated branch**: `feat/ai-agent-v1`
2. **One step at a time**, no parallelization
3. **Mandatory wrap-up format** at the end of each step (test URL, procedure, what's visible)
4. **Mandatory interactive smoke test** by Matheo before advancing
5. **No bricolage**: if a provider's API doesn't deliver what's needed, STOP and escalate
6. **Brutal honesty** on scope and blockers
7. **No new actions beyond the validated v1 scope** (see below). New actions go to v2.
8. **Sovereignty rules S1, S2, S3 always win** when in conflict with implementation convenience

---

## SCOPE — WHAT'S IN, WHAT'S OUT

### IN — AI Agent v1

#### Three core actions, invoked via Cmd+I on a selection
1. **Reformulate** — rephrase the selection (with sub-modes: clearer, more concise, more formal, more casual)
2. **Fix grammar and spelling** — correct errors without changing meaning
3. **Translate** — translate the selection to a chosen target language

#### One structural action, invoked via Cmd+I without selection on a heading or document
4. **Suggest structure** — propose a new outline or restructuring of the document (multi-block diff preview)

#### Diff-preview UX
- Every action produces a **proposal**, never an immediate modification
- The user sees a side-by-side or inline diff
- Accept (Enter or click) applies; Reject (Esc or click) cancels
- For multi-block changes (structural), the diff is block-level, similar to Notion's AI proposals

#### Provider support (v1)
- **Anthropic Claude** (via API key)
- **OpenAI GPT** (via API key)
- **Ollama** (via local HTTP endpoint, default `http://localhost:11434`)

#### Settings integration
- New "AI" section in Settings
- Master toggle: "Enable AI features" (off by default)
- Provider selector
- Per-provider config (API key, endpoint, model name)
- Default language for translation
- Optional: temperature, max tokens (advanced — discuss inclusion in v1)

### OUT — v1, will be considered for v2 or later

- **Chat panel / conversation mode** — explicitly deferred. Matheo noted on 2026-05-11 that a chat may eventually make sense for some interactions, but the v1 commits to the invisible/deterministic Cmd+I pattern first
- **RAG / vault-wide context** — the agent in v1 sees only the selection (or current block) and its immediate context, never the full vault
- **Embeddings / semantic search** — depends on vault indexing, out of scope
- **Q&A on the vault** — depends on RAG, out of scope
- **Custom prompt library** — users can't write their own prompts in v1 (the three core actions ship with curated prompts)
- **Streaming responses** — the v1 ships with non-streaming responses for simplicity; streaming is a v2 polish item
- **Multi-turn refinement** — "make it shorter still" after a proposal — deferred to v2
- **Provider auto-fallback** — if a provider fails, v1 surfaces the error; no automatic retry on another provider

### OUT — Permanent

- Telemetry / usage tracking
- Cloud sync of AI conversations or settings (consistent with the no-cloud-sync rule)
- Markhub-hosted AI proxy (users connect to providers directly with their own keys)

---

## ARCHITECTURE OVERVIEW

### Provider abstraction

```typescript
interface AIProvider {
  id: string;                    // 'anthropic' | 'openai' | 'ollama'
  displayName: string;
  isLocal: boolean;              // surfaces in UI
  validate(): Promise<boolean>;  // checks credentials/connectivity

  execute(task: AITask): Promise<AIResponse>;
}

interface AITask {
  action: 'reformulate' | 'fix' | 'translate' | 'structure';
  input: string;                 // the selection or document
  options?: {
    style?: 'clearer' | 'concise' | 'formal' | 'casual';
    targetLanguage?: string;
    contextBefore?: string;      // surrounding context
    contextAfter?: string;
  };
}

interface AIResponse {
  output: string;                // the proposal
  metadata?: {
    model: string;
    tokensUsed?: number;
    latencyMs: number;
  };
}
```

The editor never imports a specific provider. It calls `currentProvider.execute(task)` and renders the result in the diff UI.

### Provider implementations

Three adapters in v1:

- `AnthropicProvider` — uses the Claude Messages API
- `OpenAIProvider` — uses the Chat Completions API
- `OllamaProvider` — uses the Ollama HTTP API (compatible-OpenAI shape on `/v1/chat/completions`)

Each adapter is a thin wrapper that:
1. Builds the right request shape for its API
2. Wraps the input in the appropriate system + user prompt for the requested action
3. Parses the response
4. Returns a normalized `AIResponse`

### Prompt management

Prompts for the four actions are stored as templates in `src/lib/ai/prompts/`. Templates are simple string interpolations, not a full templating engine. Each action has one template per provider if needed (different models respond to different prompt styles), but the goal is to have **one template per action** that works across providers.

### Settings integration

A new "AI" section in the Settings modal (added in PLAN-SETTINGS) holds:
- Master enable/disable
- Active provider
- Per-provider config (collapsible panels)
- Default translation language

### Diff UX

For single-text-block actions (reformulate, fix, translate):
- The proposal renders in an inline overlay above the selection
- Original (struck through) above, proposal below, or side-by-side
- Two buttons: Accept / Reject
- Keyboard: Enter to accept, Esc to reject

For structural action (suggest structure):
- A modal opens showing the full document on the left, the proposal on the right
- Each block highlighted: green for added, red for removed, yellow for moved
- Block-level accept/reject possible (accept some changes, reject others) — **optional in v1, decide during the step**

---

## PROGRESS TABLE

| Step | Status | Commit | Matheo validation |
|------|--------|--------|-------------------|
| 1. Provider abstraction + types | ⏳ (backlogged) | — | — |
| 2. Settings — AI section | ⏳ (backlogged) | — | — |
| 3. Anthropic provider (first cloud) | ⏳ (backlogged) | — | — |
| 4. Cmd+I command + diff preview UX | ⏳ (backlogged) | — | — |
| 5. Reformulate action | ⏳ (backlogged) | — | — |
| 6. Fix grammar action | ⏳ (backlogged) | — | — |
| 7. Translate action | ⏳ (backlogged) | — | — |
| 8. OpenAI provider | ⏳ (backlogged) | — | — |
| 9. Ollama provider (local) | ⏳ (backlogged) | — | — |
| 10. Structural action with block-level diff | ⏳ (backlogged) | — | — |
| 11. Polish + error handling + closure | ⏳ (backlogged) | — | — |

---

## STEP 1 — Provider abstraction + types

**Objective**: build the interface layer that all providers will implement. No actual provider calls yet.

### Mission

1. Create `src/lib/ai/types.ts` with the `AIProvider`, `AITask`, `AIResponse` interfaces (as defined in Architecture)
2. Create `src/lib/ai/registry.ts`: a Svelte store holding the list of available providers and the currently active one
3. Create `src/lib/ai/prompts/` directory with one file per action: `reformulate.ts`, `fix.ts`, `translate.ts`, `structure.ts`. Each exports a function `buildPrompt(task: AITask): { system: string; user: string }`
4. Create a mock provider for testing: `MockProvider` that returns a canned response after a 500ms delay. This lets the next steps build UX without a real API key.

### Validation criteria

- [ ] Type definitions clean and well-documented
- [ ] Registry store functional (get/set active provider)
- [ ] Mock provider returns expected responses for each action
- [ ] Unit tests cover the registry contract and the mock
- [ ] `svelte-check`: 0 errors
- [ ] **Matheo's smoke test**: open the app, open the dev console, manually invoke `registry.execute({ action: 'reformulate', input: 'Hello' })`, verify the mock response

### Expected commit

`feat(ai): provider abstraction layer with mock provider`

---

## STEP 2 — Settings — AI section

**Objective**: add the AI section to the Settings modal (from PLAN-SETTINGS).

### Mission

1. Add a new "AI" section in the left rail of the Settings modal
2. Implement:
   - Master toggle: "Enable AI features"
   - Provider dropdown: lists registered providers with their `displayName` and a "local" badge if `isLocal: true`
   - Per-provider collapsible panel with config fields (API key, model, endpoint for Ollama)
   - Default translation language: dropdown with ~15 common languages
3. Extend the `Settings` interface in `src/lib/stores/settings.ts` with an `ai` namespace
4. Persistence: same as other settings (debounced disk write)
5. Validation: when a provider's config is incomplete, show an inline warning ("API key required")

### Validation criteria

- [ ] AI section visible in Settings modal
- [ ] All controls functional and persisted
- [ ] Switching provider updates the registry's active provider
- [ ] Disabling AI features hides any AI affordances in the editor (anticipating later steps)
- [ ] **Matheo's smoke test**: open Settings, navigate to AI, enable it, set a fake provider config, close, reopen, verify state survived

### Expected commit

`feat(ai): AI section in Settings with provider configuration`

---

## STEP 3 — Anthropic provider (first cloud)

**Objective**: implement the first real provider so end-to-end testing becomes possible.

### Mission

1. Create `src/lib/ai/providers/anthropic.ts`:
   - Implements `AIProvider`
   - Calls the Claude Messages API (`/v1/messages`)
   - Uses the API key from settings
   - Default model: `claude-sonnet-4-5` (or current equivalent at time of activation)
2. Implement `validate()`: makes a minimal API call to verify the key works
3. Error handling:
   - 401 → "Invalid API key"
   - 429 → "Rate limit hit, try again in a moment"
   - 500+ → "Provider error, please try again"
   - Network error → "Cannot reach Anthropic. Check your connection."
4. The provider is registered in the registry at app startup if AI features are enabled
5. In the Settings AI section, add a "Test connection" button that calls `validate()`

### Validation criteria

- [ ] Anthropic provider implements the interface cleanly
- [ ] `validate()` correctly reports success or failure
- [ ] Error messages are clear and actionable
- [ ] Settings "Test connection" button works
- [ ] **Matheo's smoke test**: enter a valid API key, click Test → success; enter a bad key → error; manually invoke a reformulate call via dev console with a real selection → response received

### Expected commit

`feat(ai): Anthropic Claude provider with validation`

---

## STEP 4 — Cmd+I command + diff preview UX

**Objective**: wire the user-facing interaction. After this step, Cmd+I works end-to-end with the Anthropic provider on the reformulate action only (other actions ship in later steps).

### Mission

1. Register a command `ai.invoke` in the command registry (depends on PLAN-COMMAND-SYSTEM ✅)
2. Bind it to Cmd+I (with `Mod+I` cross-platform)
3. Behavior on invocation:
   - If selection exists → open the AI action menu near the selection (small floating menu with 3 actions)
   - If no selection → action menu still opens, but with the "structure" action available
4. Action menu UX:
   - Renders below or above the selection, like the BlockNote slash menu
   - Items: Reformulate / Fix grammar / Translate / Suggest structure (only "Suggest structure" without selection)
   - Reformulate has sub-items: Clearer / Concise / More formal / More casual
5. Selecting an action calls the active provider; show a loading indicator on the selection
6. Result: render the diff preview
   - Inline overlay above the original selection
   - Original (strikethrough, dim) + Proposal (highlighted)
   - Accept (Enter) replaces the selection in BlockNote with the proposal
   - Reject (Esc) removes the overlay, original selection intact
7. Only **Reformulate** action is wired in this step. Fix and Translate ship in Steps 6 and 7.

### Validation criteria

- [ ] Cmd+I opens the action menu near the selection
- [ ] Reformulate triggers an API call and shows a loading indicator
- [ ] Diff preview renders correctly
- [ ] Accept applies the change to BlockNote
- [ ] Reject leaves the selection intact
- [ ] **Matheo's smoke test**: select a paragraph, press Cmd+I, choose Reformulate → Clearer, wait for response, accept, verify the text changed in the editor

### Expected commit

`feat(ai): Cmd+I action menu with reformulate and diff preview`

---

## STEP 5 — Reformulate action (full sub-modes)

**Objective**: ensure all four reformulate sub-modes (clearer, concise, formal, casual) work well and produce distinctive outputs.

### Mission

1. Refine the `reformulate.ts` prompt template:
   - Each sub-mode is a separate prompt variation
   - Prompts emphasize preserving the original meaning and markdown formatting
   - Test against varied input (short sentences, paragraphs, lists, headings)
2. Edge cases:
   - Selection contains markdown syntax → preserve it (don't strip `*` or `**`)
   - Selection contains code → leave code blocks untouched
   - Selection is very short (< 10 words) → still works, doesn't over-paraphrase
   - Selection is very long (> 1000 words) → chunked, or graceful error if exceeds limits

### Validation criteria

- [ ] All four sub-modes produce visibly different results on the same input
- [ ] Markdown syntax preserved in the output
- [ ] Code blocks left intact
- [ ] Short and long selections handled
- [ ] **Matheo's smoke test**: pick a varied document, run each sub-mode on several selections, verify quality

### Expected commit

`feat(ai): reformulate action with four sub-modes`

---

## STEP 6 — Fix grammar action

**Objective**: implement the grammar/spelling correction action.

### Mission

1. Add the action to the Cmd+I menu
2. Prompt template focused on:
   - Fix grammar, spelling, punctuation
   - Do NOT change meaning, tone, or style
   - Preserve markdown
3. Diff UX same as Reformulate
4. Edge case: if no errors found, the proposal should equal the original — show "No corrections needed" instead of an empty diff

### Validation criteria

- [ ] Grammar/spelling errors are corrected
- [ ] Style is preserved (don't make casual writing formal)
- [ ] No false positives on already-correct text
- [ ] "No corrections needed" message shown when appropriate
- [ ] **Matheo's smoke test**: test on a paragraph with typos, on correct text, on text with stylistic quirks (verify they're preserved)

### Expected commit

`feat(ai): fix grammar and spelling action`

---

## STEP 7 — Translate action

**Objective**: implement translation to a configurable target language.

### Mission

1. Add the action to the Cmd+I menu
2. When invoked, show a quick language picker (or use the default from Settings)
3. Prompt template focused on natural translation, not literal
4. Preserve markdown formatting in the translated output
5. Settings: default target language already exists from Step 2

### Validation criteria

- [ ] Translation produces fluent text in the target language
- [ ] Markdown preserved
- [ ] Language picker works
- [ ] Default language from Settings is honored
- [ ] **Matheo's smoke test**: translate French → English and English → French on real documents

### Expected commit

`feat(ai): translate action with language picker`

---

## STEP 8 — OpenAI provider

**Objective**: add the second cloud provider to validate the abstraction.

### Mission

1. Create `src/lib/ai/providers/openai.ts`:
   - Implements `AIProvider`
   - Calls the Chat Completions API
   - Default model: `gpt-5` or current equivalent
2. Same error handling pattern as Anthropic
3. Register in the registry
4. Settings: add OpenAI config panel
5. Verify all three actions work with OpenAI as the active provider

### Validation criteria

- [ ] OpenAI provider works for all three actions
- [ ] Switching from Anthropic to OpenAI in Settings is seamless
- [ ] No code in the editor depends on which provider is active
- [ ] **Matheo's smoke test**: switch provider, run each action, verify behavior

### Expected commit

`feat(ai): OpenAI provider`

---

## STEP 9 — Ollama provider (local)

**Objective**: add the local provider — the sovereignty payoff.

### Mission

1. Create `src/lib/ai/providers/ollama.ts`:
   - Implements `AIProvider`
   - Calls a local Ollama endpoint (default `http://localhost:11434/v1/chat/completions`)
   - Configurable endpoint URL in Settings (for users with non-default Ollama setups)
   - Configurable model name (e.g., `llama3:8b`, `mistral:7b`, `qwen2.5:7b`)
   - `isLocal: true`
2. `validate()`: pings the endpoint, lists available models, verifies the configured model is installed
3. UI affordances:
   - Settings shows a "Local" badge next to Ollama in the provider list
   - First-time setup hint: "Install Ollama from ollama.com and pull a model. Recommended: `ollama pull llama3:8b`"
   - Latency expectation message in Settings: "Local AI runs entirely on your machine — slower but private."
4. Test all three actions with at least one local model

### Validation criteria

- [ ] Ollama provider connects to a local instance
- [ ] All three actions work with a local model (quality may be lower than cloud — that's expected and acceptable)
- [ ] Latency is acceptable (< 10s on a typical M-series Mac for a paragraph reformulation)
- [ ] Error handling: clear message if Ollama is not running, if the model is missing, etc.
- [ ] **Matheo's smoke test**: install Ollama, pull a model, configure in Settings, run each action, verify everything works fully offline (disconnect network and re-test)

### Expected commit

`feat(ai): Ollama local provider`

---

## STEP 10 — Structural action with block-level diff

**Objective**: implement the document-level structural suggestion action.

### Mission

1. Add the "Suggest structure" action to the Cmd+I menu (available without selection, or with a heading-only selection)
2. The action takes the current document (or a sub-section) as input
3. Prompt template asks the provider for:
   - A reorganized version of the document
   - Suggested headings if the document is unstructured
   - Logical grouping of related content
4. Output parsing:
   - The provider returns a structured proposal (e.g., markdown with annotations)
   - Frontend parses it into a block-level diff against the original BlockNote document
5. Diff UI:
   - Modal opens (the inline overlay doesn't scale for multi-block diffs)
   - Two-column layout: original on the left, proposal on the right
   - Each block color-coded: green (added), red (removed), yellow (moved), neutral (unchanged)
   - Buttons: Accept all / Reject all / (optional v1: Accept individual blocks)
6. On Accept: replace the editor content with the proposed structure

### Validation criteria

- [ ] Structural action runs on a real document
- [ ] Diff modal renders the comparison clearly
- [ ] Accept applies the new structure to BlockNote without losing content
- [ ] Reject leaves the document unchanged
- [ ] **Matheo's smoke test**: take an unstructured dump of notes, run Suggest structure, evaluate the proposal, accept and verify the result

### Expected commit

`feat(ai): structural suggestion with block-level diff`

---

## STEP 11 — Polish + error handling + closure

**Objective**: stabilize the full AI agent surface.

### Mission

1. Audit all error states across providers and actions
2. Add a "AI activity" indicator in the status bar: small dot showing idle / working / error
3. Cancellation: while a request is in flight, Esc cancels it
4. Cost awareness (cloud providers only): optional Settings toggle to show estimated tokens before submitting
5. Documentation:
   - Update `BACKLOG.md`: close v1 items, add v2 items (chat panel, RAG, multi-turn, streaming, custom prompts)
   - Update `JOURNAL.md`: AI agent v1 shipped, key decisions documented
   - Update `DESIGN-PRINCIPLES.md` if any new principle emerged (likely around AI sovereignty)
6. Playwright visual baseline for the AI action menu and the diff preview UI

### Validation criteria

- [ ] All known error paths produce clear messages
- [ ] Status bar indicator accurate
- [ ] Cancellation works mid-request
- [ ] Documentation complete
- [ ] Playwright baselines passing
- [ ] **Matheo's final smoke test**: full guided tour of the agent across all providers, sign-off on the feel

### Expected commit

`chore(ai): polish, error handling, and documentation`

---

## QUESTIONS ANTICIPATED

### "What if a user wants to write custom prompts?"

V2. The v1 ships with three curated prompts that work well. Custom prompts open a Pandora's box (prompt injection, quality variance, support burden) that's not worth opening before the core UX is proven.

### "What if Matheo wants a chat panel during this plan?"

Refuse politely: "Noted in BACKLOG.md for v2." This plan explicitly defers the chat panel. The Cmd+I pattern is the v1 contract.

### "What if Ollama is too slow to be useful?"

Document the latency honestly. Some users will prefer slower-but-private. Others will choose the cloud option. The architecture supports both — that's the whole point of S3.

### "What if a provider releases a new API shape mid-development?"

Adapt the relevant provider file. The abstraction insulates the rest of the codebase. This is the second payoff of S2.

### "What if we discover a quality gap between cloud and local that breaks the UX?"

Document it. Surface it in the UI ("This action works best with a cloud provider"). Don't pretend the gap doesn't exist. Sovereignty doesn't mean lying about trade-offs.

### "Should the agent see the user's full document for context, even on single-selection actions?"

V1 keeps it minimal: selection + small surrounding context (1 block before and after). Full-document context is a v2 enhancement that needs careful thought on privacy implications for local-vs-cloud parity.

---

## VISION BEYOND V1 — WHAT V2 COULD HOLD

For future reference, items that are explicitly **out of v1** but worth keeping in mind as the agent matures:

- **Chat panel** as an optional secondary surface (not replacing Cmd+I)
- **Multi-turn refinement** on a proposal ("make it shorter still")
- **Streaming responses** for snappier feel on long outputs
- **Custom prompt library** with user-defined actions
- **RAG over the vault** with local embeddings (the privacy concerns here are deep — needs its own design pass)
- **Per-document AI preferences** (some docs opt out of any AI involvement)
- **Action history** ("undo last AI change" already covered by Ctrl+Z, but a dedicated history could surface what the agent did)
- **Inline ghost text suggestions** (Copilot-style autocomplete in prose) — controversial, may break the "invisible until called" principle

---

## STARTUP PROMPT FOR CLAUDE CODE (IF ACTIVATED)

```
You're starting work on PLAN-AI-AGENT.md.

Prerequisites (ALL required):
- PLAN-BLOCKNOTE ✅ fully complete
- PLAN-DESIGN-DEFAULTS ✅ fully complete
- PLAN-COMMAND-SYSTEM ✅ fully complete
- PLAN-SETTINGS ✅ fully complete
- Explicit GO from Matheo to activate this backlogged plan

Read PLAN-AI-AGENT.md and DESIGN-PRINCIPLES.md BEFORE any action.

CRITICAL: The three sovereignty rules (S1, S2, S3) are non-negotiable. AI is opt-in,
provider-agnostic, and local providers are first-class from day one.

Main rules:
- One step at a time, no parallelization
- Mandatory wrap-up at end of step with exact test URL, procedure, what's visible
- Mandatory interactive smoke test by Matheo before moving to the next step
- DESIGN-PRINCIPLES.md and the sovereignty rules are authoritative
- The scope is locked. No chat panel, no RAG, no custom prompts in v1.

Next step: STEP 1 — Provider abstraction + types.

At the start, confirm you've read both documents AND the sovereignty rules,
give me your attack plan for Step 1, and wait for my GO before coding.
```

---

## CHANGELOG

- **2026-05-11** — v0.1 — Initial draft generated after strategic discussion. Plan filed as backlogged for future activation after PLAN-SETTINGS completion. Three sovereignty rules formalized as the architectural spine. Chat panel explicitly deferred to v2.
