# Kodyo Markdown Hub — PLAN d'exécution

Plan en **6 phases**. Chaque phase suit le cycle TDD strict :

1. **RED** : écrire les tests de la phase (ils échouent tous).
2. **GREEN** : écrire le code minimum pour les faire passer.
3. **REFACTOR** : nettoyer si nécessaire, sans casser les tests.
4. **GATE** : Claude Code s'arrête, fait un récap, attend validation humaine.

**Règle absolue** : Claude Code ne passe JAMAIS à la phase suivante sans validation explicite. À chaque GATE, il imprime un récap structuré et attend.

---

## Phase 0 — Bootstrap (≈ 30 min)

**Objectif** : projet créé, dépendances installées, app Tauri qui démarre sur un « Hello World ».

**Tâches** :
1. `npm create tauri-app@latest markdown-hub -- --template svelte-ts`
2. Installer Svelte 5 si pas déjà la version par défaut.
3. Configurer `adapter-static` + `prerender = true` + `ssr = false` dans `svelte.config.js` et `+layout.ts`.
4. Installer : `@milkdown/crepe`, `@milkdown/core`, `@milkdown/preset-commonmark`, `uuid`.
5. Installer dev : `vitest`, `@testing-library/svelte`, `@playwright/test`, `tauri-driver` (cargo install si dispo).
6. Configurer `vitest.config.ts` (jsdom env, alias `$lib`).
7. Configurer `playwright.config.ts` (projet `tauri` qui lance `tauri-driver`).
8. Créer la structure de dossiers complète vide selon SPEC §3.1.
9. `npm run tauri dev` → fenêtre s'ouvre avec « Hello Markdown Hub ».

**Tests** : aucun, c'est du bootstrap.

**Critère de succès** :
- `npm run tauri dev` démarre une fenêtre.
- `npm run test` lance Vitest (0 tests, OK).
- `npm run test:e2e` lance Playwright (0 tests, OK).

**🚧 GATE 0** :
> « Phase 0 terminée. App démarre, tests runners configurés. Prêt pour la phase 1 (modèles + config) ? »

---

## Phase 1 — Modèles + Config (Rust)

**Objectif** : `Vault`, `Config`, commandes `config_load`/`config_save` opérationnelles et testées.

**Tests à écrire d'abord** (RED) :
- A1 complet (`models.rs`)
- A2 complet (`commands/config.rs`)

**Implémentation** (GREEN) :
- `src-tauri/src/models.rs` : structs avec `Serialize`/`Deserialize`/`Clone`/`Debug`.
- `src-tauri/src/commands/config.rs` : implémentation avec `tauri::api::path::app_config_dir`.
- Enregistrer les commandes dans `lib.rs` via `invoke_handler`.

**Critère de succès** : `cargo test` → A1 + A2 verts.

**🚧 GATE 1** :
> « Phase 1 terminée. Tests A1 + A2 passent (X tests verts). Prêt pour la phase 2 (vaults + files) ? »

---

## Phase 2 — Commandes vaults + files (Rust)

**Objectif** : toutes les commandes back implémentées, sécurisées et testées.

**Tests à écrire d'abord** (RED) :
- A3 (vaults)
- A4 (path traversal — CRITIQUE)
- A5 (readonly)
- A6 (opérations files)

**Implémentation** (GREEN) :
- `commands/vaults.rs` : CRUD vaults + `vault_pick_directory` (utilise `tauri-plugin-dialog`).
- `commands/files.rs` : avec **fonction helper `resolve_safe_path(vault, relative)`** appelée par toutes les opérations file.
- Enregistrer toutes les commandes dans `lib.rs`.

**Critère de succès** : `cargo test` → tous les tests A verts.

**🚧 GATE 2** :
> « Phase 2 terminée. Backend Rust complet, sécurité path traversal validée, mode readonly respecté. Prêt pour la phase 3 (front : stores + sidebar) ? »

---

## Phase 3 — Stores + Sidebar (Front)

**Objectif** : sidebar fonctionnelle, navigation entre vaults et fichiers, sans éditeur encore.

**Tests à écrire d'abord** (RED) :
- B1 (`path.ts`)
- B2 (`markdown.ts`)
- B3 (store `vaults`)
- B4 (store `activeFile`) — mocker `file_write` et la fonction debounced.
- C1 (`VaultList.svelte`)
- C2 (`FileTree.svelte`)
- C5 (`AddVaultDialog.svelte`)

