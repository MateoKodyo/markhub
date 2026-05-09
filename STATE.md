# STATE — État du projet pour reprise de session

## Date de clôture
2026-05-09T17:25:50+02:00

## Phase actuelle
Phase 5 (E2E + finitions) — logique terminée, visuel CASSÉ sur points critiques.

## Avancement global
- Phase 0 : ✅ Bootstrap
- Phase 1 : ✅ Modèles + Config Rust
- Phase 2 : ✅ Commandes vaults + files Rust
- Phase 3 : ✅ Logique sidebar + stores (visuel à revérifier)
- Phase 4 : ✅ Logique éditeur + sauvegarde auto (visuel CASSÉ)
- Phase 5 : 🟡 Logique faite (vault menu, file menu, persistence, inline rename) — VISUEL CASSÉ
- Phase 6 : ❌ Polish (à faire — c'est la priorité de la prochaine session)

## Tests
- cargo test : 51/51 passants
- npm run test : 116/116 passants
- npm run check : 0 erreur, 0 warning
- npm run build : OK
- npm run test:e2e : 1 placeholder skipped, real-binary jamais monté

## ⚠️ BUGS VISUELS CONFIRMÉS PAR SMOKE TEST (priorité P0)
1. **Slash menu** : rend DEUX menus empilés simultanément, textes se chevauchent. Le fix flicker (untrack) tient mais nouveau bug visuel apparu (capture dans JOURNAL).
2. **Preview markdown** : frontmatter rendu en italique géant — la correction `<details>` monospace n'est PAS appliquée visuellement (alors que les tests passent). À investiguer : décalage entre tests et rendu réel.
3. **Headings (H1, H2)** : typo non conforme à `design.md`. Encore des styles Milkdown Crepe par défaut visibles.
4. **Slash menu + toolbar flottante** : styling Crepe pas correctement overridé en pratique malgré le commit f3cfe88.

## Bugs structurels en attente
- E2E real-binary jamais monté (Phase 5 incomplète sur ce point).
- Outline panel skippé (pas de spec dans `SPEC.md`, à scoper si on le veut).
- Drag-drop intra-vault confirmé en backlog post-MVP.

## Décisions D1-D4 statut
- **D1** (auto-add `.md` skip dotfiles) : figé.
- **D2** (rename dossier ajouté au menu) : figé, gain UX validé.
- **D3** (box-shadow léger sur slash/toolbar) : NON-VALIDÉ — peut-être à supprimer si on revoit complètement le styling.
- **D4** (`selectionRange` null pour fichiers sans extension) : figé.

## Refactors I1/I2 préparés mais NON-MERGÉS
Stash `agents-prep-work-stash` contient :
- I1 : `findEntryByPath` migré vers `utils/tree.ts` + tests
- I2 : `enforceMarkdownExtension` extrait vers `utils/path.ts` + tests
- Section closure de JOURNAL.md
- STATE.md (version stashée — celle-ci la remplace)

À pop avec : `git stash apply agents-prep-work-stash`
À jeter si la prochaine session refonde le code : `git stash drop agents-prep-work-stash`

## À FAIRE EN PRIORITÉ — prochaine session

### P0 — Polish visuel (dédier toute la prochaine session à ça)
1. **Investigation gap test/rendu** : pourquoi les tests CSS passent alors que le rendu réel est cassé ? Probablement lié à jsdom qui ne charge pas les styles Crepe externes.
2. **Override complet des styles Milkdown Crepe** : pas par variables si elles ne suffisent pas, mais par sélecteurs CSS spécifiques avec `!important` si nécessaire (commenté).
3. **Frontmatter** : confirmer que le pré-traitement TS le sort bien du flux Milkdown et le rend dans un `<details>` custom Svelte, pas dans le flux Milkdown.
4. **Slash menu** : fixer le double-rendu (probable bug de stacking ou d'instances dupliquées).
5. **Tests visuels** : passer à des E2E Playwright avec screenshots pour valider en conditions réelles, pas juste unit tests.

### P1 — Cleanup post-polish
- Pop le stash `agents-prep-work-stash` si pertinent.
- Décider du sort de D3 (shadows).

### P2 — Compléter Phase 5
- Monter `tauri-driver` pour E2E real-binary OU adopter Playwright direct sur l'UI Vite.
- Outline panel : spec à valider avec Matheo avant code.

## Skills Claude pertinents pour ce projet
À identifier en début de prochaine session via : `ls /Users/lkid/Ressources/Skills/`

## Fichiers de référence à relire en début de prochaine session
1. `CLAUDE.md` (méthodologie permanente)
2. `SPEC.md` (vision et contrat)
3. `design.md` (design system Warp-inspired)
4. `PLAN.md` (phases)
5. `JOURNAL.md` (historique des sessions)
6. `STATE.md` (ce fichier — porte d'entrée)
7. `BACKLOG.md` (hors-scope)
