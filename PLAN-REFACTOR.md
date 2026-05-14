# PLAN-REFACTOR — Sprint hygiène & dette technique

> **Source** : code review complet du 2026-05-13 (Claude Opus 4.7, focus archi & qualité code).
> **Statut** : à dérouler **après** la feature Taming, sur branche dédiée `chore/refactor-sprint`.
> **Différence avec un PLAN-* classique** : ce n'est pas un chantier feature TDD-strict avec gates. C'est un sprint d'hygiène — 9 items indépendants, chacun peut être pris seul, sans ordre obligatoire (sauf signalé).

---

## Contexte

Le code review a identifié une codebase **largement au-dessus de la moyenne** (TDD discipliné, sécurité Rust solide, 120/120 + 407/407 tests verts, doc `WHY` partout). Les findings sont des **patterns émergents non encore stabilisés** (notamment côté command system, plus jeune que le reste), pas des problèmes d'archi de fond.

Ce plan **n'est pas bloquant pour ship**. C'est du tooling pour les prochaines features (réduit le risque de drift quand on touche un endroit dupliqué).

---

## Vue d'ensemble — table de progression

| # | Item | Effort | Impact | Sprint quick-win ? | Statut |
|---|------|--------|--------|--------------------|--------|
| **A** | Factoriser `find_next_available_name()` (collision suffix Rust) | 30 min | 🟠 prévient drift | ✅ Oui | ⬜ pending |
| **B** | Atomic write sur `config.json` (pattern de `settings.rs`) | 30 min | 🟠 robustesse persist | ✅ Oui | ⬜ pending |
| **C** | Helper `wirePluginStore()` dans `Editor.svelte` | 1h | 🟢 lisibilité | ❌ Optionnel | ⬜ pending |
| **D** | Constants typés pour events globaux (`src/lib/events.ts`) | 30 min | 🟢 anti-typo | ✅ Oui | ⬜ pending |
| **E** | Supprimer `BehaviorSettings` côté Rust + legacy `Settings` | 1h | 🟢 dette migration | ❌ Plus tard | ⬜ pending |
| **F** | Décision finale sur routes `_blocknote-test` / `_visual` | 15 min | 🟢 hygiène | ✅ Oui | ⬜ pending |
| **G** | Macro `tauri_vault_op!` pour wrappers répétitifs | 1-2h | 🟢 lisibilité Rust | ❌ Optionnel | ⬜ pending |
| **H** | Refactor Sidebar : extraire `useDialogs` + flows en fonctions pures | 1-2j | 🟡 testabilité | ❌ Pas maintenant | ⬜ pending |
| **I** | Unifier les 2 paths d'écriture `theme` (vaults vs settings) | 1-2h | 🟡 dette migration | ❌ Plus tard | ⬜ pending |

**Sprint quick-win recommandé** : **A + B + D + F**, ~2h total, zéro risque, gain immédiat.

---

## Sprint quick-win (A + B + D + F) — recommandé

Pas d'ordre obligatoire entre ces 4 items. Personnellement je ferais B en premier (le plus impactant techniquement) puis A → D → F.

**Branche** : `chore/refactor-sprint`

**Critère de sortie global** :
- ✅ `cargo test` : 120/120 (pas de régression)
- ✅ `npm run test` : 407/407 (pas de régression)
- ✅ `npm run check` : 0 erreur / 0 warning
- ✅ Build dev OK (`npm run tauri dev` se lance sans erreur)
- ✅ Smoke test : créer un vault, créer/dupliquer/importer un fichier, toggle dossier, modifier un setting → tout fonctionne comme avant

---

## A — Factoriser `find_next_available_name()` (Rust)

### Problème

`src-tauri/src/commands/files.rs` implémente **deux fois** le même algorithme "trouver le prochain nom disponible avec suffixe `copie`" :

- **Lignes 173-194** dans `duplicate_file()` — démarre à `attempt=1`, génère `note copie.md` puis `note copie 2.md` …
- **Lignes 277-298** dans `import_files()` — démarre à `attempt=0`, génère `note.md` puis `note copie.md` puis `note copie 2.md` …

L'algorithme est subtilement différent (offset de démarrage), mais le format de suffixe et la logique de boucle sont identiques. Risque : un futur changement (i18n du suffixe, gestion `.tar.gz`) doit toucher 2 endroits → drift garanti.

### Solution

