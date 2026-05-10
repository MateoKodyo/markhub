# PLAN BLOCKNOTE — NON NÉGOCIABLE

> Objectif unique : intégrer complètement BlockNote dans Markhub, en remplacement de Crepe.
> À lire en début de chaque session Claude Code.
> **Aucune dérive autorisée.** Aucun "petit truc en passant". Aucune autre feature.
>
> **RÉVISION 2026-05-10 (fin journée)** : la bascule de Editor.svelte se fait MAINTENANT, AVANT les composants UI restants. Voir §"Stratégie révisée" ci-dessous.

---

## CONTEXTE — POURQUOI CE PLAN EXISTE

Le 10 mai 2026, Matheo a passé une journée à comprendre où en était la migration BlockNote. Constat : Claude Code livrait du code BlockNote sur une route de test `/_blocknote-test` sans expliquer clairement que l'app principale tournait toujours sur Crepe. Quiproquo de plusieurs heures.

**Cause racine** : communication insuffisante de Claude Code après chaque livraison.

**Ce plan corrige ça** : règle non négociable de communication, smoke test interactif obligatoire à chaque étape avec URL exacte fournie.

---

## STRATÉGIE RÉVISÉE (2026-05-10)

### Pourquoi la révision

Le plan initial prévoyait :
```
2.5.a Slash → 2.5.b Toolbar → 2.5.c SideMenu → 2.5.d Tables → 2.5.e Links → 3 Polish → 4 BASCULE → 5 Cleanup
```

Avec ce plan, l'app principale restait sur Crepe pendant 5 étapes de plus, ce qui devient psychologiquement insoutenable et empêche tout test en conditions réelles.

### Stratégie révisée

```
2.5.a ✅ → 2.5.b ✅ → 4 BASCULE (anticipée) → 2.5.c → 2.5.d → 2.5.e → 3 Polish → 5 Cleanup
```

**On bascule Editor.svelte sur BlockNote MAINTENANT**, avec les 2 composants UI déjà livrés (slash menu + formatting toolbar). Les composants restants (drag handle, tables, link toolbar) seront écrits **directement dans l'app principale** après la bascule.

### Ce que ça implique

**Pendant la phase intermédiaire (entre la bascule et la fin des composants UI)** :
- L'app principale utilise BlockNote
- Le slash menu fonctionne (taper `/`)
- La formatting toolbar fonctionne (sélection de texte)
- Le drag-drop natif BlockNote devrait fonctionner (à vérifier au smoke test)
- Les transformations via clic ⋮⋮ ne sont pas encore custom (slash menu reste accessible)
- Tables : drag natif fonctionnel mais pas de boutons custom + et resize
- Liens : créés via `prompt()` dans la formatting toolbar, pas de toolbar dédiée

**C'est temporairement dégradé**, mais l'app fonctionne et on peut la tester en conditions réelles.

### Avantages de la révision

1. **Test en conditions réelles immédiat** : on voit BlockNote fonctionner sur les vrais fichiers, pas sur une fixture
2. **Détection précoce d'un blocker** : si BlockNote a un problème de fond sur un fichier réel, on le découvre maintenant, pas dans 4 étapes
3. **Réduction de la fatigue cognitive** : les livraisons suivantes sont visibles dans l'app principale
4. **Validation continue** : chaque composant UI ajouté améliore l'expérience, on sent les progrès

### Risques acceptés

- L'app est temporairement moins fonctionnelle qu'avec Crepe complet
- Si on doit rollback, c'est plus visible (mais toujours techniquement possible : Crepe reste installé jusqu'à l'étape 5)

---

## OBJECTIF UNIQUE

Remplacer Crepe par BlockNote dans `Editor.svelte`, avec les composants UI Svelte requis, le polish visuel, et le nettoyage Crepe complet.

**Aucun autre chantier ne démarre tant que celui-ci n'est pas terminé.**

Liste explicite des chantiers SUSPENDUS jusqu'à fin de migration :
- Système de toast
- Drag-drop sidebar
- Onglets de fichiers
- Empty state
- Sommaire / outline
- Tout autre polish ou nouvelle feature

---

## RÈGLES NON NÉGOCIABLES

