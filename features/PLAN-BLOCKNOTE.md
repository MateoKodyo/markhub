# PLAN BLOCKNOTE — NON NÉGOCIABLE

> Objectif unique : intégrer complètement BlockNote dans Markhub, en remplacement de Crepe.
> À lire en début de chaque session Claude Code.
> **Aucune dérive autorisée.** Aucun "petit truc en passant". Aucune autre feature.

---

## CONTEXTE — POURQUOI CE PLAN EXISTE

Le 10 mai 2026, Matheo a passé une journée complète à essayer de comprendre où en était la migration BlockNote. Le constat : Claude Code avait livré du code BlockNote sur une route de test (`/_blocknote-test`) **sans jamais l'expliquer clairement**, et Matheo testait dans l'app principale qui tourne encore sur Crepe. Quiproquo sur des heures.

**Cause racine** : Claude Code a oublié de communiquer où tester en réel après chaque livraison. Tests verts ≠ feature visible pour l'utilisateur.

**Ce plan corrige ça** : règle non négociable de communication ajoutée. Smoke test interactif obligatoire à chaque étape, avec URL exacte fournie. Aucun "fait" sans validation Matheo.

---

## OBJECTIF UNIQUE

Remplacer Crepe par BlockNote dans `Editor.svelte`, avec les 5 composants UI Svelte requis, le polish visuel, et le nettoyage Crepe complet.

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
✅ ÉTAPE X.Y TERMINÉE
═══════════════════════════════════════════════════

CE QUI A ÉTÉ FAIT
[liste]

TESTS AUTOMATIQUES
[résultats]

⚠️ COMMENT MATHEO TESTE ÇA EN RÉEL ⚠️

URL EXACTE :
http://localhost:[PORT]/_blocknote-test
(ou route principale si étape 4+ atteinte)

PROCÉDURE DE TEST :
1. [action 1]
2. [action 2]
3. [résultat attendu]

CE QUI EST VISIBLE POUR L'UTILISATEUR DANS L'APP PRINCIPALE :
[soit "rien encore, BlockNote pas encore branché dans Editor.svelte" — soit "feature X visible"]

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
Aucun nouveau patch CSS Crepe. Aucune nouvelle feature Crepe. Crepe est en mode maintenance zéro pendant toute la durée de la migration. Bugs Crepe découverts en cours = noter dans `JOURNAL.md`, pas patcher.

---

## PLAN DES ÉTAPES

### État actuel (au 10 mai 2026, fin de journée)

✅ Étape 1 — Install BlockNote (commit `abccc90`)
✅ Étape 2 — Round-trip markdown validé (commit `64f6482`)
✅ Étape 2.5.a — Slash menu Svelte (commit `9256f57`)

**À faire** : 2.5.b → 2.5.c → 2.5.d → 2.5.e → 3 → 4 → 5 → clôture.

---

### Étape 2.5.b — FormattingToolbar

**Objectif** : composant Svelte qui rend la toolbar flottante quand l'utilisateur sélectionne du texte.

**Mission** :
- Créer `src/lib/components/BlockNoteFormattingToolbar.svelte`
- Consommer le `FormattingToolbar` extension de BlockNote via `editor.getExtension('formattingToolbar').store.subscribe`
- Rendu : toolbar avec boutons B, I, strikethrough, inline code, link
- Position : flottante au-dessus de la sélection (utiliser le `referencePos` exposé par le store)
- Apparaît uniquement quand sélection de texte non-vide
- Disparaît au clic ailleurs ou au reset de sélection

**Critères de validation** :
- [ ] Tests vitest : montage, rendu boutons, click bouton applique la marque
- [ ] Test E2E Playwright : sélectionner du texte → toolbar apparaît → click bold → texte devient bold
- [ ] Smoke test Matheo sur `/_blocknote-test` :
  - Sélectionner du texte → toolbar apparaît
  - Click bold → texte devient bold (visible immédiatement)
  - Click italic → texte devient italic
  - Click strikethrough, inline code, link → comportement attendu
  - Toolbar disparaît au clic ailleurs

**Style** : minimal, cohérent design.md de base. PAS de polish poussé.

**Commit attendu** : `feat(blocknote-ui): formatting toolbar svelte`

---

### Étape 2.5.c — SideMenu (drag handle ⋮⋮ + transform menu)

**Objectif** : composant Svelte qui rend le ⋮⋮ à gauche de chaque block, avec :
- Drag-and-drop natif pour réorganiser les blocks
- Click sur ⋮⋮ ouvre un menu de transformation

