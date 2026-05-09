# STATE — État du projet pour reprise de session

## Date de clôture
2026-05-09T17:25:50+02:00 (initial) · 2026-05-09T17:50 (mise à jour Étape 2 polish session)

## Phase actuelle
Phase 6 (Polish visuel) — Étapes 1, 2, 3 (round 1) terminées :
- Étape 1 : root cause investigation (jsdom blind + Crepe mocked) ✅
- Étape 2 : harnais Playwright `/_visual` + 5 baselines ✅
- Étape 3 round 1 : fix #1 (slash menu) + #4 (toolbar flottante) via un seul commit (spécificité + scope flex column). #2 et #3 non reproductibles en baseline, considérés résolus par le fix de spécificité ✅

À VALIDER : smoke test full app pour confirmer définitivement #2 et #3 dans le contexte réel (sidebar/header présents).

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

## ⚠️ BUGS VISUELS — RE-DIAGNOSTIC via baselines Playwright (2026-05-09T17:50)

État après mise en place du harnais Playwright `/_visual?fixture=...` (Étape 2 session polish) :

1. **Slash menu (P0 #1)** — ❌ **CONFIRMÉ** par baseline `editor-slash-menu-visual-darwin.png` : deux panels superposés rendus simultanément (catégories Text/List/Advanced empilées sur la liste détaillée). À fixer en priorité.
2. **Frontmatter italique géant (P0 #2)** — ✅ **NON REPRODUIT en isolation** : baselines `editor-frontmatter-collapsed/open` montrent un `<details>` collapsed avec summary monospace `▸ Frontmatter`, contenu YAML monospace quand déplié. Le wrapper Svelte (Editor.svelte:137-142) fonctionne. **Hypothèse** : bug initial observé sur un build pré-HMR ou résolu par un commit récent (f3cfe88 ou dffd1a1). À reconfirmer en smoke test full app.
3. **Headings non conformes (P0 #3)** — ✅ **NON REPRODUIT en isolation** : baseline `editor-headings` montre H1 26px / H2 21px / H3 18px / H4 16px / H5 14px en Geist Sans weight 500, conforme aux overrides Editor.svelte:263-285. **Hypothèse** : idem #2, déjà fixé.
4. **Toolbar flottante (P0 #4)** — 🟡 **PARTIELLEMENT CONFIRMÉ** : la toolbar apparaît avec un styling Crepe natif — fond translucide Material-style, icônes peu lisibles (~20% opacity), pas conforme à l'IDE-dark Markhub. À overrider.

**Source d'incertitude résiduelle** : les baselines viennent d'une route isolée `/_visual` sans chrome (pas de sidebar/header). En full app, les bugs #2/#3 pourraient ressurgir si quelque chose d'autre interfère. Smoke test full app à intercaler.

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