### Règle 1 — Branche dédiée
Toute la migration vit sur la branche `feat/blocknote-migration`. Pas de merge sur main avant validation finale Matheo.

### Règle 2 — Une étape à la fois
Une seule étape démarre à la fois. Pas de parallélisation. Pas de "j'ai aussi fait X en passant".

### Règle 3 — Communication obligatoire à chaque livraison

À chaque fin d'étape, le récap DOIT inclure :

```
═══════════════════════════════════════════════════
✅ ÉTAPE X TERMINÉE
═══════════════════════════════════════════════════

CE QUI A ÉTÉ FAIT
[liste]

TESTS AUTOMATIQUES
[résultats]

⚠️ COMMENT MATHEO TESTE ÇA EN RÉEL ⚠️

URL EXACTE :
http://localhost:[PORT]/[route]

PROCÉDURE DE TEST :
1. [action 1]
2. [action 2]
3. [résultat attendu]

CE QUI EST VISIBLE POUR L'UTILISATEUR DANS L'APP PRINCIPALE :
[soit "rien encore" — soit "feature X visible"]

FICHIERS MODIFIÉS
[liste]

DÉCISIONS PRISES
[liste]

⏸ J'ATTENDS TON SMOKE TEST + VALIDATION AVANT D'ENCHAÎNER.
```

**Si ce récap est incomplet, Matheo redemande l'info. Pas d'enchaînement.**

### Règle 4 — Smoke test interactif obligatoire
Aucune étape n'est validée sans que Matheo ait testé en réel et confirmé. Tests automatiques verts seuls = pas suffisant.

### Règle 5 — Pas de bricolage
Si une feature BlockNote ne fonctionne pas comme attendu, **STOP** et remontée à Matheo. Aucun patch custom par-dessus, aucun workaround, aucun "je vais coder ça à la main".

### Règle 6 — Honnêteté brutale
Si à un moment Claude Code voit qu'une étape va dépasser ce qui était prévu, ou qu'il découvre un blocker, **il le dit immédiatement** sans enrobage. Pas de "j'avance, ça progresse" creux.

### Règle 7 — Pas de dette ajoutée pendant la migration
Aucun nouveau patch CSS Crepe. Aucune nouvelle feature Crepe. Crepe est en mode maintenance zéro pendant toute la durée de la migration.

---

## TABLEAU DE PROGRESSION — FINAL (migration ✅ 2026-05-11)

| Étape | Statut | Commit | Smoke utilisateur |
|-------|--------|--------|-------------------|
| 1. Install BlockNote core | ✅ | `abccc90` | ✅ |
| 2. Round-trip markdown | ✅ | `64f6482` | ✅ |
| 2.5.a Slash menu Svelte | ✅ | `9256f57` | ⏸ couvert par bundle smoke clôture |
| 2.5.b Formatting toolbar Svelte | ✅ | `c8587d7` | ⏸ couvert par bundle smoke clôture |
| 4. BASCULE Editor.svelte (anticipée) | ✅ | `902bf82` | ⏸ couvert par bundle smoke clôture |
| 2.5.c Side menu (drag handle + transform) | ✅ | `31193c6` | ✅ drag confirmé OK post-fix Tauri |
| Tauri drag-drop fix (hors plan) | ✅ | `21ac2ee` | ✅ validé explicitement ("OK ! bravo") |
| 2.5.d Table handles + fix drag preview | ✅ | `a250096` | ⏸ couvert par bundle smoke clôture |
| 2.5.e Link toolbar | ✅ | `be13afa` | ⏸ couvert par bundle smoke clôture |
| 3. Polish CSS Markhub | ✅ | `7ae23e7` | ⏸ couvert par bundle smoke clôture |
| 5. Cleanup Crepe | ✅ | `e52536a` | — (purge package + code mort) |
| **6. Clôture** | **✅** | (ce commit) | ⏸ bundle smoke à valider au merge |

Total : 12 commits sur la branche `feat/blocknote-migration`. Merge manuel par Matheo.

---

## ÉTAPE 4 — BASCULE Editor.svelte (PROCHAINE ÉTAPE — PRIORITÉ ABSOLUE)

**Objectif** : remplacer Crepe par BlockNote dans `Editor.svelte`. Après cette étape, **l'app principale utilise BlockNote**.

