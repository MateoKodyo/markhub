# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-13 (nuit/matin) — fin de session marathon depuis le 2026-05-12. Bilan :

- **Settings v1 STEPS 1-5 livrés** (5 sections sur 8). 10/12 réglages marchent en réel. STEP 6 (Avancé), 7 (Command palette integration), 8 (Closure) restent à faire.
- **Folder-delete EPERM** : ✅ mergé + smoke OK.
- **Polish StatusBar + Modal fade** : ✅ livré.
- **Drag-drop vers Finder** : tenté avec `@crabnebula/tauri-plugin-drag` v2.1.1 → **plugin panique au démarrage** (bug RecvError dans le plugin Rust, pas notre code). **Reverté.**
- **Import de fichiers** : ✅ livré comme alternative orchestrable au drag-drop. Bouton 📥 dans le header de la section Fichiers, sélection multi-fichiers via dialog natif Tauri, copie dans le vault avec gestion des collisions (suffixe ` copie`), deselect Finder-style en cliquant sur l'espace vide.

## Branche courante

`main` — **33 commits ahead de `origin/main`** (jamais pushé depuis le merge BlockNote du 2026-05-11). Push à faire en fin de session.

Récap des commits récents (depuis le précédent STATE) :

```
6124575 fix(sidebar): clicking the empty file-list area clears the selection
ae5fbd9 feat(sidebar): import external markdown files into the active vault
81451d8 Revert "feat(sidebar): Cmd-drag a file out to the Desktop / Finder"
80b082b feat(sidebar): Cmd-drag a file out to the Desktop / Finder         ← reverté
e3b313e polish(settings): status-bar layout + modal entrance + path copy icon
506d1ec docs(backlog): track deferred editor body typography wiring
b2c19d2 revert(settings): defer editor body typography wiring to BACKLOG
afe0ae1 fix(settings): wire appearance typography to the actual editor (live)  ← reverté
4dcb51f chore(plan): fix STEP 5 commit hash in PLAN-SETTINGS table
40feb30 feat(settings): source + files + behavior sections (+ StatusBar gear)
7f09739 chore(plan): fix STEP 4 commit hash in PLAN-SETTINGS table
d9dd033 feat(settings): editor section + wire autosave & spellcheck consumers
13489ac refactor(settings): flatten appearance section to Markhub visual language
39d2027 feat(settings): appearance section — themes + font + sliders + live preview
286417a chore(state): mark settings STEP 1+2 + drag-drop C3 as user-validated
66a349d chore(state): refresh handoff docs after settings STEP 1+2 + folder-delete
59893c7 feat(settings): modal shell with section navigation
c4db29f feat(settings): persistent settings store with Tauri backend
2fadb5b fix(files): folder deletion uses remove_dir_all (fixes EPERM on macOS)
659eba2 chore(state): refresh handoff docs post-audit (STATE + JOURNAL)
[+ 13 commits design-defaults antérieurs]
```

## Tests (état final, code stable post-revert)

- cargo : **100/100 ✅** (87 + 13 nouveaux pour `import_files`)
- vitest : **242/242 ✅**
- svelte-check : **0 erreur / 0 warning ✅**
- Playwright visual : **50/50 ✅**

Aucun test ne touche le filesystem utilisateur réel.

## État détaillé des 12 réglages Settings v1

| Section | Réglage | Modal preview | App réel |
|---|---|---|---|
| **Apparence** | Thème | ✅ | ✅ live |
| | Police éditeur | ✅ | ⚠️ headings live, **body ❌ (BACKLOG)** |
| | Taille de police | ✅ | **❌ body (BACKLOG)** |
| | Hauteur de ligne | ✅ | **❌ body (BACKLOG)** |
| | Largeur de contenu | ✅ | ✅ live |
| **Éditeur** | Délai autosave | n/a | ✅ live (smoke OK) |
| | Correction orthographique | n/a | ✅ live (smoke OK) |
| **Mode source** | Police monospace | ✅ | ✅ live (smoke OK) |
| **Fichiers** | Confirm avant suppression | n/a | ✅ live (smoke OK) |
| **Comportement** | Demander avant quitter unsaved | n/a | ✅ live (smoke OK) |
| **StatusBar** | Icône engrenage | — | ✅ ouvre le modal |
| **Cmd+,** | Raccourci global | — | ✅ ouvre le modal |

## Bugs / dettes en cours

### Body editor typography (Apparence — STEP 3 partiel)

Le wiring de `appearance.editorFontSize` + `editorLineHeight` + `editorFont` au body de l'éditeur a été tenté en 4 escalades (CSS variable, CSS variable + specificity, CSS !important × N sélecteurs, JS-driven inline styles + MutationObserver) puis **reverté** (commit `b2c19d2`) après que la dernière approche ait freezé l'éditeur (MutationObserver bouclant). Cause racine : BlockNote applique son propre cascade sur `.bn-default-styles`, `.bn-block-outer` et `.bn-block-content[data-content-type=...]`.

