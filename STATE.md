# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-14 (matin) — **PLAN-COMMAND-SYSTEM clôturé**. 8/8 steps livrés et smoke-validés. Branche `feat/command-system` mergée sur `main`. 13 commits ajoutés à `main` (12 features/fix + 1 closure).

## Branche courante

`main` — **46 commits ahead de `origin/main`** (33 avant la nuit + 13 de PLAN-COMMAND-SYSTEM). Toujours pas pushée. Push à faire quand Matheo veut.

Commits PLAN-COMMAND-SYSTEM (du plus récent au plus ancien) :

```
[closure]   chore(state): clôture PLAN-COMMAND-SYSTEM — handoff docs refresh
9f5f88a     style(editor): sober checkbox + drop strikethrough on checked items
b3069da     fix(editor): three BlockNote bugs flagged during the morning smoke
63e22c7     fix(sidebar): make the vault-root drop zone discoverable
fcda277     fix(sidebar): wire draggable + ondragstart on the folder row
b9be2ce     fix(sidebar): allow drag-drop of folders, with anti-cycle + open-file tracking
316ee61     feat(commands): mode indicator + prefix-based mode switching (STEP 7)
d7075dc     refactor(commands): trim Cmd+K catalog after morning smoke
c0f9901     chore(state): wrap up autonomous night — PLAN-COMMAND-SYSTEM STEPS 1-6
f066f82     feat(commands): global search mode (Cmd+Shift+F)                          STEP 6
d3b2f60     feat(commands): ripgrep-based search backend                              STEP 5
9d48658     feat(commands): quick file switcher (Cmd+P)                               STEP 4
004b6c0     feat(commands): command palette mode (Cmd+K)                              STEP 3
7543c91     feat(commands): bootstrap command system — registry, keymap, palette shell  STEPS 1+2
```

## Tests (état final, post-merge)

- cargo : **115/115 ✅** (100 base + 15 search)
- vitest : **335/335 ✅** (242 baseline + 93 nouveaux command-system)
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ sur `main` (2026-05-11) |
| PLAN-DESIGN-DEFAULTS (10 steps) | ✅ MERGÉ sur `main` (2026-05-12 nuit) |
| PLAN-SETTINGS (8 steps) | 🟡 EN COURS — STEPS 1-5 ✅, STEP 6/7/8 restants |
| Folder-delete EPERM | ✅ FIXÉ + smoke OK |
| Import de fichiers markdown | ✅ LIVRÉ 2026-05-13 |
| **PLAN-COMMAND-SYSTEM (8 steps)** | **✅ MERGÉ sur `main` 2026-05-14** |
| Drag-drop sidebar — dossier + visual root drop | ✅ FIXÉ 2026-05-14 (3 commits ad-hoc) |
| C2 — Toast / notifications | DÉBLOQUÉ — pas démarré |
| C5 — Drag-drop OS depuis Finder | ⏳ PAS DÉMARRÉ |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief posé |

## Surface livrée par PLAN-COMMAND-SYSTEM (production en main)

**Trois raccourcis globaux** + le keymap registry :

- **Cmd+K** → Command palette : 9 commandes visibles (file/vault/view/settings) + 2 méta (Go to File / Search in Vault). Fuzzy search, MRU persisté, match highlighting, badge mode indicator, prefix switching (`>` `@` `#`).
- **Cmd+P** → File switcher : tous les .md du vault, fuzzy filename+path (boost filename), MRU persisté, exclusion du fichier ouvert.
- **Cmd+Shift+F** → Search dans le vault : ripgrep-backed côté Rust (`grep-*` + `ignore` crates), debounce 200ms, results groupés par fichier, click → open + jumpToLine en source mode.
- **Cmd+S** / **Cmd+,** → migrés au keymap registry (Cmd+S est `hidden` du palette, autosave couvre le reste).

## Bugs ad-hoc fixés pendant la session matinale

- **Drag-drop dossier** dans la sidebar : draggable+ondragstart manquaient sur le row dossier, anti-cycle ajouté (drop sur descendant), open-file follow-through (suivre le fichier ouvert si son parent bouge), visual cue 2px outline accent sur tree-wrap pour la zone racine.
- **Slash menu** `/h2` → bloc inséré APRÈS au lieu de remplacer : `clearQuery()` avant `onItemClick()` vide le trigger range avant le swap.
- **Liste à cocher absente** du menu Transform du side menu : ajoutée dans `TransformType` + `buildSubmenuItems`.
- **Checkbox/edit perdu au switch fichier** : `activeFile.openFile()` cancellait au lieu de flush. Fix : flush systématique du pending save avant le switch.
- **Checkbox visuelle** : sober custom 14px outlined → filled accent au check, strikethrough retiré.

## Dettes / dépendances ajoutées par PLAN-COMMAND-SYSTEM

- npm : `tinykeys@3.0.0`, `fuzzysort@3.1.0`
- cargo : `ignore`, `grep-matcher`, `grep-regex`, `grep-searcher`, `regex` (+~2-3 MB)
- localStorage keys : `markhub.commands.recent.v1`, `markhub.files.recent.v1`

## BACKLOG enrichi par cette session

Voir `BACKLOG.md` section "PLAN-COMMAND-SYSTEM — follow-ups post-clôture" :
1. **`askBeforeClosingUnsaved` redondant** — `openFile` flush inconditionnellement maintenant. À retravailler.
2. **BlockNote line→block resolution** — `editor:jumpToLine` no-op en preview mode (Search hits).
3. **Double scan vault tree** — Sidebar et vaultTreeStore walkent séparément.
4. **`SearchOptions` UI** — toggles case/whole-word/regex à exposer (hardcodé pour l'instant).

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie)
3. `WORKPLAN.md` (plan global)
4. **Dernières entrées de `JOURNAL.md`** (clôture nuit + matin 2026-05-13/14)
5. `BACKLOG.md` (4 follow-ups + dettes existantes)
6. `plan-110526/PLAN-SETTINGS.md` (STEP 6/7/8 restants — chantier suivant si reprise)
7. `plan-110526/DESIGN-PRINCIPLES.md`

## Prochaine session

Au choix :
- **PLAN-SETTINGS STEP 6 (Avancé)** : Open config folder + Export/Import JSON + version display, ~1h. Clôture partielle de Settings v1.
- **Body typography fix via BlockNote theming API** : dette de PLAN-SETTINGS, ~2-3h research + dev.
- **PLAN-COMMAND-SYSTEM follow-ups** : repenser `askBeforeClosingUnsaved`, line→block jump, SearchOptions UI.
- **C2 Toast** : système notifs, DÉBLOQUÉ depuis longtemps.
- **C5 drag-drop OS depuis Finder** : si pertinent.

## Push origin

Reste à la main de Matheo (conformément à la mémoire `feedback_merge_authorization.md`). 46 commits ahead local. Quand le moment est bon : `git push origin main`.