### Mission

Modifier `src/lib/components/Editor.svelte` :

1. **Retirer l'import** `@milkdown/crepe` (mais ne PAS désinstaller le package — cleanup à l'étape 5)
2. **Importer** :
   - `BlockNoteEditor` depuis `@blocknote/core`
   - Les CSS BlockNote nécessaires
   - Les 2 composants UI Svelte déjà créés :
     - `BlockNoteSlashMenu.svelte`
     - `BlockNoteFormattingToolbar.svelte`
3. **Préserver l'API publique** :
   - Props : `content`, `mode`, `readonly`
   - Événement de change pour autosave debounced
4. **Adapter le frontmatter handling** :
   - Continuer à utiliser `splitFrontmatter` / `joinFrontmatter` en pré/post-traitement
   - BlockNote ne voit que le body markdown, pas le frontmatter YAML
   - Le `<details>` Svelte natif au-dessus de l'éditeur reste inchangé
5. **Adapter la sauvegarde** :
   - Subscribe à BlockNote `editor.onChange`
   - Convertir blocks → markdown via `blocksToMarkdownLossy()`
   - Append le frontmatter via `joinFrontmatter` avant écriture disque
   - Maintenir le debounce 1500ms (logique store inchangée)
6. **Initialisation** :
   - Au mount : `tryParseMarkdownToBlocks(body)` pour charger le contenu
   - Au changement de fichier : recréer l'éditeur ou reset le contenu
7. **Mode Preview/Source** :
   - BlockNote n'a pas de "mode source" natif
   - **Décision** : on garde uniquement WYSIWYG en MVP. Le toggle Preview/Source du header est masqué temporairement (pas supprimé). Backlog post-MVP : "Mode source markdown brut"
8. **Garder la structure DOM** :
   - Header full-width avec breadcrumb path
   - Container max-width centré (1280px ou ce qui était en place)
   - Pas de modification de la status bar pills

### Wiring des composants UI

Réutiliser exactement le pattern existant dans `_blocknote-test/+page.svelte` :

```typescript
// Slash menu
const slashStore = editor.getExtension('suggestionMenu').store;
slashStore.subscribe(({ currentVal }) => {
  // bind currentVal au prop menuState de BlockNoteSlashMenu
});

// Formatting toolbar
const ftStore = editor.getExtension('formattingToolbar').store;
ftStore.subscribe(({ currentVal }) => {
  // bind currentVal + selection rect au prop visible/referencePos
});
```

### Composants BlockNote restants : rendu natif par défaut

Pour cette étape, **les composants UI restants ne sont pas écrits**. BlockNote tombe en rendu par défaut pour :

- **SideMenu (drag handle ⋮⋮)** : pas de handle visible custom, mais le drag-and-drop des blocks DOIT fonctionner nativement via le DOM ProseMirror (comportement out-of-the-box BlockNote)
- **TableHandles** : pas de boutons custom + et resize, mais BlockNote gère le drag natif des rows/cols
- **LinkToolbar** : pas de toolbar custom. Le `prompt()` du formatting toolbar (déjà ajouté à 2.5.b) suffit pour créer un lien

C'est **volontairement dégradé**. Les étapes 2.5.c/d/e qui suivent vont restaurer ces composants.

### Critères de validation — Tests automatiques

