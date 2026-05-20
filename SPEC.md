# Markus — SPEC

## 1. Vision

Application de bureau locale qui centralise la consultation et l'édition de fichiers Markdown éparpillés sur le disque, **sans les déplacer**. Concept-clé : une **bibliothèque de vaults = alias vers des dossiers réels** (vault Obsidian, dossier de skills Claude, specs projets, CLAUDE.md, briefs clients, etc.).

L'éditeur central est WYSIWYG (style Typora) avec toggle vers vue source. Sauvegarde automatique. Mode `readonly` pour les vaults qu'on veut juste consulter (les skills par exemple).

## 2. Stack imposée

- **Tauri 2.x** (backend Rust)
- **SvelteKit** en SPA mode (`@sveltejs/adapter-static`, `prerender = true`, `ssr = false`)
- **Svelte 5** avec runes (`$state`, `$derived`, `$effect`, `$props`)
- **TypeScript** strict
- **Milkdown** + preset `crepe` pour l'éditeur WYSIWYG markdown (https://milkdown.dev)
- **Vitest** pour unit + component
- **@testing-library/svelte** pour les tests de composants
- **Playwright** + `tauri-driver` pour les E2E
- **Pas de Tailwind** : CSS vanilla avec variables CSS, suivant le **design system documenté dans `design.md`** — esthétique « warm-dark » inspirée Warp/Cursor/Terminal. Palette monochromatique warm gray (Warm Parchment `#faf9f6` en text, Earth Gray `#353534` en surface, etc.), typographie **Geist** (Sans + Mono), pas d'ombres lourdes (depth via bordures semi-transparentes `rgba(226,226,226,0.35)` et opacity shifts). Voir `design.md` pour le détail complet.

## 3. Architecture

### 3.1 Structure des dossiers

```
markdown-hub/
├── src-tauri/               # Backend Rust
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── commands/        # Commandes Tauri exposées au front
│   │   │   ├── mod.rs
│   │   │   ├── vaults.rs    # CRUD vaults (config)
│   │   │   ├── files.rs     # Lecture/écriture/scan fichiers
│   │   │   └── config.rs    # Lecture/écriture du config.json
│   │   └── models.rs        # Vault, FileEntry, Config
│   └── Cargo.toml
├── src/                     # Frontend SvelteKit
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Sidebar.svelte
│   │   │   ├── VaultList.svelte
│   │   │   ├── FileTree.svelte
│   │   │   ├── Editor.svelte           # Wrapper Milkdown
│   │   │   ├── EditorToolbar.svelte    # Styles flottants
│   │   │   ├── ModeToggle.svelte       # Preview/Source
│   │   │   └── AddVaultDialog.svelte
│   │   ├── stores/
│   │   │   ├── vaults.svelte.ts        # State runes
│   │   │   ├── activeFile.svelte.ts
│   │   │   └── config.svelte.ts
│   │   ├── tauri/                      # Wrappers typés des commandes
│   │   │   └── api.ts
│   │   └── utils/
│   │       ├── path.ts
│   │       └── markdown.ts
│   ├── routes/
│   │   └── +page.svelte                # App à page unique
│   └── app.css
├── tests/
│   ├── unit/
│   ├── component/
│   └── e2e/
├── package.json
├── vite.config.ts
├── svelte.config.js
└── playwright.config.ts
```

### 3.2 Modèle de données

**Config persistée** dans `~/.kodyo-md-hub/config.json` (chemin résolu via Tauri `app_config_dir`) :

```json
{
  "version": 1,
  "vaults": [
    {
      "id": "uuid-v4-1",
      "name": "Notes perso",
      "path": "/Users/matheo/Documents/MD",
      "mode": "edit",
      "color": "#A78BFA"
    },
    {
      "id": "uuid-v4-2",
      "name": "Skills Claude",
      "path": "/Users/matheo/.claude/skills/user",
      "mode": "readonly",
      "color": "#60A5FA"
    }
  ],
  "lastOpenedFile": {
    "vaultId": "uuid-v4-1",
    "relativePath": "subfolder/note.md"
  },
  "settings": {
    "autoSaveDelayMs": 1500,
    "theme": "system"
  },
  "vaultStates": {
    "uuid-v4-1": {
      "expandedFolders": ["subfolder", "subfolder/deeper"]
    },
    "uuid-v4-2": {
      "expandedFolders": []
    }
  }
}
```

