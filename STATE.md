# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-12 (nuit) — clôture **PLAN-DESIGN-DEFAULTS** (chantier design defaults, 10 steps) + 2 fixes post-clôture (slash-menu flip + audit pré-merge). Branche `feat/design-defaults` **prête à merger** sur `main`. **Le merge est manuel — il doit être fait par Matheo, pas par Claude** (règle explicite du plan + bloqué côté auto-classifier).

> Note : la migration BlockNote (chantier C1) a déjà été mergée sur `main` (commit `0e72755`). `main` est désormais l'app BlockNote, plus l'app Crepe historique.

## Branche courante

`feat/design-defaults` — **non mergée**, 13 commits ahead de `main` :

```
b969fb6 fix(audit): address pre-merge review findings (a11y + security + drag)
e791d91 fix(slash-menu): flip menu above caret when bottom space is insufficient
3dac8c3 chore(design-defaults): STEP 10 closure — progress table, decisions, principles
8ca96a3 test(visual): full design baseline coverage — STEP 9
92b358c design(empty-state): bump card icons to 20px per design defaults — STEP 8
a9f89aa feat(ui): Warp-style sidebar toggle in window chrome — STEP 7
e7a987d feat(ux): EmptyState launcher + launch on welcome — STEP 6
aa90373 feat(design): micro-interactions baseline — transitions + focus rings — STEP 5
6136502 feat(design): spacing rhythm sweep + .button floor compliance — STEP 4
0e37004 feat(design): migrate components to --font-ui / --font-editor split — STEP 3
9378691 feat(design): theme-aware danger surface + WCAG fix — STEP 2
e6c459e feat(design): augment CSS token namespace — STEP 1
bc0d93b feat(editor): finalize PLAN-BLOCKNOTE step 4 (UI finish)  ← reliquat BlockNote tail
```

