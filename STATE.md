# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-11 — clôture migration BlockNote (chantier C1). Branche `feat/blocknote-migration` prête à merger sur `main`. **Le merge est manuel — il sera fait par Matheo, pas par Claude.**

## Branche courante

`feat/blocknote-migration` — **non mergée**, 12 commits ahead de `main` :

```
e52536a chore(editor): remove Crepe dependency and cleanup overrides (étape 5)
7ae23e7 feat(blocknote): apply Markhub design system to editor (étape 3 polish)
be13afa feat(blocknote-ui): step 2.5.e — Svelte link toolbar (edit URL inline + delete)
21ac2ee fix(tauri): disable OS drag-drop interception to unblock HTML5 in-page drag
a250096 feat(blocknote-ui): step 2.5.d — Svelte table handles + fix drag preview leak
31193c6 feat(blocknote-ui): step 2.5.c — Svelte side menu with native drag and transform menu
902bf82 feat(editor): replace Crepe with BlockNote in main app
c8587d7 feat(blocknote-ui): step 2.5.b — Svelte formatting toolbar over FormattingToolbar plugin
8788c4d chore: session closure — factual state update before next session
9256f57 feat(blocknote-ui): step 2.5.a — Svelte slash menu over SuggestionMenu plugin
64f6482 chore(c1-step2): blocknote round-trip probe + 3 fixtures + report
abccc90 chore(c1-step1): install @blocknote/core + investigation notes
```

`main` reste l'app de référence Crepe jusqu'au merge manuel.

## Tests (état final sur la branche)

- cargo test : **60/60 ✅**
- npm run test (vitest) : **189/189 ✅**
- npm run check (svelte-check) : **0 erreur, 0 warning ✅**
- npm run build : **OK ✅**
- npm run test:visual (Playwright) : **34/34 ✅** (les 2 specs Crepe `block-handle` et `editor-slash-menu` ont été supprimées à l'étape 5, plus de skipped Crepe résiduel)
- npm run test:e2e : 1 placeholder skipped (real-binary jamais monté — hors scope MVP)

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
| **C1 — Migration Crepe → BlockNote** | **✅ TERMINÉ 2026-05-11 — branche prête merge** |
| C2 — Système de toast / notifications | DÉBLOQUÉ (peut démarrer post-merge C1) |
| C3 — Drag-drop sidebar (HTML5 → pointer events) | DÉBLOQUÉ — bug CASSÉ confirmé en réel, reste à investiguer |
| Folder-delete EPERM (hors plan) | DIAGNOSTIQUÉ — fix prêt à coder sur `fix/folder-delete-permission` depuis `main` |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — explicitement skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief posé, aucun code |
| Empty state | PAS DÉMARRÉ — brief posé, aucun code |

## Fichiers temporaires conservés (déviations du plan, justifiées)

- `MIGRATION-NOTES.md` (racine) : notes d'investigation BlockNote. Plan disait de la supprimer à l'étape 5. **Conservée** : aucune dépendance code, valeur historique, zéro coût.
- `src/routes/_blocknote-test/+page.svelte` : route dev BlockNote. Plan disait de la supprimer. **Conservée** : 3 specs E2E actives (`blocknote-slash-menu`, `blocknote-formatting-toolbar`, `blocknote-roundtrip`, 8 tests) l'utilisent comme dev test surface. Migrer ces specs vers `/_visual` aurait coûté plus que la valeur. Route dev-only, ne pollue pas le bundle prod.

## Stash

- `agents-prep-work-stash` (~2 semaines, refactors I1/I2 obsolètes). Drop probable, à arbitrer.

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie permanente)
3. `WORKPLAN.md` (plan global, C1 terminé, C2/C3 débloqués)
4. `JOURNAL.md` (dernières entrées — clôture migration au 2026-05-11)
5. `BACKLOG.md` (hors-scope MVP, items C1 marqués résolus)
6. `PLAN-BLOCKNOTE.md` (historique migration, tableau de progression complet)
7. `SPEC.md` / `design.md` / `PLAN.md` (référence)

Mémoire persistante : `pending_folder_delete.md` rappelle le diagnostic du bug folder-delete pour la prochaine session quand l'user voudra l'attaquer.