**`vaultStates`** est une map indexée par `vault.id` qui persiste l'état UI de chaque vault. Pour le MVP, un seul champ : `expandedFolders` (liste de relativePaths actuellement dépliés dans la sidebar). Au prochain démarrage, l'arbo se restaure dans le même état d'expansion. Si un dossier disparaît du disque entre deux sessions, il est silencieusement retiré de `expandedFolders` au prochain scan.

**FileEntry** (retourné par le scan d'un vault) :

```ts
type FileEntry = {
  name: string;          // "note.md"
  relativePath: string;  // "subfolder/note.md"
  isDirectory: boolean;
  children?: FileEntry[]; // récursif si directory
};
```

### 3.3 Commandes Tauri (contrat front ↔ back)

```rust
// commands/config.rs
#[tauri::command] fn config_load() -> Result<Config, String>
#[tauri::command] fn config_save(config: Config) -> Result<(), String>

// commands/vaults.rs
#[tauri::command] fn vault_add(name: String, path: String, mode: VaultMode, color: String) -> Result<Vault, String>
#[tauri::command] fn vault_remove(id: String) -> Result<(), String>
#[tauri::command] fn vault_update(id: String, name: Option<String>, mode: Option<VaultMode>) -> Result<Vault, String>
// Note : `vault_pick_directory` Rust est obsolète — le front utilise le plugin
// JS `@tauri-apps/plugin-dialog` directement (évite les soucis de main thread macOS).

// commands/files.rs
#[tauri::command] fn vault_scan(vault_id: String) -> Result<FileEntry, String>  // arbo récursive .md uniquement
#[tauri::command] fn file_read(vault_id: String, relative_path: String) -> Result<String, String>
#[tauri::command] fn file_write(vault_id: String, relative_path: String, content: String) -> Result<(), String>
#[tauri::command] fn file_create(vault_id: String, relative_path: String) -> Result<(), String>
#[tauri::command] fn file_delete(vault_id: String, relative_path: String) -> Result<(), String>
#[tauri::command] fn file_rename(vault_id: String, old_path: String, new_path: String) -> Result<(), String>
#[tauri::command] fn folder_create(vault_id: String, relative_path: String) -> Result<(), String>
```

**Règle de sécurité** : toute commande `file_*` qui prend un `relative_path` **doit** :
1. Résoudre le chemin absolu en joignant `vault.path + relative_path`.
2. Canoniser le résultat et vérifier qu'il commence bien par le `vault.path` canonisé (anti path-traversal).
3. Si le vault est en mode `readonly`, **refuser** toute opération write/create/delete/rename.

### 3.4 UI

```
┌──────────────────────────────────────────────────────────────┐
│  [Sidebar]          │  [Editor]                              │
│                     │                                        │
│  Vaults             │  ┌──────────────────────────────────┐ │
│  ● Notes perso      │  │ chemin/du/fichier.md  [👁 / </>] │ │
│  ● Skills 🔒        │  ├──────────────────────────────────┤ │
│  ● Klip specs       │  │                                  │ │
│  ─────              │  │  Contenu WYSIWYG ou source       │ │
│  Files              │  │                                  │ │
│  📁 folder/         │  │                                  │ │
│   📄 note.md        │  │                                  │ │
│   📄 todo.md        │  │                                  │ │
│  📄 readme.md       │  │                                  │ │
│                     │  └──────────────────────────────────┘ │
│  [+ Ajouter vault]  │  💾 Sauvegardé · il y a 2s            │
└──────────────────────────────────────────────────────────────┘
```

- **Sidebar gauche, largeur 280px** (resizable phase 2) :
  - Section haute : liste des vaults. Click = sélection. Pastille de couleur (Lucide-cohérente). Cadenas si readonly. **Right-click sur un vault** ouvre un menu contextuel : `Renommer`, `Mode édition / Mode lecture seule` (toggle), `Supprimer`.
  - Bouton « + Ajouter vault » (icône Lucide `plus` à gauche du label). **Click ouvre directement le sélecteur natif macOS** (pas de formulaire intermédiaire) ; à la sélection d'un dossier, le vault est créé immédiatement avec :
    - `name` = basename du chemin sélectionné
    - `mode` = `"edit"` par défaut
    - `color` = couleur générée automatiquement par rotation (`src/lib/utils/palette.ts`)
  - La génération du `name` et de la `color` est **côté front** ; Rust reste un service bas-niveau qui prend `(name, path, mode, color)` et persiste tel quel.
- **Section fichiers** (visible si un vault est actif) :
  - Header de section : label `FICHIERS` à gauche, deux boutons icône à droite — `file-plus` (nouveau fichier) + `folder-plus` (nouveau dossier).
  - Champ de filtre `Filtrer…` en dessous, **filtre récursivement l'arbre entier** : seuls les fichiers/chemins matching apparaissent ; les dossiers parents d'un match sont automatiquement dépliés temporairement (sans mutation de `expandedFolders` persisté). Filtre vidé → retour à l'état d'expansion persisté.
  - **Arbre récursif** (pattern Warp / VS Code) :
    - Affichage hiérarchique des dossiers et fichiers, profondeur illimitée.
    - Indentation **16px par niveau**.
    - Chaque dossier : chevron Lucide (`chevron-right` replié, `chevron-down` déplié) + icône `folder` / `folder-open`.
    - Chaque fichier markdown : icône `file-text`.
    - Tri : dossiers d'abord (alphabétique), fichiers ensuite (alphabétique). Géré côté Rust dans `vault_scan` (déjà en place).
    - **État initial** : tous les dossiers REPLIÉS au premier scan d'un vault.
    - **Persistence** : chaque toggle expand/collapse est persisté immédiatement dans `Config.vaultStates[vaultId].expandedFolders` (array de relativePath). Au redémarrage, l'arbre se restaure à l'identique.
    - Click sur le chevron OU sur le nom du dossier → toggle.
    - Click sur un fichier → ouvre dans l'éditeur.
    - **Right-click** sur un fichier : menu contextuel `Renommer`, `Déplacer vers…`, `Supprimer`. Right-click sur un dossier : `Nouveau fichier`, `Nouveau dossier`, `Renommer`. Right-click zone vide / racine : `Nouveau fichier` + `Nouveau dossier`.
    - **Renommage inline** (pattern Finder / VS Code) : déclenchable par **double-clic** sur le label, **F2** quand l'entrée a le focus, ou via le menu contextuel. Le label devient un `InlineInput` en place, pré-sélectionné sur le nom sans l'extension `.md`. Enter valide via `file_rename`, Escape/blur annule. Conflit de nom (rejet Rust) → border rouge + message inline. L'extension `.md` est ré-ajoutée automatiquement si l'utilisateur la supprime.
    - **Déplacer vers…** ouvre un sélecteur de dossier (`FolderPickerDialog`) listant tous les dossiers du vault courant + l'option « (racine du vault) ». Sélection d'un dossier → `file_rename(vault_id, oldPath, joinPath(targetDir, basename(oldPath)))`. Drag-drop intra-vault reste backlog.
  - **Création contextuelle in-tree** (pattern VS Code) :
    - Click sur `file-plus` ou `folder-plus` → un input inline apparaît à l'emplacement de création :
      - Aucun élément sélectionné → racine du vault.
      - Un dossier sélectionné → à l'intérieur de ce dossier (auto-expand si replié).
      - Un fichier sélectionné → dans le dossier parent du fichier.
    - L'input inline a focus auto. **Enter valide**, **Escape annule**. Pour un fichier, l'extension `.md` est ajoutée automatiquement si absente.

- **Zone éditeur** (à droite de la sidebar, occupe le reste de la largeur) :
  - **Header** (étalé full-width de la zone éditeur, hauteur ~44px) : breadcrumb à gauche, toolbar styles + toggle Preview/Source + statut de sauvegarde à droite.
  - **Corps** : zone scrollable centrale (full-width). Markus édite des docs techniques (specs, briefs, CLAUDE.md, journaux) avec blocs de code, tableaux, listes imbriquées profondes — full-width est le bon choix, pas le centrage 760px style Linear/Notion. Référence : VS Code / Cursor / GitHub readme.
    - largeur max **`--content-max-width: 1280px`** (centré seulement sur écrans ultra-wide)
    - padding horizontal **`--content-padding-x: 64px`** de chaque côté
  - **Footer** : aucun footer dédié pour l'instant — le statut de sauvegarde vit dans le header.
- **Toutes les icônes UI proviennent de `lucide-svelte`** — zéro emoji unicode autorisé. Règle de cohérence visuelle non-négociable. Test d'audit dédié dans `tests/component/no-emoji.test.svelte.ts`.
- **Frontmatter YAML** (cas spécifique du body) :
  - **Mode preview** : si le contenu commence par un bloc `---\n…\n---`, ce bloc est extrait et rendu **séparément en haut du document**, dans un `<details>` replié par défaut, summary `▸ Frontmatter`, body en `<pre><code>` typo monospace, fond `--color-surface-veil`, taille `--text-caption`. Le reste du contenu est rendu normalement par Milkdown.
  - **Mode source** : aucun changement, le frontmatter apparaît tel quel dans le markdown brut.
  - **Round-trip** : Milkdown ne voit que le body (sans frontmatter). Sur `onChange`, le frontmatter d'origine est préservé et reconcaténé avant la sauvegarde.
- **Toolbar de styles flottante** : apparaît à la sélection de texte en mode preview. Contient : **Bold**, **Italic**, **Code inline**, **H1 / H2 / H3**, **Lien**. (Milkdown Crepe fournit ça out-of-the-box.)
- **Mode readonly** : éditeur passé en `readonly` Milkdown, sauvegarde désactivée, bandeau discret « Lecture seule » dans le header.

### 3.5 Sauvegarde auto (style Obsidian)

- Debounce de **1500 ms** après la dernière frappe.
- Sauvegarde aussi sur **blur** de l'éditeur (changement de fichier, perte de focus de la fenêtre).
- Statut visible : « ✏️ Modifié » → « 💾 Sauvegardé · il y a Xs ».
- Si le vault est readonly, jamais de sauvegarde, jamais d'indicateur « modifié ».

### 3.6 Scope MVP — gelé

✅ Inclus :
- CRUD vaults (ajouter, supprimer, renommer, changer mode) — ajout via sélecteur natif direct ; supprimer/renommer/toggle mode via menu contextuel (right-click) sur un vault.
- Sélecteur natif de dossier pour ajouter un vault (via `@tauri-apps/plugin-dialog`)
- Scan récursif `.md` (et `.markdown`)
- **Arbre de fichiers récursif** avec hiérarchie profonde (dossiers + sous-dossiers), expand/collapse par dossier, indentation par niveau
- **Persistence de l'état d'expansion** par vault dans `Config.vaultStates`
- **Filtre récursif** dans la sidebar (auto-expand temporaire des chemins matching)
- **Création contextuelle** in-tree de fichiers (`+ file`) et de dossiers (`+ folder`) avec input inline (Enter/Escape)
- Édition WYSIWYG + toggle source, **layout centré 760px / padding 48px**
- **Frontmatter YAML** rendu en bloc `<details>` replié monospace en mode preview ; round-trip préservé au save
- Toolbar de styles à la sélection
- Sauvegarde auto debounce + blur
- Mode readonly fonctionnel
- Persistence du dernier fichier ouvert
- Création / suppression / renommage de fichiers via menu contextuel (right-click)

❌ **Hors scope MVP** (gelé, ne pas dériver) :
- Recherche full-text cross-vaults
- Frontmatter parsing/UI dédiée (édition champ par champ — on rend juste le bloc, on ne le parse pas en form)
- Tags, backlinks, graph view
- Plugins, thèmes custom utilisateur
- Sync, multi-fenêtres
- Drag-drop de fichiers entre vaults (et entre dossiers intra-vault)

## 4. Conventions de code

- **Composants Svelte 5** : tous en runes (`$state`, `$props`, `$derived`, `$effect`). Pas de `let` réactif legacy.
- **Stores** : fichiers `*.svelte.ts` exportant un objet avec runes (pattern moderne Svelte 5).
- **Commandes Tauri** : toujours wrappées côté front dans `src/lib/tauri/api.ts` avec types stricts. Jamais d'appel direct `invoke()` dans un composant.
- **Erreurs Rust** : retournent `Result<T, String>`. Côté front, toute erreur est catchée et affichée via un toast simple (composant `Toast.svelte` minimal à créer).
- **Tests** : un fichier de test à côté de chaque module non-trivial. Coverage cible : **80% sur les utils et stores**, E2E sur les flows critiques.

## 5. Critères d'acceptation MVP (golden path E2E)

L'app est livrable quand ces 5 scénarios E2E passent :

1. **Premier lancement** : app vide, message « Ajoutez votre premier vault ». Click sur `+ Ajouter vault` → sélecteur natif macOS s'ouvre directement (pas de dialog form) → dossier sélectionné → vault apparaît dans la sidebar avec `name = basename(path)`, `mode = "edit"`, `color` rotée depuis la palette front.
2. **Naviguer** : ajouter 2 vaults dont un readonly. Cliquer sur un fichier `.md` du vault edit → contenu affiché en preview. Toggle vers source → markdown brut visible.
3. **Éditer + sauver** : modifier le contenu, attendre 1.5s → indicateur passe à « Sauvegardé ». Relire le fichier sur disque (via le test) → contenu correspond.
4. **Readonly respecté** : ouvrir un fichier d'un vault readonly. Tenter de modifier → l'éditeur ne réagit pas. Aucune écriture sur disque.
5. **Persistence** : fermer l'app, rouvrir → mêmes vaults, même fichier ouvert au même endroit.
