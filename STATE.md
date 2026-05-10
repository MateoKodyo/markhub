# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-10 — fin de session, avant nouvelle session avec nouveau plan.

## Branche courante

`feat/blocknote-migration` — **non mergée**, 3 commits ahead de `main` :

```
9256f57 feat(blocknote-ui): step 2.5.a — Svelte slash menu over SuggestionMenu plugin
64f6482 chore(c1-step2): blocknote round-trip probe + 3 fixtures + report
abccc90 chore(c1-step1): install @blocknote/core + investigation notes
```

`main` reste l'app fonctionnelle de référence (Crepe + tous les patches custom + light mode + status bar pills + block menu Crepe + drag-drop pointer events Crepe).

## Tests (état actuel sur la branche)

- cargo test : 60/60 ✅
- npm run test : 152/152 ✅
- npm run check : 0 erreur, 0 warning ✅
- npm run build : OK ✅
- npm run test:visual : 23 passants + 1 skipped ✅
  - dont 2/2 sur le slash menu BlockNote (route dev `_blocknote-test`)
- npm run test:e2e : 1 placeholder skipped, real-binary jamais monté

## Moteur d'éditeur dans l'app principale

**Crepe** (`@milkdown/crepe@^7.20.0`). Monté dans `src/lib/components/Editor.svelte`.

Patches custom empilés au-dessus de Crepe :
1. Block menu de transformation (click sur ⋮⋮ → notre `<ContextMenu>` avec items "Texte / Titre 1-3 / Liste à puces / Liste numérotée / Citation / Bloc de code / Séparateur / Dupliquer / Supprimer")
2. Drag-reorder en pointer events (mousedown/move/up + transaction ProseMirror manuelle)
3. Drop indicator visuel custom (ligne accent 2px)
4. Override CSS lourd dans `app.css` (~56 occurrences `milkdown` / `crepe` / `bn-` / `@blocknote`) : slash menu, toolbar flottante, block handle, link tooltip, code-mirror picker, ::selection scoped sur `.milkdown.milkdown`
5. Frontmatter pré-traitement (split / join hors flux Crepe)
6. `untrack` sur `frontmatter`/`body` dans le `$effect` Editor (anti-flicker remount à chaque keystroke)
7. Auto-flip + max-height sur `ContextMenu` (anti-clipping)

## BlockNote

**Pas branché dans l'app principale.** Vit uniquement sur la route dev `src/routes/_blocknote-test/+page.svelte`.

- `@blocknote/core@^0.50.0` installé
- Round-trip markdown validé sur 3 fixtures : pas de blocker fatal, diffs cosmétiques
- 1 composant UI Svelte écrit / 5 nécessaires : `BlockNoteSlashMenu.svelte` (slash menu)
- Restent à écrire : FormattingToolbar, SideMenu, TableHandles, LinkToolbar
- Restent à faire après ça : intégration `Editor.svelte` + nettoyage Crepe + polish CSS Markhub

Notes d'investigation dans `MIGRATION-NOTES.md` (à supprimer en fin de chantier).

## Bugs CONFIRMÉS en réel sur l'app principale

- **Drag-drop block ⋮⋮ dans l'éditeur** : "pas de ligne bleue rien" en réel (smoke utilisateur). Tests Playwright passent en isolation, smoke réel échoue. Cause non re-investiguée depuis.
- **Drag-drop fichier → dossier dans la sidebar** : "doesn't work at all" en réel. Implémentation HTML5 native (`FileTree.svelte`). Workplan §C3 prévoit la migration vers pointer events — pas démarrée.

## Bugs PROBABLES (smoke réel non re-confirmé après les derniers commits)

- Block menu transformation au click sur ⋮⋮ : tests passent, mais smoke réel post-tous-les-derniers-commits non explicitement re-validé par toi
- Code block langage picker : restylé mais smoke réel post-fix non re-validé
- Régression visuelle éventuelle après la migration `display: contents` body→flex column : à reconfirmer

## Ce qui MARCHE en réel (smoke confirmé)

- Sidebar : ajout/suppression vault (picker macOS), navigation arborescence, expand/collapse persisté, alignement icônes propre
- File tree : filtre récursif, création/suppression/rename inline, F2 / dblclick / context menu rename
- Menus contextuels file/folder/vault complets (Renommer / Dupliquer / Déplacer / Copier chemin / Révéler Finder / Supprimer)
- Lecture/écriture fichiers `.md` via Tauri (autosave debounced 1.5s, atomic openFile + requestId guard)
- Frontmatter : split + rendu `<details>` collapsed monospace + round-trip préservé
- Status bar pills (vault, path, mots, save status, theme toggle, mode Preview/Source) sous l'éditeur uniquement
- Theme dark/light/system avec persistence + listener `prefers-color-scheme`
- Editor Crepe : édition WYSIWYG basique, headings, paragraphes, listes, code blocks (avec coloration), task lists, citations
- Slash menu Crepe (`/`)
- Toolbar flottante Crepe au survol de sélection
- ContextMenu auto-flip
- Scroll vertical sidebar + éditeur (avec scrollbar 8px overlay)
- Theme bouton Sun/Moon/Monitor

## État des autres chantiers (workplan + briefs)

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | EN COURS — étape 2.5.a faite (1 composant UI sur 5), reste 4 composants + intégration + nettoyage |
| C2 — Système de toast / notifications | PAS DÉMARRÉ |
| C3 — Drag-drop sidebar (HTML5 → pointer events) | PAS DÉMARRÉ — bug CASSÉ confirmé en réel |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — explicitement skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief `features/sommaire.md` posé, aucun code |
| Empty state | PAS DÉMARRÉ — brief `features/empty-state.md` posé, aucun code |

## Si on shipperait le MVP demain

3 chantiers critiques (frustration quotidienne sans eux) :
1. Drag-drop sidebar fonctionnel (workplan C3, ~3-4h)
2. Drag-drop block + drop indicator vraiment fonctionnel (Crepe re-fix OU BlockNote terminé)
3. Système de toast pour feedback des actions (workplan C2, ~3-4h)

Nice-to-have (perception "fini") :
- Outline panel
- Onglets fichiers
- Empty state propre

Durée minimale honnête :
- **Voie A** (abandonner BlockNote, finir Crepe) : 3-4 jours
- **Voie B** (finir BlockNote) : 8-12 jours

## Fichiers temporaires en cours

- `MIGRATION-NOTES.md` (racine) : notes d'investigation BlockNote, à **supprimer** quand chantier C1 clos.
- `src/routes/_blocknote-test/+page.svelte` : route dev BlockNote, à **supprimer** quand chantier C1 clos.
- `src/routes/_visual/+page.svelte` : route dev pour tests visuels Playwright. Reste utile.
- `tests/fixtures/c1/*.md` : 3 fixtures de round-trip BlockNote. À garder ou à déplacer en fin de chantier.

## Stash

- `agents-prep-work-stash` (probablement obsolète à 1+ semaine, refactors I1/I2 anciens). Pop ou drop à arbitrer.

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie permanente)
3. `WORKPLAN.md` (plan global des chantiers, le tableau §"Vue d'Ensemble" est la liste)
4. `MIGRATION-NOTES.md` (uniquement si on continue C1)
5. `JOURNAL.md` (dernières entrées seulement)
6. `BACKLOG.md` (hors-scope MVP)
7. `SPEC.md` / `design.md` / `PLAN.md` (référence)