**Mission** :
- Créer `src/lib/components/BlockNoteSideMenu.svelte`
- Consommer le `SideMenu` extension de BlockNote
- Rendu : ⋮⋮ + bouton `+` à gauche du block au hover
- Drag : géré nativement par BlockNote (pas de pointer events custom à coder)
- Drop indicator : géré nativement par le `DropCursor` plugin de BlockNote (rendu CSS uniquement)
- Click sur ⋮⋮ : ouvre un menu de transformation (Heading 1, 2, 3, Texte, Liste, Quote, Code block)

**Critères de validation** :
- [ ] Tests vitest : montage, rendu ⋮⋮ et `+`, click ouvre menu
- [ ] Test E2E Playwright : drag d'un block → block déplacé dans le DOM, drop indicator visible pendant le drag
- [ ] Smoke test Matheo sur `/_blocknote-test` :
  - Hover sur un block → ⋮⋮ et `+` apparaissent à gauche
  - **Drag d'un block vers le haut** : ligne d'insertion bleue visible en temps réel pendant le drag
  - **Drop** : le block est déplacé instantanément à la position du drop
  - **Drag fluide en un seul mouvement** (pas en deux temps)
  - Click sur ⋮⋮ : menu de transformation s'ouvre
  - Click sur un item du menu : block transformé

**🚨 CETTE ÉTAPE EST CRITIQUE.** Le drag-drop est le bug n°1 de Markhub depuis 3 jours. Si BlockNote ne donne pas un drag fluide nativement à cette étape, **STOP IMMÉDIAT** et remontée à Matheo. C'est le test ultime de la valeur de BlockNote.

**Style** : minimal cohérent design.md.

**Commit attendu** : `feat(blocknote-ui): side menu with native drag and transform menu`

---

### Étape 2.5.d — TableHandles

**Objectif** : composant Svelte qui rend les contrôles des tableaux (resize colonnes, add row/col, drag pour réordonner rows/cols).

**Mission** :
- Créer `src/lib/components/BlockNoteTableHandles.svelte`
- Consommer le `TableHandles` extension de BlockNote
- Rendu : poignées de drag aux extrémités des rows/cols, boutons `+` pour ajouter
- Toute la logique (resize, drag, add/remove) est gérée par le plugin BlockNote

**Critères de validation** :
- [ ] Tests vitest : montage, rendu handles, callbacks
- [ ] Test E2E Playwright : créer table → resize colonne → ajouter row
- [ ] Smoke test Matheo sur `/_blocknote-test` :
  - Créer une table via slash menu (`/table`)
  - Hover sur une cellule → handles visibles
  - Resize de colonne via drag : fonctionne, largeur change en temps réel
  - Bouton `+` row ajoute une ligne
  - Bouton `+` col ajoute une colonne
  - Drag d'une row pour la réordonner : fonctionne avec drop indicator

**Style** : minimal cohérent design.md.

**Commit attendu** : `feat(blocknote-ui): table handles svelte`

---

### Étape 2.5.e — LinkToolbar

**Objectif** : composant Svelte qui rend une toolbar quand le curseur est sur un lien (édition URL, ouverture, suppression).

**Mission** :
- Créer `src/lib/components/BlockNoteLinkToolbar.svelte`
- Consommer le `LinkToolbar` extension de BlockNote
- Rendu : popup au-dessus du lien avec champ URL éditable + boutons "Ouvrir" / "Supprimer"

**Critères de validation** :
- [ ] Tests vitest
- [ ] Test E2E Playwright
- [ ] Smoke test Matheo sur `/_blocknote-test` :
  - Créer un lien via la formatting toolbar
  - Cliquer sur le lien → toolbar apparaît
  - Modifier l'URL : changement appliqué
  - Bouton "Ouvrir" : ouvre le lien
  - Bouton "Supprimer" : retire le lien

**Style** : minimal cohérent design.md.

**Commit attendu** : `feat(blocknote-ui): link toolbar svelte`

---

### Étape 3 — Polish CSS Markhub complet

**Objectif** : appliquer le design system Markhub (design.md) à tous les composants BlockNote.

