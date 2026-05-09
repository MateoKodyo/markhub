# Kodyo Markdown Hub — TESTS

Liste exhaustive et **ordonnée** des tests à écrire **avant** chaque feature. Chaque test doit être écrit, échouer (red), puis le code minimum est écrit pour le faire passer (green).

Convention de nommage : `describe('Module', () => { it('should ...', ...) })`.

---

## A. Unit tests Rust (`src-tauri/src/`, `cargo test`)

### A1. `models.rs`
- [ ] `Vault::new` génère un `id` UUID v4 valide.
- [ ] `VaultMode` se sérialise/désérialise en `"edit"` ou `"readonly"`.
- [ ] `Config` se sérialise en JSON avec la structure attendue (snapshot test).

### A2. `commands/config.rs`
- [ ] `config_load` : retourne une `Config` vide par défaut si le fichier n'existe pas.
- [ ] `config_load` : lit correctement un fichier existant.
- [ ] `config_load` : retourne une erreur lisible si le JSON est corrompu (pas un panic).
- [ ] `config_save` : crée le dossier parent s'il n'existe pas.
- [ ] `config_save` : écrit le JSON avec indentation 2 espaces.
- [ ] `config_save` puis `config_load` : round-trip identique.
- [ ] Round-trip avec `vaultStates` non vide : un Config qui contient `vault_states: { "id-1": { expanded_folders: ["a","a/b"] } }` se sérialise et se désérialise à l'identique.

### A3. `commands/vaults.rs`
- [ ] `vault_add` : ajoute un vault avec un id généré, retourne le vault complet (signature `(name, path, mode, color)`).
- [ ] `vault_add` : refuse si le path n'existe pas → erreur `"Path does not exist"`.
- [ ] `vault_add` : refuse si le path n'est pas un dossier → erreur `"Path is not a directory"`.
- [ ] `vault_add` : persiste la `color` fournie par le caller (front a la responsabilité de générer la couleur).
- [ ] `vault_remove` : retire le vault de la config.
- [ ] `vault_remove` : erreur si l'id n'existe pas.
- [ ] `vault_update` : met à jour name et/ou mode, laisse les autres champs intacts.

### A4. `commands/files.rs` — sécurité path traversal (CRITIQUE)
- [ ] `file_read` avec `relative_path = "../etc/passwd"` → erreur `"Path outside vault"`.
- [ ] `file_read` avec `relative_path = "/absolute/path"` → erreur.
- [ ] `file_write` avec `relative_path` contenant `..` qui sort du vault → erreur.
- [ ] `file_write` avec `relative_path = "subdir/../note.md"` (qui reste dans le vault après canonisation) → OK.

### A5. `commands/files.rs` — readonly
- [ ] `file_write` sur un vault `readonly` → erreur `"Vault is readonly"`.
- [ ] `file_create` sur un vault `readonly` → erreur.
- [ ] `file_delete` sur un vault `readonly` → erreur.
- [ ] `file_rename` sur un vault `readonly` → erreur.
- [ ] `file_read` sur un vault `readonly` → OK (la lecture est toujours autorisée).

### A6. `commands/files.rs` — opérations
- [ ] `vault_scan` : retourne uniquement les `.md` et `.markdown`, ignore les autres extensions.
- [ ] `vault_scan` : retourne une arbo récursive avec `isDirectory`.
- [ ] `vault_scan` : ignore les fichiers/dossiers cachés (qui commencent par `.`).
- [ ] `vault_scan` : tri alphabétique, dossiers avant fichiers.
- [ ] `file_read` : retourne le contenu UTF-8.
- [ ] `file_read` : erreur si le fichier n'existe pas.
- [ ] `file_write` : crée les dossiers parents si nécessaire.
- [ ] `file_write` : écrase un fichier existant.
- [ ] `file_create` : crée un fichier vide.
- [ ] `file_create` : erreur si le fichier existe déjà.
- [ ] `file_delete` : supprime le fichier.
- [ ] `file_rename` : renomme à l'intérieur du vault, refuse si le nouveau path sort du vault.

---

## B. Unit tests front (`tests/unit/`, `vitest`)

### B1. `lib/utils/path.ts`
- [ ] `joinPath('a', 'b/c')` → `'a/b/c'` (normalisation slashes).
- [ ] `getParentPath('a/b/c.md')` → `'a/b'`.
- [ ] `getFileName('a/b/c.md')` → `'c.md'`.
- [ ] `getFileNameWithoutExt('a/b/c.md')` → `'c'`.
- [ ] `isMarkdownFile('foo.md')` → `true`.
- [ ] `isMarkdownFile('foo.markdown')` → `true`.
- [ ] `isMarkdownFile('foo.txt')` → `false`.