Extraire une fonction utilitaire dans `files.rs` (ou un nouveau module `name_collision.rs` si on en a d'autres usages un jour) :

```rust
/// Find the first available name for `base_name` in `directory`, avoiding
/// both on-disk collisions AND names in `also_taken` (for batch imports
/// where multiple sources land in the same call). Returns the chosen name.
///
/// Format: "{stem} copie{ext}" then "{stem} copie 2{ext}", "{stem} copie 3{ext}"…
/// `start_at_zero=true` first tries the bare `{stem}{ext}` (import flow);
/// `start_at_zero=false` skips it and starts at "copie" (duplicate flow).
fn find_next_available_name(
    directory: &Path,
    stem: &str,
    ext: &str,
    start_at_zero: bool,
    also_taken: &[String],
) -> Result<String, String> {
    let mut attempt: u32 = if start_at_zero { 0 } else { 1 };
    loop {
        let candidate = match attempt {
            0 => format!("{stem}{ext}"),
            1 => format!("{stem} copie{ext}"),
            n => format!("{stem} copie {n}{ext}"),
        };
        let candidate_abs = directory.join(&candidate);
        if !candidate_abs.exists() && !also_taken.contains(&candidate) {
            return Ok(candidate);
        }
        attempt += 1;
        if attempt > 100 {
            return Err(format!("Too many name collisions for {stem}{ext}"));
        }
    }
}
```

### Tests à ajouter

Réutiliser les tests existants (ils continuent de passer = preuve que la factorisation n'a pas régressé). Optionnellement, ajouter :
- `find_next_available_name_starts_at_zero_for_imports`
- `find_next_available_name_starts_at_copie_for_duplicates`
- `find_next_available_name_respects_also_taken`

### Fichiers modifiés

- `src-tauri/src/commands/files.rs` (ajout fn + 2 call sites refactorés)

---

## B — Atomic write sur `config.json`

### Problème

`src-tauri/src/commands/config.rs:45-60` (`save_config_to_path`) écrit `config.json` directement via `fs::write(path, json)`. Une coupure pendant le write peut laisser un `config.json` tronqué/corrompu → perte de tous les vaults au prochain boot.

À l'inverse, `src-tauri/src/commands/settings.rs:142-167` utilise la pattern atomique propre (write to `.tmp` → `fs::rename` → cleanup `.tmp` on failure). **Inconsistance** : settings est protégé, config (plus critique) ne l'est pas.

### Solution

Recopier la pattern atomique de `settings.rs` dans `config.rs`. Code presque identique :

```rust
pub fn save_config_to_path(path: &Path, config: &Config) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| {
                format!("Failed to create config parent directory {}: {e}", parent.display())
            })?;
        }
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json)
        .map_err(|e| format!("Failed to write config tmp file {}: {e}", tmp.display()))?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Failed to atomically install config at {}: {e}", path.display())
    })?;
    Ok(())
}
```

### Tests à ajouter

Copier l'esprit de `save_leaves_no_tmp_file_behind_on_success` de `settings.rs:221-227` pour config :
- `save_config_leaves_no_tmp_file_behind_on_success`
- `save_config_overwrites_existing_file_atomically`

Le test existant `save_writes_two_space_indented_json` continue de passer (format inchangé).

### Fichiers modifiés

- `src-tauri/src/commands/config.rs` (modif `save_config_to_path` + ajouts tests)

---

## C — Helper `wirePluginStore()` (Editor.svelte) — OPTIONNEL

### Problème

`src/lib/components/Editor.svelte:404-490` répète **4 fois** le même pattern pour wirer les plugins BlockNote (slashMenu, formattingToolbar, sideMenu, tableHandles) :

```ts
const xExt = (editor as any).getExtension?.('xName');
if (xExt?.store) {
    xExt.someInit?.();
    const off = xExt.store.subscribe((payload) => { /* ... */ });
    if (typeof off === 'function') unsubscribers.push(off);
}
```

### Solution

Extraire un helper dans le scope de l'effect ou dans un fichier `src/lib/editor/wire-plugin.ts` :

```ts
function wirePluginStore<TPayload>(
    editor: any,
    extensionName: string,
    onPayload: (payload: TPayload | undefined) => void,
    onInit?: (ext: any) => void,
): (() => void) | null {
    const ext = (editor as any).getExtension?.(extensionName);
    if (!ext?.store) return null;
    onInit?.(ext);
    const off = ext.store.subscribe((p: { currentVal: TPayload }) => onPayload(p.currentVal));
    return typeof off === 'function' ? off : null;
}
```

### Pourquoi optionnel

Le code actuel marche, est lisible (chaque plugin a son bloc explicite), et chaque wiring a des particularités (initial call pour linkToolbar, freezeMenu pour sideMenu, etc.). Le gain est cosmétique. **Ne pas faire si on n'a pas le temps.**

### Fichiers modifiés

- `src/lib/components/Editor.svelte` (si fait)

---

## D — Constants typés pour events globaux

### Problème

Le projet utilise un **event bus implicite** via `window.dispatchEvent` / `addEventListener` pour communiquer entre composants (notamment palette → Sidebar). Les noms d'events et les "actions" sont des strings inline disséminées dans plusieurs fichiers :

- `palette:action` (catalog.ts:35, Sidebar.svelte:106)
- Actions transportées : `newFile`, `newFolder`, `importFile`, `importPaths` (catalog.ts:51 etc., Sidebar.svelte:97-104)
- `app:toggleEditorMode` (catalog.ts:41, +page.svelte:223, Editor.svelte:170,190,228)
- `editor:jumpToLine` (+page.svelte:159, Editor.svelte:175)
- `outline:jumpToHeading` (Editor.svelte:232, OutlinePanel.svelte probablement)

Risque : un typo (`newFiles` au lieu de `newFile`) → event ignoré silencieusement, bug invisible aux tests.

### Solution

Créer `src/lib/events.ts` :

```ts
/**
 * Global event bus contract — names and payloads for every CustomEvent
 * dispatched via `window`. Use these constants on both sides
 * (dispatch + addEventListener) to prevent typo-driven silent failures.
 */

export const APP_EVENTS = {
    toggleEditorMode: 'app:toggleEditorMode',
    jumpToLine: 'editor:jumpToLine',
    jumpToHeading: 'outline:jumpToHeading',
    paletteAction: 'palette:action',
} as const;

export type PaletteAction = 'newFile' | 'newFolder' | 'importFile' | 'importPaths';

export type PaletteActionPayload = {
    action: PaletteAction;
    paths?: string[];
};

export type JumpToLinePayload = { lineNumber: number };
export type JumpToHeadingPayload = { line: number; index: number };

/** Helper for the palette → Sidebar bridge. */
export function dispatchPaletteAction(payload: PaletteActionPayload): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(APP_EVENTS.paletteAction, { detail: payload }));
}
```

Puis remplacer les usages dans :
- `src/lib/commands/catalog.ts` (4 dispatch + helpers)
- `src/lib/components/Sidebar.svelte` (1 listener)
- `src/lib/components/Editor.svelte` (3 listeners + 2 dispatch)
- `src/routes/+page.svelte` (1 listener + 1 dispatch)
- `src/lib/components/OutlinePanel.svelte` (1 dispatch, à vérifier)

### Tests

- Pas de nouveau test fonctionnel — les tests existants doivent continuer de passer.
- Optionnel : un test "events.ts exports tous les noms attendus" pour figer le contrat.

### Fichiers modifiés

- `src/lib/events.ts` (nouveau)
- 5 fichiers à mettre à jour pour importer depuis `events.ts`

---

## E — Supprimer `BehaviorSettings` côté Rust + legacy `Settings` — PLUS TARD

### Problème

**Côté TS** (`src/lib/tauri/types.ts:69-74`) : le commentaire documente que `BehaviorSettings` a été retiré le 2026-05-14 (devenu redondant après que `openFile` flushe inconditionnellement les saves pending).

**Côté Rust** (`src-tauri/src/models.rs:141-153`) : le struct `BehaviorSettings` existe encore + est inclus dans `UserSettings` (ligne 163). Forward-compat documentée mais c'est du code mort.

**Autre dette** (`src-tauri/src/models.rs:43-57` + `Config.settings` ligne 204) : la struct `Settings` legacy `{ autoSaveDelayMs, theme }` cohabite avec `UserSettings`. Documentée comme "kept for backwards compat" mais à retirer un jour.

### Solution

**Phase 1 — Retirer `BehaviorSettings` proprement** :
1. Vérifier qu'aucun consommateur frontend ne lit `settings.behavior` (grep `behavior` dans `src/`)
2. Retirer `BehaviorSettings` de `UserSettings` dans `models.rs`
3. Adapter le test `defaults_match_documented_schema` (`settings.rs:266-279`) qui assert `s.behavior.ask_before_closing_unsaved`
4. Adapter `save_then_load_round_trips` (`settings.rs:192-207`)
5. ⚠️ **Migration data** : les `settings.json` existants ont un champ `behavior` que serde va ignorer silencieusement (OK car retiré, mais à confirmer en lisant un fichier réel)

**Phase 2 — Retirer la legacy `Settings`** (plus risqué) :
1. Migrer ce qui dépend de `config.settings.theme` vers `settings.appearance.theme` (déjà fait côté UI ?)
2. Ajouter une migration code one-shot : si un `config.json` ancien contient `settings.theme`, le copier dans `settings.json` au boot
3. Retirer `Settings` struct + champ `Config.settings`
4. Adapter `default_config_serializes_to_expected_snapshot` (`models.rs:286-293`) et `save_writes_two_space_indented_json` (`config.rs:115-122`)

### Pourquoi "plus tard"

La Phase 2 surtout est touchy — config.json existants en prod (= sur le Mac de Matheo). À faire quand on aura une vraie raison de toucher au schema (autre breaking change qu'on regroupe).

**Phase 1 toute seule** est faisable en 30 min si tu veux la pousser maintenant.

### Fichiers modifiés

- `src-tauri/src/models.rs`
- `src-tauri/src/commands/settings.rs` (tests)
- `src-tauri/src/commands/config.rs` (tests si Phase 2)

---

## F — Décision finale sur routes `_blocknote-test` / `_visual`

### Problème

Deux routes préfixées `_` (= exclues du routing public SvelteKit) :

- `src/routes/_blocknote-test/+page.svelte` (502 lignes) — test rig de la migration C1 (BlockNote)
- `src/routes/_visual/+page.svelte` (483 lignes) — utilisée par les Playwright `tests/visual/*.spec.ts-snapshots`

**Hypothèse** :
- `_blocknote-test` → orphelin depuis la fin de C1 (mergé 2026-05-11). À supprimer probablement.
- `_visual` → encore utilisée (snapshots visuels Playwright). À garder + documenter.

### Solution

1. **Confirmer l'usage** :
   ```bash
   grep -rE "_blocknote-test|_visual" tests/ playwright.config.ts 2>/dev/null
   ```
   Si `_blocknote-test` n'apparaît nulle part → safe à supprimer.

2. **Si `_blocknote-test` est orphelin** : `rm -rf src/routes/_blocknote-test/` (avec ton OK).

3. **Pour `_visual`** : ajouter un commentaire en haut du fichier expliquant son rôle :
   ```svelte
   <!--
     Internal route — used only by Playwright visual snapshots
     (see tests/visual/*.spec.ts). Not reachable from the public
     routing. Do not delete without auditing the test suite first.
   -->
   ```

### Fichiers modifiés

- `src/routes/_blocknote-test/` (suppression conditionnelle)
- `src/routes/_visual/+page.svelte` (commentaire en tête)

---

## G — Macro `tauri_vault_op!` pour wrappers répétitifs — OPTIONNEL

### Problème

`src-tauri/src/commands/vaults.rs:270-350` : 6 wrappers Tauri suivent strictement le même pattern `load → mutate → save` :

```rust
#[tauri::command]
pub fn vault_xxx(app: AppHandle, /* args */) -> Result</* T */, String> {
    let cfg_path = config::resolve_config_path(&app)?;
    let mut cfg = config::load_config_from_path(&cfg_path)?;
    let result = xxx(&mut cfg, /* args */)?;
    config::save_config_to_path(&cfg_path, &cfg)?;
    Ok(result)
}
```

`src-tauri/src/commands/files.rs:412-519` : 13 wrappers font tous `let v = vault_for(&app, &vault_id)?; xxx(&v, ...)`.

### Solution

Macro déclarative Rust :

```rust
macro_rules! tauri_vault_mut_op {
    ($name:ident($app:ident, $($arg:ident: $ty:ty),*) -> $ret:ty { $body:expr }) => {
        #[tauri::command]
        pub fn $name($app: AppHandle, $($arg: $ty),*) -> Result<$ret, String> {
            let cfg_path = config::resolve_config_path(&$app)?;
            let mut cfg = config::load_config_from_path(&cfg_path)?;
            let result = { let cfg = &mut cfg; $body }?;
            config::save_config_to_path(&cfg_path, &cfg)?;
            Ok(result)
        }
    };
}
```

### Pourquoi optionnel

Lisibilité Rust vs. abstraction. Une macro est moins immédiate à lire qu'une fonction explicite. Si tu n'es pas à l'aise avec les macros Rust, **skip**. Le code répétitif fonctionne, est testé, et n'est pas un foyer de bugs.

---

## H — Refactor Sidebar : extraire `useDialogs` + flows en fonctions pures — PAS MAINTENANT

### Problème

`src/lib/components/Sidebar.svelte` fait 1110 lignes et concentre :
- File tree + vault list rendering
- 3 modals state (input rename, confirm delete, folder picker)
- 1 context menu (items différents file vs vault vs root)
- Drag-drop intra-vault (avec `findInsertionTarget`)
- Import dialog flow
- Palette bridge (`palette:action` listener)

Difficile à tester unitairement (tout est imbriqué dans le composant). Toute nouvelle action palette doit ajouter une branche dans le listener.

### Solution (sketch)

1. Extraire les 3 modals dans un `src/lib/stores/dialogs.svelte.ts` réactif (input / confirm / folder picker) — exposable depuis n'importe quel composant
2. Extraire les flows write en fonctions pures dans `src/lib/sidebar/file-ops.ts` : `createFile(vaultId, parentPath, name)`, `duplicateFile(vaultId, path)`, `moveFile(vaultId, source, targetParent)`, `deleteFile(vaultId, path)` — chacune retourne `Promise<Result>`, prend les toasts en injection
3. Sidebar.svelte devient un orchestrateur visuel qui appelle ces fonctions

### Pourquoi pas maintenant

- 1-2 jours de chantier (TDD + couverture)
- Coût > bénéfice tant que le composant ne casse pas
- Risque de régression non négligeable (beaucoup d'interactions UI)

**À ré-évaluer** quand : (a) on doit ajouter une 4ème modal, ou (b) deux composants doivent partager un de ces flows.

---

## I — Unifier les 2 paths d'écriture `theme` — PLUS TARD

### Problème

Le thème est écrit à **deux endroits** :

- `vaultsStore.setTheme()` → `config.json` / `settings.theme` (legacy)
- `settingsStore.setTheme()` → `settings.json` / `appearance.theme` (nouveau)

Migration partielle PLAN-SETTINGS. Documenté dans les commentaires mais pas refermé. Si l'un est modifié sans l'autre, drift garanti.

### Solution (sketch)

1. Décider : `settings.json/appearance.theme` est la **source de vérité**
2. Retirer `vaultsStore.setTheme()` et `Config.settings.theme` (couplé à item **E Phase 2**)
3. Migration code : au boot, si `config.json` contient encore `settings.theme` et `settings.json` n'a pas encore été créé, copier la valeur
4. Adapter `themeStore` pour lire/écrire uniquement depuis `settingsStore`

### Pourquoi "plus tard"

Couplé à E Phase 2. À grouper avec un autre breaking change schema pour limiter le nombre de migrations live.

---

## Notes finales

### Mettre à jour `WORKPLAN.md` ?

Ce plan n'est pas un "chantier" au sens des autres `PLAN-*.md` (pas de feature, pas de TDD strict avec gates). **Je n'ai pas modifié `WORKPLAN.md` sans ta validation.**

Si tu veux référencer ce plan dans `WORKPLAN.md`, je propose d'ajouter une ligne dans le tableau "Vue d'Ensemble" :

```markdown
| — | Sprint refactor (hygiène code review 2026-05-13) | P3 | À DÉROULER POST-TAMING | `PLAN-REFACTOR.md` |
```

À toi de me dire si tu veux que je l'ajoute (ou si tu préfères le faire toi-même).

### Conventions respectées dans ce plan

- ✅ Format `PLAN-*.md` à la racine (pas dans `plan-110526/` car non-archivé)
- ✅ Table de progression en tête (style `WORKPLAN.md`)
- ✅ Détail par item avec problème / solution / fichiers
- ✅ Pas de touche à `SPEC.md`, `TESTS.md`, `PLAN.md`, `WORKPLAN.md`
- ✅ Items E et I marqués "plus tard" car ils touchent à des migrations data (= live config.json sur le Mac de Matheo)
- ✅ TDD respecté (tests à valider après chaque item, pas de tests désactivés)

### Quand attaquer

Après le merge de Taming, en une session dédiée. Sprint quick-win (A+B+D+F) tient en 2h. Le reste est optionnel et peut être pris item par item au fil des sessions.