(`bc0d93b` est le reliquat BlockNote "UI finish" fait au démarrage de la session. `e791d91` corrige un bug du slash menu existant remonté pendant la clôture. `b969fb6` adresse 5 P0 + plusieurs P1 issus d'un code review par 2 agents lancé pré-merge.)

## Sessions précédentes archivées dans `JOURNAL.md`

- 2026-05-11 (matin) : clôture BlockNote (chantier C1) → merge effectué.
- 2026-05-11/12 (après-midi/nuit) : PLAN-DESIGN-DEFAULTS 10 steps complets + slash-menu flip fix + audit pré-merge (a11y + security) → cette branche.

## Tests (état final sur la branche `feat/design-defaults`)

- cargo test : **74/74 ✅** (60 historique + 8 nouveaux pour les 3 vault commands STEP 6 + 5 nouveaux pour `validate_open_url` post-audit + 1 nouveau pour `derive_vault_name_from_git_url` post-audit)
- npm run test (vitest) : **193/193 ✅**
- npm run check (svelte-check) : **0 erreur / 0 warning ✅**
- npm run test:visual (Playwright) : **40/40 ✅** (34 préservés + 5 STEP 9 + 1 nouveau pour le slash-menu flip = `tests/visual/blocknote-slash-menu.spec.ts`)
- npm run test:e2e : 1 placeholder skipped (real-binary jamais monté — hors scope MVP)
- npm run build : à re-confirmer en début de session suivante (jamais fait pendant la session)

Aucun test ne touche le filesystem utilisateur réel.

## Moteur d'éditeur dans l'app principale

**BlockNote** (`@blocknote/core@^0.50.0`). Monté dans `src/lib/components/Editor.svelte`.

Crepe (`@milkdown/crepe`, `@milkdown/core`, `@milkdown/preset-commonmark`) **complètement désinstallé** à l'étape 5 (commit `e52536a` — purge de 38+ deps transitives Tiptap/ProseMirror).

Composants UI Svelte BlockNote livrés (5/5) :
1. `src/lib/components/BlockNoteSlashMenu.svelte` (`9256f57`)
2. `src/lib/components/BlockNoteFormattingToolbar.svelte` (`c8587d7`)
3. `src/lib/components/BlockNoteSideMenu.svelte` (`31193c6`)
4. `src/lib/components/BlockNoteTableHandles.svelte` (`a250096`)
5. `src/lib/components/BlockNoteLinkToolbar.svelte` (`be13afa`)

CSS polish Markhub design system : `src/lib/styles/editor-blocknote.css` (`7ae23e7`) — mappe les 6 variables `--bn-*` exposées par BlockNote vers les tokens `--color-*` Markhub, neutralise les hex hardcodés (code blocks, blockquotes, tables, drop cursors).

Frontmatter handling préservé : `splitFrontmatter` / `joinFrontmatter` en pré/post-traitement, `<details>` collapsed au-dessus de l'éditeur, round-trip YAML intact (3 fixtures `tests/fixtures/c1/*.md` valident).

## Bugs RÉSOLUS pendant la migration

- **Drag-drop block "pas de ligne bleue rien" (Crepe)** : résolu nativement par BlockNote (plugin DropCursor + SideMenu via composant Svelte 2.5.c).
- **Drag preview leak `.preview { position: relative }`** : trouvé en testant 2.5.d. La clone du drag preview de BlockNote (1280×410, opacity 0.001) restait dans le flow à cause d'un reliquat CSS Crepe, poussant la status bar à chaque dragstart. Fix : retrait de la règle (`a250096`).
- **Tauri WKWebView interception drag HTML5** : `dragDropEnabled: true` (défaut) absorbe les events drag/drop pour exposer l'API file-drop OS. Sur macOS, ça bloquait tout drag in-page. Fix : `dragDropEnabled: false` dans `tauri.conf.json` (`21ac2ee`). Trade-off : on perd l'API file-drop OS (Markhub ne l'utilisait pas).
- **`replaceBlocks` initial déclenche `onChange`** : sans précaution, le mount du fichier ré-emettait le contenu vers `onChange` → autosave inutile. Flag `suppressNextChange` ajouté (`902bf82`).
- **`Shift+Home` non-déterministe dans la contenteditable BlockNote (Playwright)** : workaround via `Shift+ArrowLeft × N` documenté dans le helper `typeAndSelect`.

## Bugs CONNUS hors scope migration

- **Drag-drop fichier → dossier dans la sidebar** : "doesn't work at all" en réel (HTML5 native dans `FileTree.svelte`). Workplan §C3 prévoit la migration vers pointer events. **Non investigué pendant C1**, reste à faire.
- **Folder-delete sidebar EPERM (macOS)** : `confirmDeleteEntry` route les dossiers vers `fileDelete` (Rust `fs::remove_file`) qui renvoie EPERM. Bug code, pas TCC. Diagnostic complet posé 2026-05-10 par 2 agents diag. **À fixer sur branche `fix/folder-delete-permission` depuis `main`**, post-merge C1.

## Ce qui MARCHE en réel (smoke des étapes ⏸ pending validation explicite)

Tests automatiques verts + smoke partiel confirmé pour :
- Édition WYSIWYG BlockNote (taper, autosave 1.5s).
- Slash menu (`/`) — apparition, filtrage, transform.
- Formatting toolbar — sélection → toolbar au-dessus, B/I/S/code/lien.
- Side menu — hover block → `⋮⋮` + `+`, drag-reorder via `⋮⋮` avec drop indicator natif, click `⋮⋮` → sub-menu transform.
- Table handles — hover cellule → row/col handles draggables, +row sur dernière row, +col sur dernière col, resize colonne natif.
- Link toolbar — click sur lien existant → toolbar au-dessous, édition URL + Enter, bouton supprimer.
- Frontmatter — `<details>` au-dessus, round-trip préservé.
- Tauri drag-drop — explicitement validé par l'user ("OK ! bravo").

**Validations user explicites pendantes** : étapes 2.5.a, 2.5.b, 4 (bascule), 2.5.c (smoke partiel post-Tauri-fix), 2.5.d, 2.5.e, 3 (polish), 5 (cleanup). L'user a autorisé le run au bout sans smoke entre chaque étape (décision conjointe documentée).

## État des autres chantiers (workplan)

| Chantier | Statut |
|---|---|
| **C1 — Migration Crepe → BlockNote** | **✅ MERGÉ sur `main` (commit `0e72755`)** |
| **PLAN-DESIGN-DEFAULTS (10 steps)** | **✅ TERMINÉ 2026-05-11 — branche `feat/design-defaults` prête merge** |
| PLAN-COMMAND-SYSTEM (Cmd+K / Cmd+P / Shift+F) | PAS DÉMARRÉ — plan rédigé, à attaquer post-merge DESIGN-DEFAULTS |
| PLAN-SETTINGS (panel settings) | PAS DÉMARRÉ — plan rédigé, à attaquer après COMMAND-SYSTEM |
| C2 — Système de toast / notifications | DÉBLOQUÉ |
| C3 — Drag-drop sidebar (HTML5 → pointer events) | DÉBLOQUÉ — bug CASSÉ confirmé en réel, reste à investiguer |
| Folder-delete EPERM (hors plan) | DIAGNOSTIQUÉ — fix prêt à coder sur `fix/folder-delete-permission` depuis `main` |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — explicitement skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief posé, aucun code |
| Empty state | ✅ LIVRÉ dans DESIGN-DEFAULTS STEP 6 |

## Fichiers temporaires conservés (déviations du plan, justifiées)

- `MIGRATION-NOTES.md` (racine) : notes d'investigation BlockNote. Plan disait de la supprimer à l'étape 5. **Conservée** : aucune dépendance code, valeur historique, zéro coût.
- `src/routes/_blocknote-test/+page.svelte` : route dev BlockNote. Plan disait de la supprimer. **Conservée** : 3 specs E2E actives (`blocknote-slash-menu`, `blocknote-formatting-toolbar`, `blocknote-roundtrip`, 8 tests) l'utilisent comme dev test surface. Migrer ces specs vers `/_visual` aurait coûté plus que la valeur. Route dev-only, ne pollue pas le bundle prod.

## Stash

- `agents-prep-work-stash` (~2 semaines, refactors I1/I2 obsolètes). Drop probable, à arbitrer.

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie permanente)
3. `WORKPLAN.md` (plan global, C1 mergé, DESIGN-DEFAULTS prête merge, COMMAND-SYSTEM/SETTINGS au planning)
4. `JOURNAL.md` (dernières entrées — clôture DESIGN-DEFAULTS au 2026-05-11)
5. `plan-110526/PLAN-DESIGN-DEFAULTS.md` (tableau de progression complet + commit ladder + décisions clés)
6. `plan-110526/DESIGN-PRINCIPLES.md` (source de vérité visuelle — nuance density chrome/canvas ajoutée 2026-05-11)
7. `plan-110526/PLAN-COMMAND-SYSTEM.md` (prochain chantier à attaquer post-merge)
8. `BACKLOG.md` (hors-scope MVP)
9. `SPEC.md` / `design.md` / `PLAN.md` (référence)

Mémoire persistante : `pending_folder_delete.md` rappelle le diagnostic du bug folder-delete pour la prochaine session quand l'user voudra l'attaquer.