- [ ] cargo test : tout vert
- [ ] vitest : tout vert (tests Crepe-spécifiques peuvent être adaptés ou skip pour l'instant, à documenter)
- [ ] svelte-check : 0 erreur, 0 warning
- [ ] build : OK
- [ ] visual Playwright : baselines régénérées si rendu visuel change

### Critères de validation — Smoke test critique Matheo

**URL** : `http://localhost:1420/` (l'app principale, PAS la route de test)

**Procédure de test exhaustive** :

1. Lancer `npm run tauri dev`
2. Cliquer sur un fichier `.md` dans la sidebar
3. **Ouverture du fichier** :
   - Le contenu s'affiche dans BlockNote (visible : nouveau rendu, plus celui de Crepe)
   - Frontmatter `<details>` rendu correctement au-dessus
4. **Édition de base** :
   - Taper du texte → s'affiche en temps réel
   - Statut "Modifié" puis "Sauvegardé" 1.5s après
5. **Sauvegarde sur disque** :
   - Modifier un fichier
   - Attendre l'autosave
   - Ouvrir le fichier dans Finder ou un autre éditeur → contenu mis à jour
6. **Slash menu** :
   - Taper `/` → menu apparaît
   - Filtrer en tapant des lettres → items filtrés
   - Sélectionner Heading 1 → block transformé en H1
7. **Formatting toolbar** :
   - Sélectionner du texte → toolbar apparaît au-dessus
   - Click bold, italic, strikethrough, inline code, lien → fonctionnent
8. **Drag-and-drop des blocks (NATIF)** :
   - Tenter de drag un block (cliquer-maintenir sur le bord du block, drag vers le haut/bas)
   - Vérifier : drop indicator visible, block déplacé après drop
   - **Note** : pas de handle ⋮⋮ visible à cette étape (étape 2.5.c). Le drag fonctionne via la zone du block elle-même
9. **Frontmatter round-trip** :
   - Ouvrir un fichier avec frontmatter
   - Modifier le contenu (pas le frontmatter)
   - Sauvegarder
   - Rouvrir → frontmatter intact, contenu modifié
10. **Light/dark mode** :
    - Toggle theme via status bar
    - L'éditeur change de thème (peut être imparfait visuellement à cette étape, polish complet à l'étape 3)
11. **Persistence** :
    - Fermer l'app
    - Relancer
    - Le dernier fichier ouvert se rouvre avec son contenu

### Bugs ACCEPTÉS à cette étape (à fixer dans 2.5.c/d/e/3)

- ⚠️ Pas de drag handle ⋮⋮ visible (à restaurer en 2.5.c)
- ⚠️ Pas de transform menu au clic ⋮⋮ (slash menu via `/` accessible en attendant)
- ⚠️ Pas de toolbar custom sur les liens (`prompt()` suffit pour MVP transitoire)
- ⚠️ Tables : pas de boutons `+` row/col custom, drag natif fonctionnel
- ⚠️ Polish CSS imparfait : couleurs, typo peuvent ne pas matcher exactement design.md (étape 3)

### Bugs INTERDITS à cette étape

- ❌ Fichier ne s'ouvre pas
- ❌ Sauvegarde ne fonctionne pas (perte de données)
- ❌ Frontmatter perdu au round-trip
- ❌ Crash de l'app
- ❌ Régression sidebar / status bar / vaults
- ❌ Drag-and-drop des blocks complètement impossible (drag natif BlockNote doit au minimum permettre de déplacer un block)

Si l'un de ces bugs apparaît : **STOP**, remontée immédiate à Matheo, rollback possible (Crepe encore installé).

### Commit attendu

`feat(editor): replace Crepe with BlockNote in main app`

### Documentation à mettre à jour

- `MIGRATION-NOTES.md` : section sur la bascule, décisions prises, bugs acceptés temporairement
- `JOURNAL.md` : entrée détaillée de la bascule

---

## ÉTAPE 2.5.c — SideMenu (drag handle ⋮⋮ + transform menu)

**Objectif** : restaurer le drag handle visible et le transform menu au clic, **directement dans l'app principale** (puisque BlockNote y tourne déjà après l'étape 4).

### Mission

- Créer `src/lib/components/BlockNoteSideMenu.svelte`
- Consommer le `SideMenu` extension de BlockNote via `editor.getExtension('sideMenu').store.subscribe`
- Rendu : ⋮⋮ + bouton `+` à gauche du block au hover
- Drag : géré nativement par BlockNote (pas de pointer events custom)
- Drop indicator : géré par le `DropCursor` plugin de BlockNote
- Click sur ⋮⋮ : ouvre un menu de transformation (Heading 1, 2, 3, Texte, Liste, Quote, Code block)
- Wiring dans `Editor.svelte`

### Critères de validation