### B2. `lib/utils/markdown.ts`
- [ ] `extractTitle(content)` : retourne le premier `# H1` du contenu.
- [ ] `extractTitle(content)` : fallback sur le nom de fichier si pas de H1.

### B5. `lib/utils/palette.ts`
- [ ] `pickNextColor(0)` retourne la première couleur de la palette.
- [ ] `pickNextColor(n)` cycle dans la palette (`palette[n % palette.length]`).
- [ ] La palette contient au moins 5 couleurs distinctes au format `#xxxxxx`.

### B6. `lib/utils/markdown.ts` — frontmatter
- [ ] `splitFrontmatter('# Hello')` → `{ frontmatter: null, body: '# Hello' }`.
- [ ] `splitFrontmatter('---\ntitle: x\n---\n\nbody')` → `{ frontmatter: 'title: x', body: 'body' }`.
- [ ] `splitFrontmatter('---\n---\n\nbody')` → frontmatter vide string `''` (entre les délimiteurs), body suit.
- [ ] `splitFrontmatter('# Title\n\n---\n\nseparator')` → pas de match (le `---` n'est pas en début de fichier) → `{ frontmatter: null, body: original }`.
- [ ] `joinFrontmatter(null, body)` → `body` (passe-plat si pas de frontmatter).
- [ ] `joinFrontmatter('title: x', 'body')` → `'---\ntitle: x\n---\n\nbody'` (round-trip de splitFrontmatter).

### B7. `lib/utils/tree.ts` — manipulation de l'arbre
- [ ] `toggleExpanded(['a', 'b'], 'a')` → `['b']` (retire si présent).
- [ ] `toggleExpanded(['a'], 'b')` → `['a', 'b']` (ajoute si absent).
- [ ] `flattenTree(root, new Set(['subfolder']))` retourne une liste plate dans l'ordre d'affichage : top-level dirs, top-level files, puis enfants des dirs dépliés. Chaque item exposé avec `{ entry, depth }`.
- [ ] `flattenTree` ignore les enfants des dossiers non dépliés.
- [ ] `findInsertionTarget(selection, tree)` : sélection vide → racine `''` ; sélection sur un dossier → ce dossier ; sélection sur un fichier → parent du fichier.
- [ ] `pruneExpandedFolders(['a', 'a/b', 'ghost'], tree)` retire les chemins qui ne correspondent plus à un dossier existant dans `tree`. Les chemins toujours valides (= il existe une `FileEntry isDirectory=true` à ce relativePath) sont conservés. Si tous les chemins ont disparu → `[]`. Si tree vide → `[]`.
- [ ] `collectAncestors('a/b/c.md')` → `['a', 'a/b']` — utilitaire pour calculer les parents auto-expand quand un fichier matche le filtre.
- [ ] `collectDirectories(tree)` retourne tous les `FileEntry` `isDirectory=true` triés par `relativePath` (sans la racine synthétique). Utilisé par `FolderPickerDialog` (« Déplacer vers… »).

### B3. `lib/stores/vaults.svelte.ts`
- [ ] État initial : `vaults = []`, `activeVaultId = null`, `vaultStates = {}`.
- [ ] `loadVaults()` appelle `config_load` et hydrate l'état (incluant `vaultStates`).
- [ ] `addVault(name, path, mode, color)` appelle `vault_add` puis ajoute au state local.
- [ ] `addVaultFromPicker()` : si picker retourne `null`, no-op.
- [ ] `addVaultFromPicker()` : si picker retourne un path, appelle `vault_add(basename, path, 'edit', pickNextColor(...))` et set `activeVaultId`.
- [ ] `removeVault(id)` appelle `vault_remove`, retire du state, et clear `activeVaultId` si c'était le vault actif. Retire aussi l'entrée `vaultStates[id]`.
- [ ] `updateVault(id, { name?, mode? })` appelle `vault_update` et reflète les changements dans le state local.
- [ ] `toggleFolderExpansion(vaultId, relativePath)` met à jour `vaultStates[vaultId].expandedFolders` et persiste via `config_save`.
- [ ] `expandedFoldersFor(vaultId)` retourne un `Set<string>` des chemins dépliés.
- [ ] `selectVault(id)` met à jour `activeVaultId`.
- [ ] `activeVault` (derived) retourne le bon vault.
- [ ] `isActiveVaultReadonly` (derived) retourne `true` si vault sélectionné est readonly.

### B4. `lib/stores/activeFile.svelte.ts`
- [ ] État initial : `activeFile = null`, `content = ''`, `status = 'idle'`.
- [ ] `openFile(vaultId, relativePath)` : passe `status` à `'loading'` puis `'saved'`, charge le contenu.
- [ ] `updateContent(newContent)` : passe `status` à `'modified'`, schedule la sauvegarde debounced.
- [ ] Après 1500ms d'inactivité → `status` passe à `'saving'` puis `'saved'`.
- [ ] `forceSave()` : sauvegarde immédiatement, annule le debounce.
- [ ] Si vault readonly : `updateContent` n'écrit jamais sur disque (mock vérifie 0 appels à `file_write`).

---

## C. Component tests (`tests/component/`, `@testing-library/svelte`)

### C1. `VaultList.svelte`
- [ ] Affiche tous les vaults avec leur nom et pastille couleur.
- [ ] Affiche un cadenas pour les vaults readonly.
- [ ] Click sur un vault → appelle `selectVault` avec le bon id.
- [ ] Le vault actif a une classe CSS `is-active`.

### C2. `FileTree.svelte`
- [ ] Affiche l'arbre récursivement, avec dossiers triés avant fichiers (déjà géré côté Rust).
- [ ] Indentation visible : padding-left croît avec depth (16px par niveau).
- [ ] Au mount initial avec un set `expanded` vide, **tous les dossiers sont repliés** (chevron-right visible, enfants cachés).
- [ ] Click sur le chevron ou le nom d'un dossier → callback `onToggle(relativePath)` invoqué.
- [ ] Click sur un fichier → `onFileClick(relativePath)` invoqué.
- [ ] Affiche un message « Vault vide » si pas de fichiers.
- [ ] Filtre récursif : avec filter='foo' et un fichier matching profond, le composant calcule un set d'expanded auto qui inclut les parents du match (sans muter l'expanded persisté du parent).
- [ ] Icônes Lucide rendues : `chevron-right` / `chevron-down` pour le toggle, `folder` / `folder-open` pour les dossiers, `file-text` pour les fichiers `.md`.
- [ ] **Renommage inline** : quand `renamingPath` correspond à une entrée, un `InlineInput` (data-testid `inline-rename`) la remplace, prefilled avec le nom de l'entrée.
- [ ] **F2** sur une entrée focusée → callback `onStartRename(entry)`.
- [ ] **Double-clic** sur la row d'une entrée → callback `onStartRename(entry)`.