**Chemin propre identifié** : passer par l'API de theming BlockNote (le fichier `editor-blocknote.css` utilise déjà ses tokens `--bn-*` propres). Reste à faire, tracé dans `BACKLOG.md`.

### Drag-drop OS vers Finder (C4 — déprio)

Plugin `@crabnebula/tauri-plugin-drag` v2.1.1 a un bug : panic au démarrage avec "called Result::unwrap() on an Err value: RecvError" dans `commands.rs:162:15`. Reverté (`81451d8`).

Alternatives identifiées si on veut reprendre :
- `tauri-plugin-dragout` (alexqqqqqq777, 95 stars, dédié macOS) — pas testé.
- Custom Rust avec NSPasteboard natif (~3-4h, robuste).

**Décidé avec Matheo le 2026-05-13** : drag-drop OS pas vital pour Markhub (c'est pas le mécanisme principal). Le bouton **Import** couvre 90% du besoin. Drag-drop OS reste optionnel, à reprendre en session fraîche si nécessaire.

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ sur `main` (2026-05-11) |
| PLAN-DESIGN-DEFAULTS (10 steps) | ✅ MERGÉ sur `main` (2026-05-12 nuit) |
| **PLAN-SETTINGS (8 steps)** | **🟡 EN COURS — STEPS 1-5 ✅, STEP 6/7/8 restants** |
| Folder-delete EPERM | ✅ FIXÉ + smoke OK |
| **Import de fichiers markdown** | ✅ LIVRÉ 2026-05-13 |
| C2 — Toast / notifications | DÉBLOQUÉ — pas démarré |
| C3 — Drag-drop sidebar HTML5 → pointer events | 🟡 USER-VALIDATED OK 2026-05-12 matin — déprio'd |
| C4 — Drag-drop OS vers Finder | ⛔ TENTÉ + REVERTÉ — plugin tiers buggué, déprio'd |
| C5 — Drag-drop OS depuis Finder | ⏳ PAS DÉMARRÉ — `dragDropEnabled: false` bloque |
| PLAN-COMMAND-SYSTEM (Cmd+K / Cmd+P / Shift+F) | ⏳ PAS DÉMARRÉ — plan rédigé, après Settings clôture |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — explicitement skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief posé |

## Smoke tests validés par Matheo le 2026-05-12 / 13

- ✅ Folder-delete (bug du 10/05)
- ✅ Drag-drop sidebar fichier → dossier
- ✅ Settings modal — open via Cmd+, + via icône StatusBar, 6 sections, navigation, fermeture
- ✅ Theme switch live
- ✅ Mono font live (source mode + code blocks)
- ✅ Content width slider live
- ✅ Autosave delay slider live
- ✅ Spellcheck toggle live (BlockNote + source mode)
- ✅ Confirm-before-delete toggle
- ✅ Ask-before-closing-unsaved toggle (force-save)
- ✅ StatusBar reorder + copy icon + fade-in modal
- ✅ Import multi-fichiers + deselect Finder-style

⚠️ Smoke à refaire si tests visuels post-push :
- `npm run build` (jamais lancé pendant la session)

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie)
3. `WORKPLAN.md` (plan global)
4. `JOURNAL.md` (dernière entrée — clôture session marathon 2026-05-12/13)
5. `plan-110526/PLAN-SETTINGS.md` (chantier ACTIF — table de progression à jour, STEP 6/7/8 restent)
6. `plan-110526/DESIGN-PRINCIPLES.md`
7. `plan-110526/PLAN-COMMAND-SYSTEM.md` (prochain chantier post-Settings)
8. `BACKLOG.md` (dette editor body typography tracée)

## Prochaine session — options

- **STEP 6 Settings (Avancé)** : Open config folder + Export/Import JSON + version display. ~1h. Petit, propre, clôture Settings v1 en partie.
- **STEP 7 + 8 Settings** : intégration command palette + audit final. Dépend de PLAN-COMMAND-SYSTEM.
- **PLAN-COMMAND-SYSTEM (Cmd+K / Cmd+P / Shift+F)** : 8 steps. Gros chantier mais débloque STEP 7.
- **Body typography fix via BlockNote theming API** : régler la dette de STEP 3. ~2-3h research + dev.
- **C5 drag-drop depuis Finder** : test `dragDropEnabled: true` + BlockNote → si OK, simple à câbler.

Mémoire persistante mise à jour :
- `feedback_communication_style.md` — Matheo veut des réponses conceptuelles, pas des dumps techniques
- `feedback_branch_strategy.md` — commits directs sur main
- `feedback_merge_authorization.md` — Claude peut merger/supprimer branches locales
- `feedback_parallel_agent_worktrees.md` — éviter dispatch parallèle avec isolation worktree
