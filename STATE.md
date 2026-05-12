# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-12 (nuit) — session autonome overnight :
- **Merge de `feat/design-defaults` sur `main`** (fast-forward).
- **Cleanup des 3 branches obsolètes** (design-defaults + 2 blocknote).
- **Folder-delete EPERM macOS** fixé (commit `2fadb5b`).
- **PLAN-SETTINGS STEP 1 + STEP 2** livrés (commits `c4db29f`, `59893c7`).
- Tentative d'agent drag-drop en worktree → tué en cours de RED phase (cf. § Bugs CONNUS).
- **Politique branches changée** : Matheo travaille seul, commits directement sur `main`. Plus de `feat/*` par chantier. Documenté dans la mémoire `[[feedback-branch-strategy]]` + `[[feedback-merge-authorization]]`.

## Branche courante

`main` — **17 commits ahead de `origin/main`** (jamais pushé par Claude — règle conservée). Les 17 commits :

```
59893c7 feat(settings): modal shell with section navigation                    ← STEP 2 settings v1
c4db29f feat(settings): persistent settings store with Tauri backend           ← STEP 1 settings v1
2fadb5b fix(files): folder deletion uses remove_dir_all (fixes EPERM on macOS) ← folder-delete fix
659eba2 chore(state): refresh handoff docs post-audit (STATE + JOURNAL)
b969fb6 fix(audit): address pre-merge review findings (a11y + security + drag)
e791d91 fix(slash-menu): flip menu above caret when bottom space is insufficient
3dac8c3 chore(design-defaults): STEP 10 closure — progress table, decisions, principles
8ca96a3 test(visual): full design baseline coverage — STEP 9
92b358c design(empty-state): bump card icons to 20px per design defaults
a9f89aa feat(ui): Warp-style sidebar toggle in window chrome — STEP 7
e7a987d feat(ux): EmptyState launcher + launch on welcome — STEP 6
aa90373 feat(design): micro-interactions baseline — STEP 5
6136502 feat(design): spacing rhythm sweep + .button floor compliance — STEP 4
0e37004 feat(design): migrate components to --font-ui / --font-editor split — STEP 3
9378691 feat(design): theme-aware danger surface + WCAG fix — STEP 2
e6c459e feat(design): augment CSS token namespace — STEP 1
bc0d93b feat(editor): finalize PLAN-BLOCKNOTE step 4 (UI finish)
```

(Les 13 premiers commits étaient la branche `feat/design-defaults` mergée en FF, puis 4 nouveaux ce soir.)

## Sessions précédentes archivées dans `JOURNAL.md`

- 2026-05-11 (matin) : clôture BlockNote (C1) → merge effectué.
- 2026-05-11/12 (après-midi/nuit) : PLAN-DESIGN-DEFAULTS 10 steps complets + slash-menu flip fix + audit pré-merge.
- **2026-05-12 (nuit, autonome) : merge design-defaults + folder-delete fix + PLAN-SETTINGS STEP 1 + STEP 2.** (cette session)

## Tests (état final sur `main` après cette session)

- **cargo test : 87/87 ✅** (74 historique + 5 folder-delete + 8 settings backend)
- **vitest : 213/213 ✅** (193 + 10 settings store + 10 SettingsModal component)
- **svelte-check : 0 erreur / 0 warning ✅**
- **Playwright visual : 45/45 ✅** (40 + 5 settings-modal : dark + light shell baseline + deep-link + escape close + backdrop close)
- E2E real-binary : 1 placeholder skipped (jamais monté, hors scope MVP)
- `npm run build` : à re-confirmer en début de prochaine session (non lancé pendant la nuit)

Aucun test ne touche le filesystem utilisateur réel.

## Ce qui a été livré pendant cette session

### Fix folder-delete EPERM macOS (commit `2fadb5b`)

Diagnostic posé le 2026-05-10 (mémoire `pending_folder_delete.md`, désormais à supprimer). Bug : `delete_file` (qui appelle `fs::remove_file`) était utilisé pour les fichiers ET les dossiers ; `unlink(2)` sur un dossier macOS retourne EPERM.

Fix livré :
- Nouvelle commande Rust `commands::files::folder_delete` (resolve_safe_path → ensure_writable → refus si racine vault → `fs::remove_dir_all`).
- Enregistrée dans `lib.rs` invoke_handler.
- Front : nouveau wrapper `folderDelete` dans `tauri/api.ts`. `Sidebar.svelte:confirmDeleteEntry` dispatch `entry.isDirectory ? folderDelete : fileDelete`.
- 5 tests Rust : empty/non-empty/refuse root/refuse traversal/refuse readonly.