**Mission** :
- Inventorier toutes les variables CSS et classes exposées par BlockNote
- Mapper sur les tokens de `design.md` :
  - Couleurs : `--color-bg`, `--color-bg-raised`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`
  - Typo : `--font-sans`, `--font-mono`, échelle IDE-density (26/21/18/16/14)
  - Espacements et radius
- Appliquer les overrides dans un fichier dédié `src/styles/editor-blocknote.css` (ou dans `app.css`)
- **Pas de `!important` partout.** Spécificité bumping propre si nécessaire.
- Vérifier light + dark mode sur tous les composants 2.5.a → 2.5.e

**Éléments à styler** :
- Headings (h1-h6) : tailles IDE-density, font sans-serif, no italic
- Slash menu : fond `--color-bg-raised`, items hover `--color-surface-hover`, séparateurs cohérents
- Formatting toolbar : radius, fond raised, ombre subtile
- Drag handle (⋮⋮) : opacity 0.4 par défaut, 1 au hover, transition 0.15s
- Drop indicator : ligne fine 2px couleur `--color-accent`
- Code blocks : fond raised, langage picker propre
- Tables : borders, headers, hover states
- Task list checkboxes : couleurs accent quand cochées
- Frontmatter (rendu hors BlockNote, déjà OK avec Crepe) : reconfirmer compatibilité

**Critères de validation** :
- [ ] Test visual Playwright : régénérer baselines route `_blocknote-test` en dark + light
- [ ] Smoke test Matheo : navigue dans `/_blocknote-test`, teste chaque feature visuelle, dark + light
- [ ] Cohérence visuelle avec sidebar/status bar de l'app principale (côte à côte mental)

**Commit attendu** : `feat(blocknote): apply Markhub design system to editor`

---

### Étape 4 — Intégration dans Editor.svelte (LE BIG SWITCH)

**Objectif** : remplacer Crepe par BlockNote dans `Editor.svelte`. Après cette étape, l'app principale utilise BlockNote.

**Mission** :
- Modifier `src/lib/components/Editor.svelte` :
  - Retirer l'import `@milkdown/crepe`
  - Importer BlockNote core + les 5 composants UI Svelte créés
  - Préserver l'API publique : props `content`, `mode`, `readonly`, événement de change
  - Adapter le frontmatter handling (preserve `splitFrontmatter` / `joinFrontmatter`)
  - Adapter l'autosave debounced 1500ms (la logique du store reste identique, seul l'éditeur change)
  - Préserver le toggle Preview/Source si possible (sinon : on garde uniquement WYSIWYG, à arbitrer avec Matheo si question se pose)
  - Conserver la structure DOM autour (header, container width, status bar pills inchangée)
- Vérifier que les fichiers se chargent et se sauvegardent correctement

**Critères de validation** :
- [ ] Cliquer sur un fichier dans la sidebar → ouvre dans BlockNote (visible : nouveau rendu)
- [ ] Édition fonctionne, save sur disque vérifié
- [ ] Frontmatter rendu correctement
- [ ] Light/dark mode fonctionne
- [ ] **Drag-drop block dans l'app principale : fluide, en un seul mouvement, avec drop indicator**
- [ ] Slash menu fonctionne dans l'app principale
- [ ] Formatting toolbar fonctionne dans l'app principale
- [ ] Tables avec resize fonctionnent
- [ ] Code blocks avec coloration et langage picker fonctionnent
- [ ] Smoke test Matheo intensif sur 5 fichiers réels :
  - Un fichier avec frontmatter + headings + listes
  - Un fichier avec table + code blocks + task list
  - Un fichier court avec liens + emphases
  - Un fichier long (1000+ mots)
  - Un nouveau fichier vide créé via la sidebar

**Commit attendu** : `feat(editor): replace Crepe with BlockNote`

---

### Étape 5 — Cleanup Crepe

**Objectif** : supprimer toute trace de Crepe du projet.

**Mission** :
- Désinstaller `@milkdown/crepe` du `package.json`
- `npm install` pour propager
- Supprimer tous les overrides CSS Crepe-specific dans `app.css` (chercher `.milkdown`, `.crepe`, `.bn-`)
- Supprimer le code custom du drag-reorder pointer events (devenu obsolète)
- Supprimer le code custom du transform menu (devenu obsolète)
- Supprimer la route `/_blocknote-test` (sa raison d'être disparaît une fois l'intégration faite)
- Supprimer `MIGRATION-NOTES.md`
- Adapter les tests Vitest qui mockaient Crepe (les retirer ou les remplacer)
- Régénérer les baselines Playwright pour les vues de l'éditeur dans l'app
- Mettre à jour `BACKLOG.md` :
  - Retirer "block manipulation" (résolu)
  - Retirer "resize colonnes tableaux" (résolu)
  - Retirer "scroll menu transformation" (résolu)
- Mettre à jour `JOURNAL.md`
- Mettre à jour `STATE.md`

**Critères de validation** :
- [ ] `grep -r "milkdown\|crepe" src/` ne retourne plus rien
- [ ] `cargo test` : tout vert
- [ ] `npm run test` : tout vert
- [ ] `npm run check` : 0 erreur, 0 warning
- [ ] `npm run build` : OK
- [ ] `npm run test:visual` : tout vert avec baselines régénérées
- [ ] Smoke test Matheo final : tout marche, rien régressé

**Commit attendu** : `chore(editor): remove Crepe dependency and cleanup overrides`

---

### Étape 6 — Clôture

- [ ] Récap final structuré envoyé à Matheo
- [ ] `WORKPLAN.md` mis à jour : migration ✅
- [ ] Liste des sessions, commits, hashes
- [ ] Validation Matheo finale
- [ ] **Le merge sur `main` est fait manuellement par Matheo, pas par Claude Code.**

---

## QUESTIONS ANTICIPÉES

### "Et si BlockNote a un bug à l'étape X ?"

**STOP IMMÉDIAT.** Récap honnête à Matheo avec le problème exact, pas de bricolage. Décision conjointe.

### "Et si le drag-drop à 2.5.c n'est pas fluide en réel ?"

C'est la condition critique de la migration. Si BlockNote ne livre pas un drag fluide nativement, **on doit le savoir là**. Décision conjointe sur :
- Continuer en patchant (mauvais signal mais possible)
- Stopper la migration et revenir à Crepe (acceptable)
- Tester d'autres options (Tiptap, etc. — décision lourde)

### "Et si Matheo veut ajouter une feature pendant la migration ?"

**Refus poli.** "On finit la migration d'abord. Cette feature est notée dans BACKLOG.md, on l'attaquera après."

### "Et si Claude Code découvre un bug Crepe en route ?"

Notes dans `JOURNAL.md`, pas de patch. Crepe est mort à partir de l'étape 4. Inutile d'investir dans son entretien.

### "Combien de sessions Claude Code estimées ?"

- Étapes 2.5.b à 2.5.e : 4 sessions (1 par composant)
- Étape 3 (polish CSS) : 1 session
- Étape 4 (intégration) : 1 session, possiblement 2 si surprises
- Étape 5 (cleanup) : 1 session
- Total : **7 à 9 sessions Claude Code**

---

## MODE D'EMPLOI POUR MATHEO

### En début de session Claude Code

Écrire :
```
Lis PLAN-BLOCKNOTE.md et continue à l'étape suivante.
```

Claude Code doit :
1. Lire ce fichier intégralement
2. Identifier l'étape en cours (premier non-✅)
3. Suivre la spec à la lettre
4. Respecter les règles non négociables
5. Envoyer le récap au format obligatoire en fin d'étape

### Après chaque récap

1. Lire le récap
2. Vérifier que le format est respecté (URL de test, procédure, ce qui est visible dans l'app principale)
3. Faire le smoke test en réel selon la procédure indiquée
4. Si ça marche : valider, passer à l'étape suivante
5. Si ça ne marche pas : remonter, corriger, ne pas avancer
6. Marquer l'étape ✅ dans le tableau de progression ci-dessous

### Tableau de progression

| Étape | Statut | Commit | Validation Matheo |
|-------|--------|--------|-------------------|
| 1. Install | ✅ | `abccc90` | ✅ |
| 2. Round-trip markdown | ✅ | `64f6482` | ✅ |
| 2.5.a Slash menu | ✅ | `9256f57` | ⏸ à smoke-tester |
| 2.5.b Formatting toolbar | ⏳ À faire | — | — |
| 2.5.c Side menu (drag + transform) | ⏳ | — | — |
| 2.5.d Table handles | ⏳ | — | — |
| 2.5.e Link toolbar | ⏳ | — | — |
| 3. Polish CSS | ⏳ | — | — |
| 4. Intégration Editor.svelte | ⏳ | — | — |
| 5. Cleanup Crepe | ⏳ | — | — |
| 6. Clôture | ⏳ | — | — |

---

## PROMPT DE DÉMARRAGE POUR CLAUDE CODE

À coller au prochain démarrage :

```
Tu reprends la migration BlockNote.

Lis PLAN-BLOCKNOTE.md à la racine du projet AVANT toute action. Ce plan est non négociable.

Règles principales :
- Une étape à la fois, pas de parallélisation, pas de "petit truc en passant"
- Récap obligatoire en fin d'étape avec URL exacte de test, procédure, ce qui est visible dans l'app principale
- Smoke test interactif Matheo obligatoire avant de passer à l'étape suivante
- Si bug découvert : STOP et remontée, pas de bricolage
- Aucun autre chantier (toast, sommaire, sidebar, empty state) pendant la migration

État actuel : étape 2.5.a terminée (slash menu Svelte sur /_blocknote-test). Prochaine étape : 2.5.b FormattingToolbar.

Commence par confirmer que tu as lu le plan, donne-moi ton plan d'attaque pour l'étape 2.5.b, attends mon GO avant de coder.
```

---

## SI ON DOIT ARRÊTER

Si à un moment Matheo décide d'arrêter la migration, le rollback est :

1. `git checkout main`
2. La branche `feat/blocknote-migration` est conservée (pas supprimée)
3. Décision documentée dans `JOURNAL.md`

Mais ce plan est conçu pour aller jusqu'au bout. L'arrêt est l'exception, pas la sortie de secours.