- [ ] Tests vitest : montage, rendu ⋮⋮ et `+`, click ouvre menu
- [ ] Test E2E Playwright dans l'app principale
- [ ] **Smoke test Matheo dans l'APP PRINCIPALE** :
  - Ouvrir un fichier
  - Hover sur un block → ⋮⋮ et `+` apparaissent à gauche
  - Drag d'un block vers le haut/bas via le ⋮⋮ : ligne d'insertion bleue visible en temps réel
  - Drop : block déplacé instantanément à la position du drop
  - Drag fluide en un seul mouvement (pas en deux temps)
  - Click sur ⋮⋮ : menu de transformation s'ouvre
  - Click sur un item du menu : block transformé

### Commit attendu

`feat(blocknote-ui): side menu with native drag and transform menu`

---

## ÉTAPE 2.5.d — TableHandles

**Objectif** : restaurer les contrôles des tableaux dans l'app principale.

### Mission

- Créer `src/lib/components/BlockNoteTableHandles.svelte`
- Consommer le `TableHandles` extension de BlockNote
- Rendu : poignées de drag aux extrémités des rows/cols, boutons `+` pour ajouter
- Wiring dans `Editor.svelte`

### Critères de validation

- [ ] Tests vitest
- [ ] Smoke test Matheo dans l'APP PRINCIPALE :
  - Créer une table via slash menu (`/table`)
  - Hover sur une cellule → handles visibles
  - Resize de colonne via drag : fonctionne
  - Bouton `+` row ajoute une ligne
  - Bouton `+` col ajoute une colonne
  - Drag d'une row pour la réordonner : fonctionne avec drop indicator

### Commit attendu

`feat(blocknote-ui): table handles svelte`

---

## ÉTAPE 2.5.e — LinkToolbar

**Objectif** : restaurer une toolbar dédiée pour l'édition de liens dans l'app principale.

### Mission

- Créer `src/lib/components/BlockNoteLinkToolbar.svelte`
- Consommer le `LinkToolbar` extension de BlockNote
- Rendu : popup au-dessus du lien avec champ URL éditable + boutons "Ouvrir" / "Supprimer"
- Wiring dans `Editor.svelte`

### Critères de validation

- [ ] Tests vitest
- [ ] Smoke test Matheo dans l'APP PRINCIPALE :
  - Créer un lien via la formatting toolbar
  - Cliquer sur le lien → toolbar apparaît
  - Modifier l'URL → changement appliqué
  - Bouton "Ouvrir" → ouvre le lien
  - Bouton "Supprimer" → retire le lien

### Commit attendu

`feat(blocknote-ui): link toolbar svelte`

---

## ÉTAPE 3 — Polish CSS Markhub design.md

**Objectif** : appliquer le design system Markhub à tous les composants BlockNote dans l'app principale.

### Mission

- Inventorier toutes les variables CSS et classes exposées par BlockNote
- Mapper sur les tokens de `design.md`
- Appliquer les overrides dans `src/styles/editor-blocknote.css` (ou `app.css`)
- Pas de `!important` partout. Spécificité bumping propre si nécessaire.
- Vérifier light + dark mode sur tous les composants

### Éléments à styler

- Headings (h1-h6) : tailles IDE-density, font sans-serif, no italic
- Slash menu : fond `--color-bg-raised`, items hover `--color-surface-hover`
- Formatting toolbar : radius, fond raised, ombre subtile
- Drag handle (⋮⋮) : opacity 0.4 par défaut, 1 au hover, transition 0.15s
- Drop indicator : ligne fine 2px couleur `--color-accent`
- Code blocks : fond raised, langage picker propre
- Tables : borders, headers, hover states
- Task list checkboxes : couleurs accent quand cochées

### Critères de validation

- [ ] Test visual Playwright : régénérer baselines en dark + light
- [ ] Smoke test Matheo : navigation dans l'app, test chaque feature visuelle, dark + light
- [ ] Cohérence visuelle avec sidebar/status bar

### Commit attendu

`feat(blocknote): apply Markhub design system to editor`

---

## ÉTAPE 5 — Cleanup Crepe

**Objectif** : supprimer toute trace de Crepe du projet.

### Mission

- Désinstaller `@milkdown/crepe` du `package.json`
- `npm install`
- Supprimer tous les overrides CSS Crepe-specific dans `app.css`
- Supprimer le code custom du drag-reorder pointer events
- Supprimer le code custom du transform menu
- Supprimer la route `/_blocknote-test`
- Supprimer `MIGRATION-NOTES.md`
- Adapter les tests Vitest qui mockaient Crepe
- Régénérer les baselines Playwright
- Mettre à jour `BACKLOG.md`, `JOURNAL.md`, `STATE.md`