### PLAN-SETTINGS STEP 1 (commit `c4db29f`)

Data layer pour la v1 des préférences user :

**Backend Rust :**
- `models::UserSettings` avec sous-structs (appearance, editor, source, files, behavior) + `Default` impls.
- `commands::settings::{settings_read, settings_write}` Tauri commands. Atomic write (`.tmp` → rename), corruption-safe (malformed JSON → defaults + `.bak`).
- 8 tests Rust : defaults / round-trip / parent dir / pas de tmp leftover / malformed → defaults + backup / overwrite atomique / defaults documentés / JSON keys camelCase.

**Front Svelte 5 :**
- `tauri/types.ts` : types `UserSettings` + sections + `DEFAULT_USER_SETTINGS` constant.
- `tauri/api.ts` : wrappers `settingsRead` / `settingsWrite`.
- `stores/settings.svelte.ts` : `settingsStore` (rune `$state`), debounced 250ms persist via `setTimeout`. **Le theme est délégué au `themeStore` existant** (lui reste l'applicator runtime + listener `prefers-color-scheme`).
- Boot hydration câblée dans `+page.svelte` après `vaultsStore.load` et `themeStore.init`.
- 10 tests vitest : load/falls-back/idempotent/set immediate/persists/debounce-collapse/setTheme/no-bridge-when-unchanged/load-bridges-theme/mergeWithDefaults.

**Déviations documentées du plan :**
- `appearance.theme` reste typé `'dark' | 'light' | 'system'` (legacy 3-value) au lieu des 4 themes du plan — leur CSS n'existe pas, c'est STEP 3.
- `editor_line_height: f64` → drop du derive `Eq` sur le struct (PartialEq suffit pour les tests).

### PLAN-SETTINGS STEP 2 (commit `59893c7`)

UI shell du modal :

**Composant `SettingsModal.svelte` :**
- Backdrop (`var(--color-backdrop)` z-index 200) + panneau centré 760×600 (`--radius-xl`, `--shadow-xl`, `--color-bg-raised`).
- Header : titre + bouton X.
- Body : left rail 200px (6 sections avec icônes Lucide) + content area.
- Right pane : placeholder ("Les contrôles de cette section seront ajoutés à l'étape suivante.") — STEP 3+ remplit.
- A11y : `role="dialog"` + `aria-modal` + `aria-labelledby` ; rail items avec `aria-current` sur la section active ; icônes Lucide `aria-hidden focusable=false`.
- Auto-focus du panel à l'ouverture (Escape marche sans premier clic).
- Backdrop click + Escape ferment.
- Tous les visuels via tokens design-system (zéro hex/px hardcodé).

**Store additions (`settings.svelte.ts`) :**
- `isOpen` + `activeSection` runes `$state`.
- `open(section?)` / `close()` méthodes.
- `SETTINGS_SECTIONS` typed const + `SettingsSection` union (pour deep-link via `settings.open.appearance` etc. — utilisé par PLAN-COMMAND-SYSTEM plus tard).

**Trigger temporaire :**
- Global keydown handler `Cmd+,` / `Ctrl+,` dans `+page.svelte` (binding direct en attendant que PLAN-COMMAND-SYSTEM route ça via le command registry).

**Tests :**
- 10 tests vitest component : pas rendu si fermé, 6 sections présentes, Appearance par défaut, switch section sur clic, deep-link via `open(section)`, close-button, backdrop click ferme (sauf clic dans le modal), Escape ferme, Escape no-op si déjà fermé, attributs a11y corrects.
- 5 tests visual Playwright : shell dark, shell light, deep-link advanced, escape close, backdrop close. Nouveau fixture `?fixture=settings-modal&section=...` dans `/_visual`.

## Bugs CONNUS hors scope

- **Drag-drop fichier → dossier dans la sidebar** : ~~"doesn't work at all"~~ → **re-validé par Matheo le 2026-05-12 matin** : marche en réel après cette nuit. Rien dans `main` n'a touché `FileTree.svelte` (l'agent drag-drop a été tué en RED phase, son fichier test perdu avec son worktree), donc soit le bug du 11/05 était transient, soit il subsiste discret (un toast d'erreur très bref non-vu). À surveiller pendant l'usage normal. Le chantier C3 (réécriture HTML5 → pointer events) peut être déprioritisé tant qu'aucun nouveau symptôme n'apparaît.

## Worktrees / agents : leçon de la nuit

- Lancé 2 agents parallèles (folder-delete + drag-drop) avec `isolation: "worktree"`. **Les deux ont opéré dans mon arbre principal au lieu de leur worktree**, probablement parce que les prompts mentionnaient des paths comme `src-tauri/src/...` que les agents ont résolus contre `/Users/lkid/Projects/products/markhub` (le project root cité dans le prompt). L'agent folder-delete a même stashé mes travaux WIP settings avant de coder ses propres edits — comportement "poli" mais hors-scope.
- Le folder-delete fix était fonctionnel et committé dans le main worktree (`2fadb5b`), donc récupération propre via `git stash pop` + cleanup.
- L'agent drag-drop a été interrompu trop tôt ; rien à récupérer.
- **Pour les futures sessions** : éviter `Agent + isolation: worktree` quand les prompts font référence à des paths absolus, ou bien les agents prendre soin de localiser eux-mêmes leur CWD. Voir mémoire `[[feedback-parallel-agent-worktrees]]`.

## État des chantiers (workplan)

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ sur `main` (2026-05-11) |
| PLAN-DESIGN-DEFAULTS (10 steps) | ✅ MERGÉ sur `main` (2026-05-12 nuit) |
| **PLAN-SETTINGS (8 steps)** | **🟡 EN COURS — STEP 1 + 2 ✅ sur `main`, STEP 3 next** |
| PLAN-COMMAND-SYSTEM (Cmd+K / Cmd+P / Shift+F) | PAS DÉMARRÉ — plan rédigé. Prerequisite (DESIGN-DEFAULTS ✅) levé. Mais Matheo a explicitement dit "settings d'abord". |
| Folder-delete EPERM | ✅ FIXÉ sur `main` (2026-05-12 nuit) |
| C2 — Toast / notifications | DÉBLOQUÉ |
| C3 — Drag-drop sidebar (HTML5 → pointer events) | 🟡 USER-VALIDATED OK 2026-05-12 matin — chantier déprioritisé sauf nouveau symptôme |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — explicitement skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief posé, aucun code |
| Empty state | ✅ LIVRÉ dans DESIGN-DEFAULTS STEP 6 |

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie permanente)
3. `WORKPLAN.md` (plan global)
4. `JOURNAL.md` (dernières entrées — clôture STEP 1 + 2 de SETTINGS au 2026-05-12 nuit)
5. **`plan-110526/PLAN-SETTINGS.md`** (chantier ACTIF — tableau de progression à jour, STEP 3 next)
6. `plan-110526/DESIGN-PRINCIPLES.md` (source de vérité visuelle)
7. `plan-110526/PLAN-COMMAND-SYSTEM.md` (prochain chantier après SETTINGS)
8. `BACKLOG.md` (hors-scope MVP)
9. `SPEC.md` / `design.md` / `PLAN.md` (référence)

