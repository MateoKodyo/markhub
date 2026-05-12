# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-14 (très tôt matin) — fin de session **autonome** lancée par Matheo le 2026-05-13 au soir. Bilan :

- **PLAN-COMMAND-SYSTEM STEPS 1-6 livrés** (6 sur 8). Code complet, tests verts, **smoke utilisateur PAS encore fait**. STEP 7 (Polish + mode-switching) et STEP 8 (Closure) restent à faire après smoke matinal.
- 5 commits sur la branche `feat/command-system` depuis le dernier commit STATE.
- Aucun push (mandat explicite : tout reste local pour review).

## Branche courante

`feat/command-system` — **5 commits ahead de `main`**. Pas pushée.

Commits de la session nuit (du plus ancien au plus récent) :

```
7543c91 feat(commands): bootstrap command system — registry, keymap, palette shell (STEPS 1+2)
004b6c0 feat(commands): command palette mode (Cmd+K)                                  (STEP 3)
9d48658 feat(commands): quick file switcher (Cmd+P)                                   (STEP 4)
d3b2f60 feat(commands): ripgrep-based search backend                                  (STEP 5)
f066f82 feat(commands): global search mode (Cmd+Shift+F)                              (STEP 6)
```

État de `main` : 33 commits ahead de `origin/main` (jamais pushé depuis le merge BlockNote du 2026-05-11). Inchangé pendant la nuit autonome.

## Tests (état final)

- cargo : **115/115 ✅** (100 base + 15 nouveaux `search`)
- vitest : **324/324 ✅** (242 baseline + 82 nouveaux command-system)
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
| **PLAN-COMMAND-SYSTEM** | **🟡 STEPS 1-6 code livré (smoke pending), STEPS 7-8 restants** |
| C2 — Toast / notifications | DÉBLOQUÉ — pas démarré |
| C3 — Drag-drop sidebar HTML5 → pointer events | 🟡 USER-VALIDATED OK 2026-05-12 — déprio'd |
| C4 — Drag-drop OS vers Finder | ⛔ TENTÉ + REVERTÉ — déprio'd |
| C5 — Drag-drop OS depuis Finder | ⏳ PAS DÉMARRÉ |
| Onglets de fichiers (Phase 5c) | PAS DÉMARRÉ — skippé |
| Outline panel (sommaire) | PAS DÉMARRÉ — brief posé |

## Surface livrée pendant la nuit (à smoker au matin)

**Trois raccourcis globaux** branchés via le keymap registry :

- **Cmd+K** → Command palette (12 commandes file/vault/view/settings + 2 méta `palette.*`), fuzzy search, MRU persisté, match highlighting
- **Cmd+P** → File switcher (tous les .md du vault, fuzzy filename+path avec boost filename, MRU persisté, exclusion du fichier ouvert)
- **Cmd+Shift+F** → Search dans le vault (ripgrep-backed côté Rust, debounce 200ms, results groupés par fichier, click → open + jumpToLine en source mode)

Plus :
- **Cmd+S** → forceSave actif file
- **Cmd+,** → Settings (migré du onGlobalKeydown inline vers le keymap registry)

## Plan de smoke matinal

**Le plan détaillé de smoke est dans la dernière entrée de JOURNAL.md** (section "Plan de smoke pour le matin"). 4 sections : Cmd+K / Cmd+P / Cmd+Shift+F / edge cases. ~15 minutes pour faire le tour.

## Décisions importantes prises en autonomie

(Détails dans la dernière entrée JOURNAL.md.) Résumé :

1. Bootstrap commit unique pour STEPS 1+2 (diff `+page.svelte` mélangé)
2. `paletteStore` lifté de +page dès STEP 4
3. `vaultTreeStore` + Sidebar scan en double accepté (factorisation = follow-up)
4. `WalkBuilder::require_git(false)` — `.gitignore` honored hors git repo
5. Editor `jumpToLine` no-op en preview mode (BACKLOG : line→block BlockNote)
6. Polyfill `localStorage` complet dans tests/setup.ts (Node 25 ship un built-in partiel)
7. Test "excludes open file" gardé en pure-function (vi.spyOn cassait avec $state Svelte 5)

## Dettes / dépendances ajoutées

- npm : `tinykeys@3.0.0` (~1 KB), `fuzzysort@3.1.0` (~5 KB)
- cargo : `ignore` + `grep-matcher` + `grep-regex` + `grep-searcher` + `regex` (~2-3 MB total après strip)
- localStorage keys : `markhub.commands.recent.v1`, `markhub.files.recent.v1`

## BACKLOG.md à enrichir (post-smoke)

À ajouter en BACKLOG si le smoke valide :
- BlockNote line→block resolution pour `editor:jumpToLine` en preview mode (search hits navigation)
- Factoriser `vaultTreeStore` vs Sidebar scan local (double scan actuellement)
- Optionnel : `SearchOptions` UI (toggles case/whole-word/regex dans la palette search) — actuellement `DEFAULT_SEARCH_OPTIONS` hardcodé

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie)
3. `WORKPLAN.md` (plan global)
4. **Dernière entrée de `JOURNAL.md`** (clôture session nuit 2026-05-13→14)
5. `plan-110526/PLAN-COMMAND-SYSTEM.md` (table de progression — STEPS 1-6 🟡, STEPS 7-8 ⏳)
6. `plan-110526/DESIGN-PRINCIPLES.md`
7. `plan-110526/PLAN-SETTINGS.md` (STEP 6/7/8 restants)

## Prochaine session (post-smoke)

Au choix :
- **Si smoke OK** : STEP 7 (Polish + mode-switching, ~1-2h) → STEP 8 Closure → merge sur main
- **Si quelque chose pète** : revert isolé du STEP fautif (5 commits indépendants), fix, re-smoke
- **Settings STEP 6 Avancé** (Open config folder + Export/Import JSON + version display, ~1h)
- **Body typography fix via API BlockNote** (dette du PLAN-SETTINGS, ~2-3h research + dev)
- **C2 Toast / C5 drag-drop entrée** / autre

Mémoire persistante mise à jour :
- (rien de nouveau cette nuit — comportement conforme aux feedbacks déjà persistés : style conceptuel, branche feature avec commits directs, autorisation merge/branch cleanup, et précautions worktree pour les sous-agents)