### Critères de validation

- [ ] `grep -r "milkdown\|crepe" src/` ne retourne plus rien
- [ ] `cargo test` : tout vert
- [ ] `npm run test` : tout vert
- [ ] `npm run check` : 0 erreur, 0 warning
- [ ] `npm run build` : OK
- [ ] `npm run test:visual` : tout vert avec baselines régénérées
- [ ] Smoke test Matheo final

### Commit attendu

`chore(editor): remove Crepe dependency and cleanup overrides`

---

## ÉTAPE 6 — Clôture

- [ ] Récap final structuré envoyé à Matheo
- [ ] `PLAN-BLOCKNOTE.md` mis à jour : migration ✅
- [ ] Liste des sessions, commits, hashes
- [ ] Validation Matheo finale
- [ ] **Le merge sur `main` est fait manuellement par Matheo, pas par Claude Code.**

---

## QUESTIONS ANTICIPÉES

### "Et si la bascule à l'étape 4 révèle un bug fatal ?"

STOP. Récap honnête à Matheo. Décision conjointe : continuer en patchant (mauvais signal mais possible), ou rollback (Crepe encore installé).

### "Et si Matheo veut ajouter une feature pendant la migration ?"

Refus poli. "On finit la migration d'abord. Cette feature est notée dans BACKLOG.md."

### "Et si Claude Code découvre un bug Crepe en route ?"

Note dans `JOURNAL.md`, pas de patch. Crepe est mort à partir de l'étape 4.

---

## MODE D'EMPLOI POUR MATHEO

### En début de session Claude Code

Écrire :
```
Lis PLAN-BLOCKNOTE.md et continue à l'étape suivante.
```

Claude Code doit :
1. Lire ce fichier intégralement
2. Identifier l'étape en cours (premier non-✅ dans le tableau)
3. Suivre la spec à la lettre
4. Respecter les règles non négociables
5. Envoyer le récap au format obligatoire en fin d'étape

### Après chaque récap

1. Lire le récap
2. Vérifier que le format est respecté (URL de test, procédure, ce qui est visible)
3. Faire le smoke test en réel selon la procédure
4. Si ça marche : valider, passer à l'étape suivante
5. Si ça ne marche pas : remonter, corriger, ne pas avancer
6. Marquer l'étape ✅ dans le tableau de progression

---

## PROMPT DE DÉMARRAGE POUR CLAUDE CODE

À coller au prochain démarrage :

```
Tu reprends la migration BlockNote.

Lis PLAN-BLOCKNOTE.md à la racine du projet AVANT toute action. Ce plan a été RÉVISÉ : la bascule de Editor.svelte (étape 4) se fait MAINTENANT, avant les composants UI restants (2.5.c/d/e).

Règles principales :
- Une étape à la fois, pas de parallélisation, pas de "petit truc en passant"
- Récap obligatoire en fin d'étape avec URL exacte de test, procédure, ce qui est visible dans l'app principale
- Smoke test interactif Matheo obligatoire avant de passer à l'étape suivante
- Si bug découvert : STOP et remontée, pas de bricolage
- Aucun autre chantier (toast, sommaire, sidebar, empty state) pendant la migration

Étapes ✅ déjà faites : 1, 2, 2.5.a, 2.5.b.

Prochaine étape : ÉTAPE 4 — BASCULE Editor.svelte.

Suis la spec ÉTAPE 4 du plan à la lettre. Au début, confirme que tu as lu le plan et donne-moi ton plan d'attaque pour l'étape 4. Attends mon GO avant de coder.
```

---

## SI ON DOIT ARRÊTER

Si à un moment Matheo décide d'arrêter la migration, le rollback est :

1. `git checkout main`
2. La branche `feat/blocknote-migration` est conservée (pas supprimée)
3. Décision documentée dans `JOURNAL.md`

Mais ce plan est conçu pour aller jusqu'au bout. L'arrêt est l'exception, pas la sortie de secours.