## Smoke tests — TOUS VALIDÉS par Matheo le 2026-05-12 matin ✅

1. **Folder-delete (bug du 10/05)** : ✅ "marche très bien"
2. **Drag-drop sidebar fichier → dossier** : ✅ "marche très bien" (surprise — voir §"Bugs CONNUS")
3. **Settings modal STEP 2** : ✅ "Modal apparaît bien", navigation rail OK, placeholders normaux à droite
4. **Pas de régression** : ✅ "tout a l'air de fonctionner très bien"

## Prochaine étape

**STEP 3 — Appearance section** (PLAN-SETTINGS) : theme cards row + editor font selector + sliders fontSize / lineHeight / contentWidth + live preview paragraph. Demande l'oeil de Matheo (visuel + live preview) → laissée hors session autonome.

Une fois Matheo a validé les smoke tests STEP 1+2, je peux attaquer STEP 3 en session collaborative.

## Mémoire persistante mise à jour

- `pending_folder_delete.md` → **à supprimer** (bug fixé).
- `feedback-branch-strategy.md` → nouveau : Matheo travaille seul, commits directement sur `main`.
- `feedback-merge-authorization.md` → nouveau : Claude peut merger / supprimer branches locales sans demander.
- `feedback-parallel-agent-worktrees.md` → nouveau : limites du dispatch parallèle avec isolation: worktree.
