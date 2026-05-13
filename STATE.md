# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-14 (soir) — session marathon après-PLAN-SETTINGS + PLAN-COMMAND-SYSTEM. 16 commits enchaînés couvrant : revert body typography (4e échec), toast étoffé, retrait section Behavior, **onglets de fichiers Phase 5c**, **Cmd+F find-in-document**, **3 resize handles** (sidebar/outline/split vertical), polish UX tabs Cursor-style.

## Branche courante

`main` — synced avec `origin/main` (push à jour).

Dernière séquence de commits :

```
078d849 fix(outline): route outline-panel jumps through source-mode scroll
fa5b1b4 fix(panels): outline resize handle now lives on the panel's edge
05d5420 refactor(sidebar): + icon next to "Vaults" header, drop the bottom button
653bffc fix(panels): window-level pointer events + third resize (vaults / files)
d7996e0 feat(panels): resize handles for the sidebar + outline columns
43c8f91 feat(editor): in-document find bar (⌘F)
9a3f1a3 fix(tabs): two-zone layout — trailing chrome can't be underflown
679fe5e style(tabs): hide scrollbar + 16px fade before the trailing controls
ad343d7 style(tabs): add file icon left of each tab name (Cursor parity)
7ddd7a9 style(tabs): fold the editor chrome row into the tab bar
bcee136 style(tabs): Cursor-style compact tab bar with horizontal scroll
81ad262 style(tabs): polish — taller rows, drop breadcrumb path + bar border
9305417 feat(tabs): editor file tabs (Phase 5c)
80a420c refactor(settings): retire the redundant Behavior section
5e3390b feat(toast): cover the remaining vault + rename + save flows (C2 v1.5)
ca779fd revert(sidebar): disable drag-drop from Finder — restore in-app HTML5 drag
```

## Tests (état final)

- cargo : **120/120 ✅**
- vitest : **407/407 ✅**
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ (2026-05-11) |
| PLAN-DESIGN-DEFAULTS | ✅ MERGÉ (2026-05-12) |
| PLAN-SETTINGS (8 steps) | ✅ MERGÉ 2026-05-14 (STEP 3 partielle, body typo BACKLOG) |
| PLAN-COMMAND-SYSTEM (8 steps) | ✅ MERGÉ 2026-05-14 |
| Folder-delete EPERM | ✅ |
| Import de fichiers markdown | ✅ |
| Drag-drop sidebar (dossiers + root drop) | ✅ |
| Outline panel V1 | ✅ |
| Token estimate StatusBar | ✅ |
| C2 — Toast system | ✅ (couverture complète write-side + save error) |
| C3 — Drag-drop sidebar pointer events | ✅ user-validated |
| C5 — Drag-drop FROM Finder | ⛔ reverted (Tauri/HTML5 incompat, BACKLOG) |
| **Onglets de fichiers (Phase 5c)** | **✅ MERGÉ 2026-05-14 — JS-driven, Cursor-style** |
| **Cmd+F find-in-document** | **✅ LIVRÉ 2026-05-14** |
| **Resize handles trio (sidebar / outline / split vertical)** | **✅ LIVRÉ 2026-05-14** |
| Body typography (PLAN-SETTINGS STEP 3 dette) | ⛔ 4e tentative reverted, BACKLOG (BlockNote theming API) |
| Outline V2 Notion rail | gelé (V1 valide) |
| Flash blanc resize | gelé (objc CALayer) |
| Scroll preview natif (BlockNote line→block) | gelé (workaround source-mode partout) |

## Surface livrée en production

**Raccourcis globaux** :
- `⌘K` palette de commandes (catalog file/vault/view/settings/tabs)
- `⌘P` file switcher (fuzzy filename+path, MRU, dedupe tabs)
- `⌘⇧F` search vault (ripgrep)
- `⌘F` find-in-document (nouveau)
- `⌘G` / `⇧⌘G` next/previous match
- `⌘\` outline panel toggle
- `⌘W` ferme le tab actif
- `⌘1..9` active le N-ième tab
- `⌘S` save manuel — `⌘,` settings

**Layout 3 colonnes resizables** :
- Sidebar gauche (180-480px) avec **split vertical** Vaults/Files (80-600px)
- Main editor au milieu avec tabs Cursor-style intégrant le mode-toggle + outline button
- Outline panel droite (200-480px) toggleable, handle de resize sur son edge gauche

**Toast system** : couvre tous les write-side handlers (create/delete/duplicate/move/import/rename de fichier ET dossier, vault add/remove/rename/toggle-mode, copy path) + save error sticky (`duration: 0`).

**Settings** : 5 sections (Apparence / Éditeur / Source / Fichiers / Avancé). Behavior section retirée (redondante). Avancé : Open config folder + Export/Import JSON + version.

## Pattern "auto-switch source" pour le scroll programmatique

Toutes les opérations qui scrollent vers une position du doc (Cmd+F find, Cmd+Shift+F search hits, Outline click) **basculent automatiquement en source mode** quand l'utilisateur est en preview. Source-mode est la source de vérité ; native textarea selection sert de cue visuel. Le path preview-natif via BlockNote API est BACKLOG'd (instabilité observée sur les 4 tentatives).

## BACKLOG (dettes ouvertes)

Voir `BACKLOG.md` :
- **Body editor font-size + line-height** (4e tentative reverted — path propre = BlockNote theming API)
- **Scroll-in-preview pour jumps** (workaround source-mode partout, V2 via ProseMirror view.coordsAtPos)
- **Drag-drop FROM Finder** (refactor pointer events nécessaire)
- **Flash blanc resize** (objc CALayer)
- **PLAN-COMMAND-SYSTEM follow-ups** : double-scan vault tree, SearchOptions UI
- **Outline V2 Notion rail** (gelé, V1 suffit)

Idées identifiées en cours de session 2026-05-14 :
- Pin tab (épingler un tab pour qu'il survive ⌘W global / close-others)
- Tab right-click menu (close others / close to right / close all)
- Réordrer vaults dans Sidebar (drag-drop)
- Find-and-replace (extension du find Cmd+F)

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md`
3. `WORKPLAN.md`
4. **Dernière entrée `JOURNAL.md`** (session 2026-05-14 soir)
5. `BACKLOG.md` (dettes + items différés)

## Prochaine session

Toutes les pistes :
- Tab right-click menu + middle-click close (~30min, UX cliché attendu)
- Pin tab (~1h)
- Réordrer vaults (~30min)
- Find-and-replace (~1h, extension Cmd+F)
- Body typography via BlockNote theming API (~2-3h research+dev)
- Scroll preview via ProseMirror view.coordsAtPos (~1-2h)
- Drag-drop FROM Finder via pointer events (~1-2h)
- Outline V2 Notion rail (~3h)
- Multi-cursor / smooth caret (nice-to-have)