### C3. `Editor.svelte`
- [ ] Reçoit `content` en props et l'affiche dans Milkdown.
- [ ] Émet `change` avec le nouveau contenu quand l'utilisateur tape.
- [ ] Si `readonly={true}`, l'éditeur ne permet pas d'éditer.
- [ ] Toggle Preview / Source affiche bien le textarea brut en mode source.
- [ ] **Frontmatter** : si `content` commence par `---\n…\n---`, en mode preview un bloc `<details data-frontmatter>` apparaît en haut, replié par défaut, avec le YAML brut dans un `<pre>` ; le reste du document est rendu normalement par Milkdown.
- [ ] **Frontmatter round-trip** : quand Milkdown notifie un changement du body, le `onChange` parent reçoit `frontmatter + body` recombiné (le YAML d'origine n'est pas perdu).
- [ ] **Frontmatter en source** : aucun changement — le textarea contient `frontmatter + body` brut.

### C6. `InlineInput.svelte` (nouveau composant)
- [ ] Rendu : input text seul, sans backdrop / overlay (s'insère en flux DOM).
- [ ] Reçoit focus auto au mount.
- [ ] Enter avec une valeur non vide → callback `onSubmit(value)`.
- [ ] Enter avec valeur vide → no-op.
- [ ] Escape → callback `onCancel`.
- [ ] Blur → callback `onCancel` (même comportement que Escape).
- [ ] `selectionRange={[0, 4]}` pré-sélectionne uniquement les 4 premiers caractères au mount (utile pour rename de `note.md` → sélection `note`).
- [ ] `errorMessage` prop affiche un texte d'erreur inline + classe `has-error` sur l'input.
- [ ] Quand `onSubmit` rejette (e.g. conflit de nom serveur), l'erreur capturée est affichée inline et l'input reste ouvert.

### C7. `FolderPickerDialog.svelte`
- [ ] Liste tous les dossiers du tree + entrée « (racine du vault) ».
- [ ] Click sur un dossier → `onSubmit(relativePath)`.
- [ ] Click racine → `onSubmit('')`.
- [ ] `excludePath` retire un dossier candidat (utile pour exclure le parent actuel quand on déplace).

### C8. Audit anti-emoji
- [ ] `EditorToolbar` ne contient aucun caractère unicode dans les blocs emoji/symbols (1F000–1FFFF, 2700–27BF, 2600–26FF, 2300–23FF). Toutes les icônes viennent de `lucide-svelte`.
- [ ] `VaultList` ne contient aucun emoji (le cadenas readonly est rendu via Lucide `Lock`).

### C4. `EditorToolbar.svelte`
- [ ] Boutons présents : Bold, Italic, Code, H1, H2, H3, Lien.
- [ ] Click Bold → appelle la commande Milkdown bold.
- [ ] Désactivée si `readonly={true}`.

### C5. `VaultList.svelte` — context menu
- [ ] Right-click sur un vault émet `onContextMenu(vault, x, y)` avec les coordonnées de la souris.
- [ ] Le right-click sur un vault `readonly` émet quand même l'événement (la décision d'afficher / désactiver des items est dans le parent).