**Implémentation** (GREEN) :
- Wrappers typés Tauri dans `src/lib/tauri/api.ts`.
- Stores en Svelte 5 runes.
- Composants Sidebar, VaultList, FileTree, AddVaultDialog.
- Layout `+page.svelte` : sidebar à gauche, zone vide à droite (« Sélectionne un fichier »).

**Critère de succès** :
- Tests B + C1, C2, C5 verts.
- `npm run tauri dev` : on peut ajouter un vault, naviguer, voir l'arbo. La zone éditeur affiche juste le chemin du fichier sélectionné.

**🚧 GATE 3** :
> « Phase 3 terminée. Sidebar et navigation OK. Tu peux ajouter un vault, voir tes fichiers. L'éditeur n'est pas encore là. Lance l'app, teste le flow d'ajout de vault, valide visuellement. Prêt pour la phase 4 (éditeur) ? »

---

## Phase 4 — Éditeur Milkdown + sauvegarde auto

**Objectif** : édition WYSIWYG fonctionnelle, sauvegarde auto debounced, mode readonly respecté.

**Tests à écrire d'abord** (RED) :
- C3 (`Editor.svelte`)
- C4 (`EditorToolbar.svelte`)

**Implémentation** (GREEN) :
- `Editor.svelte` : wrapper Milkdown Crepe. Props : `content`, `readonly`, `mode` (`'preview'` | `'source'`). Émet `change`.
- En mode `source` : afficher un `<textarea>` simple, monospace.
- `EditorToolbar.svelte` : utilise les commandes Milkdown.
- Brancher dans `+page.svelte` : ouvre le contenu via `activeFile`, écoute les changements, déclenche le debounce.
- Indicateur de statut dans le footer.

**Critère de succès** :
- Tests C3 + C4 verts.
- Manuellement : ouvrir un `.md`, taper, voir le statut « Sauvegardé », vérifier sur disque.
- Vault readonly : éditeur bloqué, bandeau visible.

**🚧 GATE 4** :
> « Phase 4 terminée. Édition WYSIWYG fonctionnelle, sauvegarde auto OK, readonly respecté. Teste manuellement avec un vrai fichier .md. Prêt pour la phase 5 (E2E) ? »

---

## Phase 5 — E2E + finitions

**Objectif** : tous les scénarios E2E passent, l'app est livrable.

**Tests à écrire d'abord** (RED) :
- E2E-1 à E2E-8.

**Implémentation** (GREEN) :
- Créer fixtures dans `tests/e2e/fixtures/` (3-4 fichiers `.md`).
- Helper Playwright pour lancer l'app Tauri avec un dossier config isolé (variable d'env `XDG_CONFIG_HOME` ou équivalent macOS).
- Compléter ce qui manque : menus contextuels (création/suppression/renommage), persistence du dernier fichier ouvert, filtre dans la sidebar.

**Critère de succès** :
- `npm run test:e2e` → 8/8 verts.
- `npm run test` → tous les tests unit/component verts.
- `cargo test` → tous les tests Rust verts.

**🚧 GATE 5** :
> « Phase 5 terminée. Tous les tests passent (X unit, Y component, 8 E2E). MVP livrable. Veux-tu un build de release (`npm run tauri build`) ? »

---

## Phase 6 (optionnelle) — Polish design

**Objectif** : appliquer le design system KODYO Canonical (registre Product) ou un thème neutre soigné.

**Tâches** :
- Tokens CSS (couleurs OKLCH, radius superellipse).
- Mode dark/light auto.
- Icônes (Lucide via `lucide-svelte`).
- Animations subtiles (sidebar collapse, toast apparition).

**🚧 GATE 6** :
> « Phase 6 terminée. App polie, prête à être utilisée au quotidien. »

---

## Règles permanentes pour Claude Code

1. **Toujours TDD** : aucun code de feature écrit sans test correspondant déjà rouge.
2. **Une commande à la fois** : à chaque tour, lance les tests, montre le résultat.
3. **Pas de scope creep** : si une idée surgit hors-scope MVP, la noter dans `BACKLOG.md` et ne pas l'implémenter.
4. **Respect du SPEC** : si quelque chose dans le spec semble incorrect ou ambigu, **demander avant de dévier**.
5. **À chaque GATE** : récap structuré (phase X terminée, Y tests verts, Z fichiers créés/modifiés), liste des éventuelles décisions prises, attente explicite de validation.
6. **Commits Git** : un commit par phase minimum, message format `feat(phase-N): description`.
