# STATE — État du projet pour reprise de session

## Date de clôture
2026-05-09T17:25:50+02:00 (initial) · 2026-05-09T18:05 (Round 1 polish) · 2026-05-09T19:15 (Round 2 polish)

## Phase actuelle
Phase 6 (Polish visuel) — terminée avec Round 1 + Round 2 :
- Étape 1 : root cause investigation (jsdom blind + Crepe mocked) ✅
- Étape 2 : harnais Playwright `/_visual` + 9 baselines ✅
- Round 1 (Crepe popovers) : #1 slash menu + #4 toolbar via spécificité bumpée ✅
- Round 1 P0 fonctionnels (smoke validé) : #1 scroll, #2 click fiable, #3 auto-open après création ✅
- Round 2 (chantiers visuels) : #1 grayscale 3-tier, #2 sélection accent-tinted, #3 task list différenciées, #4 block-handle opacity progressive ✅

## Avancement global
- Phase 0 : ✅ Bootstrap
- Phase 1 : ✅ Modèles + Config Rust
- Phase 2 : ✅ Commandes vaults + files Rust
- Phase 3 : ✅ Logique sidebar + stores (visuel à revérifier)
- Phase 4 : ✅ Logique éditeur + sauvegarde auto (visuel CASSÉ)
- Phase 5 : 🟡 Logique faite (vault menu, file menu, persistence, inline rename) — VISUEL CASSÉ
- Phase 6 : ❌ Polish (à faire — c'est la priorité de la prochaine session)

## Tests (2026-05-09T19:15)
- cargo test : 51/51 passants ✅
- npm run test : 121/121 passants ✅ (+5 cas atomic openFile)
- npm run check : 0 erreur, 0 warning ✅
- npm run build : OK ✅
- npm run test:visual : 9/9 passants ✅ (slash, frontmatter, headings, toolbar, scroll-overflow×2, grayscale-hierarchy, text-selection, task-list)
- npm run test:e2e : 1 placeholder skipped, real-binary jamais monté

## BUGS VISUELS P0 — État FERMÉ (clôture 2026-05-09T18:05, commit 48be55d)

Tous les 4 bugs P0 résolus en un seul fix architectural (`src/app.css`) lors de l'Étape 3 round 1 :

1. **Slash menu double-panel (P0 #1)** — ✅ FIXÉ. Root cause : (a) `flex-direction: column` mal scopé écrasait le tab-group horizontal, (b) cascade Crepe lazy-load battait nos overrides à spécificité égale. Fix : restreindre flex column à `.menu-group ul` + bump spécificité via `.milkdown.milkdown` (0,0,3,0). Aucun `!important`.
2. **Frontmatter italique géant (P0 #2)** — ✅ NON REPRODUIT EN BASELINE. Le wrapper Svelte (Editor.svelte:137-142) rend correctement le `<details>` collapsed mono. Le fix de spécificité de #1 garantit en plus que les overrides Editor.svelte gagnent la cascade. **Smoke test full app par Matheo recommandé** pour confirmer définitivement.
3. **Headings non conformes (P0 #3)** — ✅ NON REPRODUIT EN BASELINE. Override Editor.svelte:263-285 (26/21/18/16/14 Geist Sans normal) appliqué correctement. Idem #2.
4. **Toolbar flottante stylée Material (P0 #4)** — ✅ FIXÉ collatéralement par le bump de spécificité. Fond `--color-bg-raised`, 6 icônes lisibles (B / I / strike / `<>` / Σ / link), styling IDE-cohérent.

**Mécanisme de régression** : 5 baselines Playwright dans `tests/visual/` détectent désormais toute régression de rendu Crepe. Les unit tests Vitest sur le rendu Crepe sont **interdits** par décision Étape 1 (jsdom n'évalue pas les CSS cascadées + Crepe est mocké).

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

### P0 — Smoke test final full app (à charge de Matheo)
Lancer `npm run tauri dev` sur un fichier .md réel contenant :
- Un frontmatter YAML en tête → vérifier rendu `<details>` collapsed mono
- Des H1/H2/H3 dans le body → vérifier typo Geist conforme à `design.md`
- Tester `/` dans un para vide → vérifier slash menu single-panel
- Sélectionner du texte → vérifier toolbar flottante propre

Si tout est OK : MVP visuel shippable. Sinon : creuser le contexte full app (probablement un autre override CSS qui interfère).

### P1 — Dette technique mineure (post-MVP)
- **Route `/_visual` en build de prod** : la route fixture est incluse dans le bundle prod (16KB). Inoffensive (URL non publicisée) mais idéalement DEV-only. Solution simple : ajouter `if (!import.meta.env.DEV) goto('/')` dans `+page.svelte`, ou exclure la route via un hook SvelteKit. **5 min** de boulot.
- **Stash `agents-prep-work-stash`** : refactors I1/I2 (`findEntryByPath` → `utils/tree.ts`, `enforceMarkdownExtension` → `utils/path.ts`). Indépendants des fixes visuels, peuvent être poppés et mergés à part, ou jetés.
- **Décider de D3 (box-shadow popovers)** : aujourd'hui `0 4px 16px rgba(0,0,0,0.35)` sur slash menu / toolbar / link tooltip. Plus subtil que Material default mais visible. Peut être encore toned down si on veut « depth via borders only » strict (`design.md §6`).

### P2 — Compléter Phase 5
- Monter `tauri-driver` pour E2E real-binary OU étendre Playwright avec un mock de la couche Tauri sur la full app (alternative au real-binary).
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