> Ancien `C5 — AddVaultDialog.svelte` supprimé : le composant a été retiré au profit du flow direct (clic `+ Ajouter vault` → picker natif → vault créé). La logique du flow vit désormais dans `vaultsStore.addVaultFromPicker()` testé en B3.

---

## D. E2E tests (`tests/e2e/`, Playwright + tauri-driver)

> Les E2E utilisent un dossier temporaire fixture en `tests/e2e/fixtures/` avec quelques fichiers `.md` de test.

### E2E-1 : Premier lancement et ajout d'un vault
- [ ] App vide affiche « Ajoutez votre premier vault ».
- [ ] Click sur « + Ajouter vault » → le sélecteur natif s'ouvre directement.
- [ ] Sélection du dossier fixture → vault apparaît dans la sidebar avec `name = basename(path)` et une pastille colorée.
- [ ] Le fichier `config.json` sur disque contient le nouveau vault avec `mode = "edit"` et un `color` non vide.

### E2E-2 : Naviguer dans un vault
- [ ] Ajouter le vault fixture.
- [ ] Cliquer sur le vault → l'arbo des fichiers s'affiche.
- [ ] Cliquer sur `note1.md` → contenu affiché dans l'éditeur en mode preview.
- [ ] Toggle mode source → markdown brut affiché.
- [ ] Toggle retour preview → rendu correct.

### E2E-3 : Édition et sauvegarde auto
- [ ] Ouvrir `note1.md` en mode source.
- [ ] Ajouter du texte.
- [ ] Statut passe à « Modifié ».
- [ ] Attendre 2s → statut passe à « Sauvegardé ».
- [ ] Lire le fichier sur disque (via Node fs dans le test) → nouveau contenu présent.

### E2E-4 : Vault readonly
- [ ] Ajouter un second vault en mode readonly.
- [ ] Le sélectionner, ouvrir un fichier.
- [ ] Bandeau « Lecture seule » visible.
- [ ] Tenter de taper dans l'éditeur → aucune modification du contenu.
- [ ] Le fichier sur disque est inchangé après attente de 3s.

### E2E-5 : Persistence après redémarrage
- [ ] Avec 2 vaults configurés et un fichier ouvert, fermer l'app.
- [ ] Relancer l'app.
- [ ] Les 2 vaults sont là, le même fichier est ouvert au démarrage.

### E2E-6 : Toolbar de styles
- [ ] Ouvrir un fichier en mode preview.
- [ ] Sélectionner du texte → toolbar apparaît.
- [ ] Cliquer Bold → texte devient gras dans le preview.
- [ ] Toggle source → markdown contient `**texte**`.

### E2E-7 : Création de fichier
- [ ] Click droit sur un dossier dans la sidebar → menu contextuel « Nouveau fichier ».
- [ ] Saisir un nom → fichier créé sur disque, ouvert dans l'éditeur, vide.

### E2E-8 : Suppression de fichier
- [ ] Click droit sur un fichier → « Supprimer ».
- [ ] Confirmation requise.
- [ ] Fichier disparaît de l'arbo et du disque.

### E2E-9 : Persistence de l'état d'expansion + création contextuelle
- [ ] Avec un vault contenant des sous-dossiers, déplier 2 dossiers à des profondeurs différentes.
- [ ] Click sur le bouton `+ folder` (sans sélection) → input inline à la racine ; taper `assets` + Enter → dossier créé.
- [ ] Sélectionner le dossier `assets` ; click `+ file` → input inline à l'intérieur de `assets` ; taper `cover` + Enter → fichier `assets/cover.md` créé et ouvert.
- [ ] Fermer puis rouvrir l'app → les 2 dossiers initialement dépliés sont toujours dépliés ; `assets` reste tel que laissé.

---

## Quotas et exigences

- **Chaque test doit être indépendant** : pas d'ordre implicite, pas d'état partagé entre tests.
- **Chaque test décrit son intention** : nom clair, pas de magic numbers sans explication.
- **Mocks Tauri** côté front : utiliser `@tauri-apps/api/mocks` pour mocker `invoke()` dans les tests unit/component.
- **Aucun test ne touche le vrai filesystem utilisateur** : E2E utilisent un dossier temp dédié, créé/nettoyé par le test runner.
