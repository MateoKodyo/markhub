# STATE — État du projet pour reprise de session

## Date de clôture
2026-05-09T17:25:50+02:00 (initial) · 2026-05-09T18:05 (Round 1) · 2026-05-09T19:15 (Round 2) · 2026-05-09T19:42 (Session autonome soirée)

## Phase actuelle
Phase 6 (Polish visuel) terminée + Phase 5b (menus) + Status bar + Drag-drop intra-vault :
- Étape 1 : root cause investigation (jsdom blind + Crepe mocked) ✅
- Étape 2 : harnais Playwright `/_visual` + baselines ✅
- Round 1 (Crepe popovers) : #1 slash menu + #4 toolbar via spécificité bumpée ✅
- Round 1 P0 fonctionnels (smoke validé) : #1 scroll, #2 click fiable, #3 auto-open après création ✅
- Round 2 (chantiers visuels) : #1 grayscale 3-tier, #2 sélection accent-tinted, #3 task list différenciées, #4 block-handle opacity progressive ✅
- Session soirée 2026-05-09T19:22→19:42 (autonome, 20 min) :
  - Phase 5b menus contextuels (file/folder/vault avec items completes : Ouvrir / Renommer / Dupliquer / Déplacer / Copier chemin (rel|abs) / Révéler Finder / Supprimer ; nouveau séparateur natif ; commandes Rust `file_duplicate` + `file_reveal_in_finder`) ✅
  - Status bar (vault+path+RO / mots+lecture / save status + mode toggle, click path = copy absolu, click mots = toggle caractères) ✅
  - Drag-drop intra-vault (HTML5 native, MIME custom, opacity source + accent-tint cible, désactivé readonly) ✅
- Phase 5c (onglets) : SKIP volontaire — refactor 2-3h hors budget soirée. À reprendre en session encadrée.

## Avancement global
- Phase 0 : ✅ Bootstrap
- Phase 1 : ✅ Modèles + Config Rust
- Phase 2 : ✅ Commandes vaults + files Rust
- Phase 3 : ✅ Logique sidebar + stores (visuel à revérifier)
- Phase 4 : ✅ Logique éditeur + sauvegarde auto (visuel CASSÉ)
- Phase 5 : 🟡 Logique faite (vault menu, file menu, persistence, inline rename) — VISUEL CASSÉ
- Phase 6 : ❌ Polish (à faire — c'est la priorité de la prochaine session)

## Tests (2026-05-09T19:42)
- cargo test : **60/60** passants ✅ (+9 : 7 duplicate + 2 reveal)
- npm run test : **145/145** passants ✅ (+24 : 15 documentStats + 9 StatusBar)
- npm run check : 0 erreur, 0 warning ✅
- npm run build : OK ✅
- npm run test:visual : **10/10** passants ✅ (+1 app-shell)
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

### P0 — Smoke test soirée (à charge de Matheo)
Lancer `npm run tauri dev` puis `Cmd+R` pour reload le frontend. À tester :
- **Menus contextuels (Phase 5b)** : right-click sur fichier / dossier / vault → vérifier les 3 menus complets (Ouvrir / Renommer / Dupliquer / Déplacer / Copier chemin / Révéler / Supprimer côté file ; nouvelle note ici / nouveau dossier ici / Renommer / Copier chemin / Révéler / Supprimer côté folder ; nouvelle note racine / Renommer vault / Mode RO ↔ Edit / Révéler / Copier path / Retirer côté vault). Items disabled si vault readonly.
- **Status bar** : ancrée en bas pleine largeur, vault + path + word count + save status + Preview/Source toggle. Click sur path → copie absolu. Click sur word counter → toggle caractères/mots.
- **Drag-drop** : drag d'un fichier sur un dossier → opacity 0.5 + accent-tint sur la cible → drop → fichier déplacé + dossier déplié auto + onglet suit le fichier si actif. Drop sur la zone vide racine = move à la racine. Vault readonly = drag bloqué.
- **Régression Round 2** : confirmer que les fixes visuels précédents tiennent (sidebar plus sombre, sélection bleue, checkboxes différenciées, block handle subtil).

### P1 — Phase 5c (onglets) à reprendre en session encadrée
Refactor activeFile → openFiles[] est un 2-3h pas piloté en autonomie ce soir (explicitement marqué risqué dans le brief). À attaquer en présence de Matheo car ça touche +page.svelte / Editor / Sidebar / persistence config + plusieurs tests existants.

### P2 — Dette technique mineure (post-MVP)
- **Route `/_visual` en build de prod** : la route fixture est incluse dans le bundle prod. Inoffensive mais idéalement DEV-only. Guard avec `import.meta.env.DEV` ou hook SvelteKit. ~5 min.
- **Stash `agents-prep-work-stash`** : non touché ce soir. Refactors I1/I2 — Matheo décide pop/drop.
- **Décider de D3 (box-shadow popovers)** — toned-down possible si « depth via borders only » strict.
- **Heading actif au scroll dans la status bar** : intersection observer sur `.ProseMirror h1, h2, h3` → afficher dans la zone centre.
- **Outline panel** : pas implémenté, bouton non rendu dans la status bar.
- **Settings panel** : pas implémenté, bouton non rendu.
- **Couleurs custom vault** (color picker) : backlog.

### P3 — Compléter Phase 5
- Monter `tauri-driver` pour E2E real-binary OU étendre Playwright avec un mock de la couche Tauri sur la full app.
- Tests Playwright pour le drag-drop (`dispatchDrop` historiquement fragile, à valider).

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
