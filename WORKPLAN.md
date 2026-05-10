# Markhub — Plan de Développement

> Document maître de pilotage des chantiers en cours.
> À lire en début de chaque session Claude Code.
> Ordre d'exécution strict : un chantier à la fois, terminé avant le suivant.

---

## Statut Global

**Date de mise à jour** : 2026-05-10

**Chantier en cours** : 1 (Migration éditeur Crepe → BlockNote)

**Bloqueurs MVP shippable** : 3 chantiers ci-dessous

---

## Vue d'Ensemble des Chantiers

| Ordre | Chantier | Priorité | État | Branche |
|-------|----------|----------|------|---------|
| 1 | Migration éditeur Crepe → BlockNote | P0 | À démarrer | `feat/blocknote-migration` |
| 2 | Système de Toast / Notifications | P1 | En attente C1 | `feat/toast-system` |
| 3 | Smoke test + fix Drag-drop sidebar | P1 | En attente C1 | `fix/sidebar-dnd` |

**Règles permanentes** (à respecter dans tous les chantiers) :
- TDD strict : tests RED avant code GREEN
- Un chantier à la fois, pas de parallélisation
- Format récap fin d'étape (voir §Format communication)
- Commits par étape, pas de push (Matheo gère ça)
- Honnêteté : "tests verts ≠ feature marche". Smoke test obligatoire.
- Aucun test désactivé pour faire passer un build
- Si un bug résiste 15 min : skip + journal + continuer
- Pas de scope creep : si tu identifies un autre problème, BACKLOG.md, pas dans cette session

---

## CHANTIER 1 — Migration éditeur Crepe → BlockNote

### Contexte

Le drag-reorder, le transform menu, le scroll de menu, et le picker langage code de Crepe sont fragiles ou cassés. On a accumulé des patches custom (pointer events, override CSS). En tirant le fil, on a constaté que **toutes les apps de référence (Notion, Linear, Outline, Craft) utilisent ProseMirror nu ou un éditeur propriétaire**, parce qu'aucune lib clé-en-main ne donne le polish attendu.

**Décision actée par Matheo le 2026-05-10** : on remplace Crepe par **BlockNote**.

Justification :
- BlockNote est conçu **spécifiquement pour des éditeurs Notion-like**
- Drag-and-drop block, transform menu, slash menu, indicateur visuel : **natifs**
- Markdown export/import natif (notre format de stockage `.md` reste inchangé)
- Customisation prévue par design (variables CSS, classes claires)
- C'est la lib la plus alignée avec l'expérience utilisateur cible

Risques connus :
- Pas de wrapper Svelte officiel (uniquement React) → on utilisera l'API core vanilla
- Lib relativement récente → écosystème plus petit que Tiptap
- Refactor important sur `Editor.svelte` (composant central)

### Mission

Remplacer Crepe par BlockNote, en gardant **tout le reste de l'app intact** (sidebar, status bar, vaults, toasts à venir, etc.). Préserver l'API publique du composant `Editor.svelte` autant que possible.

### Branche

```bash
git checkout -b feat/blocknote-migration
```

### Étapes

#### Étape 1 — Audit préalable et installation

**Objectif** : valider techniquement BlockNote dans l'environnement Markhub avant tout refactor.

- [ ] Lire la doc officielle BlockNote (https://www.blocknotejs.org/)
- [ ] Vérifier la compatibilité avec l'API "core" vanilla (sans React)
- [ ] Identifier les imports nécessaires (`@blocknote/core`, peut-être `@blocknote/code-block` si applicable)
- [ ] Vérifier la stratégie markdown : `blockToMarkdown` / `markdownToBlocks` natifs
- [ ] Installer le package et ses peer deps
- [ ] Vérifier que l'install ne casse pas le build : `npm run build`
- [ ] Documenter dans `MIGRATION-NOTES.md` (à la racine, à supprimer en fin de chantier) :
  - Les imports à utiliser
  - Les API clés (création editor, `onChange`, sérialisation markdown)
  - Les classes CSS principales à override
  - Tout point d'attention

**Validation étape 1** :
- [ ] Package installé, build OK
- [ ] `MIGRATION-NOTES.md` créé avec les notes d'investigation
- [ ] Récap envoyé à Matheo

⏸ **Attendre OK Matheo avant étape 2.**

#### Étape 2 — Hello world isolé sur route DEV

**Objectif** : prouver que BlockNote fonctionne dans Markhub avec round-trip markdown propre, sans toucher à l'app principale.

- [ ] Créer la route `src/routes/_blocknote-test/+page.svelte` (route temporaire, à supprimer en fin de chantier)
- [ ] Monter une instance BlockNote minimale avec un fichier markdown chargé en dur (un fichier test représentatif : headings, listes, tables, code, frontmatter)
- [ ] Implémenter le round-trip : load markdown → édition → export markdown → comparer
- [ ] Tester manuellement les features clés natives :
  - Drag-and-drop d'un block (le ⋮⋮ doit fonctionner nativement)
  - Slash menu (taper `/`)
  - Transform menu (clic sur ⋮⋮ ou équivalent BlockNote)
  - Toolbar flottante au survol de sélection
  - Tables avec resize colonnes
  - Code block avec coloration et picker langage
- [ ] Documenter chaque feature : ✅ marche / ⚠️ partiel / ❌ absent
- [ ] Si une feature critique manque ou est bancale → STOP et remonter à Matheo avant de continuer

**Validation étape 2** :
- [ ] Round-trip markdown OK sur 3 fichiers tests (un avec frontmatter, un avec table, un avec code)
- [ ] Drag-drop natif visible et fonctionnel en réel
- [ ] Slash menu fonctionnel en réel
- [ ] Smoke test Matheo OK sur la route `/_blocknote-test`
- [ ] Screenshots des features clés en fonctionnement
- [ ] Récap envoyé à Matheo

⏸ **Attendre OK Matheo avant étape 3.**

#### Étape 3 — Customisation visuelle (alignement design.md)

**Objectif** : matcher l'identité Markhub (Warp-inspired) sur l'éditeur BlockNote, en dark + light mode.

- [ ] Inventorier toutes les variables CSS exposées par BlockNote (classes, custom properties)
- [ ] Mapper sur les tokens existants de `design.md` :
  - Couleurs : `--color-bg`, `--color-bg-raised`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent`, etc.
  - Typo : `--font-sans`, `--font-mono`, échelle de tailles IDE-density (26/21/18/16/14)
  - Espacements et radius
- [ ] Appliquer les overrides dans `app.css` (ou un fichier dédié `editor-blocknote.css` à importer)
- [ ] **Pas de `!important` partout.** Si la cascade pose problème, bumper la spécificité proprement (technique du double-class déjà utilisée pour Crepe)
- [ ] Vérifier light + dark sur la route DEV
- [ ] Test Playwright visual : régénérer baselines pour `_blocknote-test` en dark + light
- [ ] Vérifier les éléments suivants :
  - Headings (h1-h6) à la bonne taille et bonne typo
  - Frontmatter rendu propre (si applicable, voir étape 4)
  - Slash menu avec fond `--color-bg-raised`, items hover `--color-surface-hover`
  - Toolbar flottante cohérente (radius, ombre, fond)
  - Drag handle (⋮⋮) visible mais discret (opacity progressive, comme on avait fait pour Crepe)
  - Drop indicator : ligne fine 2px couleur d'accent
  - Code blocks avec fond raised
  - Task lists checkboxes avec accent

**Validation étape 3** :
- [ ] Screenshots dark + light cohérents avec sidebar/status bar Markhub
- [ ] Tests visual verts avec nouvelles baselines
- [ ] Pas de `!important` excessif (ou justifié)
- [ ] Smoke test Matheo OK

⏸ **Attendre OK Matheo avant étape 4.**

#### Étape 4 — Intégration dans Editor.svelte

**Objectif** : remplacer Crepe par BlockNote dans le composant principal, sans casser le reste de l'app.

- [ ] Lire l'API actuelle de `Editor.svelte` (props, événements)
- [ ] Préserver l'API publique :
  - Props : `content`, `mode`, `readonly`
  - Events : changement de contenu pour autosave debounced
- [ ] Adapter le frontmatter handling :
  - Vérifier si BlockNote gère le frontmatter ou si on garde notre `splitFrontmatter` / `joinFrontmatter` en pré-traitement
  - Si pré-traitement : BlockNote ne voit que le body, le frontmatter reste rendu via notre `<details>` natif au-dessus
- [ ] Adapter la sauvegarde auto debounced 1500ms (logique existante dans le store, l'éditeur émet juste des changes)
- [ ] Adapter le toggle Preview/Source si applicable (BlockNote a-t-il un mode source ? sinon : on garde uniquement WYSIWYG)
- [ ] Garder la même structure DOM autour (header, container 1280px full-width, status bar pills inchangée)
- [ ] Supprimer toutes les références à `@milkdown/crepe` dans `Editor.svelte`

**Validation étape 4** :
- [ ] Ouvrir un fichier de l'app principale fonctionne
- [ ] Édition + sauvegarde auto fonctionnent (vérifier sur disque que le fichier est bien écrit)
- [ ] Frontmatter rendu correctement (si présent)
- [ ] Light/dark mode fonctionne
- [ ] Drag-drop, slash menu, transform menu tous fonctionnels en réel
- [ ] Smoke test Matheo sur 5 fichiers réels (un avec frontmatter, un avec tables, un avec code, un long, un court)
- [ ] Aucune régression visible sur sidebar/status bar/menus contextuels

⏸ **Attendre OK Matheo avant étape 5.**

#### Étape 5 — Tests, nettoyage, suppression dette Crepe

**Objectif** : tout vert, tout propre, dette Crepe à zéro.

- [ ] Adapter ou retirer les tests Vitest qui dépendaient de Crepe spécifiquement (mocks Crepe etc.)
- [ ] Régénérer les baselines Playwright pour les vues de l'éditeur dans l'app (pas seulement la route DEV)
- [ ] Tests visuels couvrant :
  - Éditeur en dark mode avec contenu riche
  - Éditeur en light mode avec contenu riche
  - Slash menu ouvert
  - Transform menu ouvert
  - Drag en cours avec drop indicator visible
  - Frontmatter replié + déplié
- [ ] Supprimer la route DEV `_blocknote-test` (et son dossier)
- [ ] Supprimer `@milkdown/crepe` du `package.json`
- [ ] `npm install` pour valider que la suppression ne casse rien
- [ ] Supprimer tous les overrides CSS Crepe-specific dans `app.css` (recherche `.milkdown` et nettoyer)
- [ ] Supprimer le code custom drag-reorder pointer events (devenu obsolète)
- [ ] Supprimer le code custom transform menu (devenu obsolète)
- [ ] Supprimer `MIGRATION-NOTES.md`
- [ ] Mettre à jour `BACKLOG.md` :
  - Retirer "block manipulation" (résolu nativement)
  - Retirer "resize colonnes tableaux" (résolu nativement, à confirmer)
  - Retirer "scroll menu transformation" (résolu)
- [ ] Mettre à jour `JOURNAL.md` avec entrée détaillée de la migration
- [ ] Mettre à jour `STATE.md`

**Validation étape 5** :
- [ ] `cargo test` : tout vert
- [ ] `npm run test` : tout vert
- [ ] `npm run check` : 0 erreur, 0 warning
- [ ] `npm run build` : OK
- [ ] `npm run test:visual` : tout vert avec baselines régénérées
- [ ] Plus aucune référence à Crepe dans le code (`grep -r "milkdown\|crepe" src/`)
- [ ] Smoke test Matheo final sur l'app complète :
  - Drag-drop block
  - Transform menu
  - Slash menu
  - Light/dark mode toggle
  - Persistence onglet à la réouverture
  - Sauvegarde sur disque
  - Frontmatter
  - Tables (création + resize si dispo)
  - Code blocks
  - Task lists

⏸ **Attendre OK Matheo final.**

#### Étape 6 — Commit final et clôture

- [ ] Commit final propre : `feat(editor): migrate from Milkdown Crepe to BlockNote`
- [ ] Tag de cohérence : `git log --oneline | head -10` envoyé à Matheo
- [ ] Mise à jour de WORKPLAN.md : marquer chantier 1 ✅
- [ ] Récap final envoyé à Matheo

**Le merge sur `main` sera fait manuellement par Matheo, pas par Claude Code.**

### Critères de succès Chantier 1

- [ ] L'éditeur fonctionne avec BlockNote en réel (smoke testé)
- [ ] Drag-drop block natif et fluide avec drop indicator
- [ ] Transform menu natif et complet (scrollable si débordement)
- [ ] Picker de langage code fonctionnel (plus de bug visuel)
- [ ] Tables avec resize si supporté
- [ ] Light + dark mode cohérents avec le reste de l'app
- [ ] Aucun reste Crepe dans le code
- [ ] Tous les tests verts
- [ ] Pas de régression sur le reste de l'app

---

## CHANTIER 2 — Système de Toast / Notifications

### Contexte

Quand un fichier est sauvegardé, supprimé, dupliqué, copié dans le presse-papier, déplacé, il n'y a aucun feedback visuel autre que le statut sauvegarde discret en status bar. Plusieurs actions importantes sont silencieuses, ce qui crée une dette UX (l'utilisateur ne sait pas si l'action a réussi).

**Décision actée** : implémenter un système de toast léger, cohérent avec design.md.

### Mission

Créer un système de toast accessible globalement dans l'app, et l'intégrer aux actions importantes existantes.

### Branche

```bash
git checkout -b feat/toast-system
```

### Spécifications fonctionnelles

#### Comportement visuel

- **Position** : bas-droite de la fenêtre, au-dessus de la status bar (z-index gérant l'ordre)
- **Largeur** : max 360px, hauteur adaptable
- **Animation entrée** : slide-in depuis la droite + fade-in (200-250ms)
- **Animation sortie** : fade-out (150ms)
- **Auto-dismiss** : 3 secondes par défaut (configurable)
- **Dismiss manuel** : croix à droite, click pour fermer immédiatement
- **Empilement** : plusieurs toasts en file verticale avec gap 8px, plus récent en bas

#### Types de toasts

| Type | Icône Lucide | Accent |
|------|--------------|--------|
| `success` | `Check` | Vert (à définir dans design.md, sinon vert tempéré) |
| `info` | `Info` | Bleu doux |
| `warning` | `AlertTriangle` | Orange |
| `error` | `AlertCircle` | Rouge atténué |

#### Structure visuelle

```
┌──────────────────────────────────────────┐
│ [icône]  [message court]            [×] │
│          [détails optionnels]            │
└──────────────────────────────────────────┘
```

- **Fond** : `--color-bg-raised`
- **Border** : `--color-border`
- **Border-radius** : `--radius-md`
- **Shadow** : subtile, cohérente avec popovers existants
- **Typo** : sans-serif design.md

#### API

Store global accessible depuis n'importe quel composant :

```typescript
import { toast } from '$lib/stores/toast.svelte';

toast.success('Fichier sauvegardé');
toast.success('Chemin copié', { details: '/Users/lkid/Projects/markhub/SPEC.md' });
toast.error('Suppression échouée', { details: err.message });
toast.info('Vault déplacé');
toast.warning('Conflit de nom', { duration: 5000 });
```

Options :
- `details?: string` — sous-titre optionnel en plus petit
- `duration?: number` — durée avant auto-dismiss en ms (défaut 3000)
- `dismissible?: boolean` — afficher la croix (défaut true)

### Intégration dans les actions existantes

**À toaster** :

| Action | Type | Message |
|--------|------|---------|
| Création fichier | `success` | "Fichier créé" |
| Création dossier | `success` | "Dossier créé" |
| Suppression fichier | `success` | "Fichier supprimé" |
| Suppression dossier | `success` | "Dossier supprimé (X fichiers)" |
| Duplication fichier | `success` | "Fichier dupliqué" |
| Déplacement fichier | `success` | "Déplacé vers [dossier]" |
| Copie chemin | `success` | "Chemin copié" |
| Erreur Tauri (read/write/delete) | `error` | Message lisible + détails |
| Vault retiré | `info` | "Vault retiré" |
| Vault renommé | `success` | "Vault renommé" |
| Toggle mode readonly | `info` | "Mode lecture seule activé/désactivé" |
| Conflit de nom au rename | `warning` | "Un fichier avec ce nom existe déjà" |

**À NE PAS toaster** :
- Auto-save successful (déjà visible en status bar via "Sauvegardé")
- Frappe utilisateur normale
- Sélection de fichier dans la sidebar
- Toggle theme (déjà visible immédiatement)

### Étapes

#### Étape 1 — Store et composants (TDD strict)

- [ ] Créer `src/lib/stores/toast.svelte.ts` :
  - State `toasts: Toast[]`
  - Méthodes `success`, `info`, `warning`, `error`
  - Auto-dismiss via setTimeout
  - Méthode `dismiss(id)` pour retirer manuellement
- [ ] Tests unit (`tests/unit/toast.test.ts`) :
  - Ajout d'un toast
  - Auto-dismiss après duration
  - Dismiss manuel
  - Plusieurs toasts en file
  - Options personnalisées
  - Types success/info/warning/error
- [ ] Créer `src/lib/components/Toast.svelte` (toast individuel) :
  - Props : `toast: Toast`
  - Animations CSS
  - Click croix → emit dismiss
- [ ] Créer `src/lib/components/ToastContainer.svelte` :
  - Lit le store, render tous les toasts
  - Position absolue bottom-right
  - Gestion du stacking
- [ ] Tests component (`tests/component/Toast.test.svelte.ts`) :
  - Rendu de chaque type
  - Click croix
  - Affichage details

**Validation étape 1** :
- [ ] Tests verts
- [ ] svelte-check 0/0
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 2.**

#### Étape 2 — Intégration globale

- [ ] Monter `<ToastContainer />` dans `+layout.svelte`
- [ ] Ajouter les appels `toast.*` dans les handlers existants (cf. tableau ci-dessus) :
  - `Sidebar.svelte` (création, suppression, duplication, déplacement, copie chemin, vault actions)
  - `Editor.svelte` (erreurs Tauri en lecture/écriture)
  - Tout autre handler concerné

**Validation étape 2** :
- [ ] Smoke test Matheo : créer un fichier → toast, supprimer → toast, copier chemin → toast
- [ ] Plusieurs actions rapides → toasts s'empilent correctement
- [ ] Auto-dismiss après 3s observable
- [ ] Dismiss manuel via croix fonctionne
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 3.**

#### Étape 3 — Tests visuels et clôture

- [ ] Test Playwright visual : un toast `success` affiché → screenshot dark + light
- [ ] Test Playwright visual : 3 toasts empilés → screenshot
- [ ] Tests verts avec baselines
- [ ] Mise à jour `JOURNAL.md`
- [ ] Mise à jour `BACKLOG.md` : retirer item "système de toast"
- [ ] Mise à jour `STATE.md`
- [ ] Commit final : `feat(ui): add global toast notification system`
- [ ] Mise à jour de WORKPLAN.md : marquer chantier 2 ✅

**Validation étape 3** :
- [ ] cargo + vitest + visual + check + build : tout vert
- [ ] Smoke test final Matheo
- [ ] Récap final

### Critères de succès Chantier 2

- [ ] Système de toast fonctionnel et accessible globalement
- [ ] Toutes les actions importantes ont leur feedback
- [ ] Pas de toast inutile (auto-save, frappe, etc.)
- [ ] Cohérence visuelle dark + light avec design.md
- [ ] Tous les tests verts

---

## CHANTIER 3 — Smoke test + fix Drag-drop sidebar

### Contexte

Le drag-drop fichier → dossier dans la sidebar a été implémenté en HTML5 native pendant la session autonome soirée du 9 mai, **sans test automatique** (Claude Code l'avait skippé volontairement, jugeant Playwright dispatch fragile pour HTML5 drag).

Vu que le drag-drop block dans l'éditeur Crepe en HTML5 native ne marchait pas en réel non plus (il a fallu réécrire en pointer events), il y a forte présomption que le drag-drop sidebar souffre du même mal.

**Matheo a confirmé** : "the drag and drop in the left column doesn't work at all."

### Mission

1. Confirmer le diagnostic (smoke test rigoureux)
2. Ré-implémenter en pointer events (cohérent avec ce qui marche dans l'éditeur après chantier 1)
3. Ajouter un indicateur visuel propre
4. Ajouter des tests automatiques

### Branche

```bash
git checkout -b fix/sidebar-dnd
```

### Étapes

#### Étape 1 — Diagnostic et reproduction

- [ ] Lancer `npm run tauri dev`
- [ ] Tester chaque cas et documenter dans `JOURNAL.md` :
  - Drag d'un fichier .md vers un dossier ouvert : déplacement effectif ?
  - Drag vers un dossier replié : déplacement effectif ? Auto-expand du dossier ?
  - Drag vers la racine du vault : déplacement effectif ?
  - Drag vers un dossier d'un autre vault : refusé (hors scope confirmé) ?
  - Drag vers le fichier lui-même ou son dossier parent : pas d'erreur ?
  - Drag vers un dossier readonly : refusé visuellement ?
- [ ] Pour chaque cas : noter ce qui se passe en réel
- [ ] Si quoi que ce soit ne fonctionne pas → confirmer l'hypothèse "HTML5 drag cassé en environnement Tauri"

**Validation étape 1** :
- [ ] Diagnostic exhaustif documenté
- [ ] Hypothèse confirmée ou infirmée

⏸ **Attendre OK Matheo avant étape 2.**

#### Étape 2 — Ré-implémentation en pointer events

(Si étape 1 confirme que le drag est cassé)

- [ ] Réutiliser la même architecture que le drag-reorder de blocks dans l'éditeur (post-chantier 1) :
  - `pointerdown` sur l'élément draggable (toute la row du fichier dans la sidebar)
  - `setPointerCapture` sur la fenêtre
  - `pointermove` avec seuil 4px → commit drag
  - `pointerup` → drop ou click selon distance
- [ ] Indicateur visuel pendant le drag :
  - Source : opacity 0.4-0.5
  - Curseur : `grabbing`
  - Drop target : highlight (background `--color-surface-hover` ou similaire) + ligne fine 2px couleur d'accent en haut/bas selon position
- [ ] Au drop :
  - Appel `fileRename` (déjà existant) pour déplacer
  - Auto-expand du dossier de destination
  - Si fichier ouvert dans un onglet : suivre le déplacement (chemin mis à jour)
- [ ] Toast après drop : "Déplacé vers [dossier]" (intégration avec chantier 2 si fait)
- [ ] Cas limites :
  - Drop sur soi-même : pas d'erreur, pas d'action
  - Drop hors zone valide : drag annulé proprement
  - Drop sur un readonly : toast warning "Vault en lecture seule"

**Validation étape 2** :
- [ ] Drag fonctionne en réel
- [ ] Indicateur visuel propre
- [ ] Cas limites gérés
- [ ] Smoke test Matheo

⏸ **Attendre OK Matheo avant étape 3.**

#### Étape 3 — Tests automatiques

- [ ] Test Playwright qui valide le déplacement réel :
  - Setup : 2 fichiers `.md` dans un vault, 1 dossier
  - Action : pointer down sur fichier A, pointer move vers dossier, pointer up
  - Vérification : fichier A est maintenant dans le dossier (DOM mis à jour, contenu sur disque mis à jour)
- [ ] Test Playwright qui valide le visual feedback (drop target highlighted)
- [ ] Test Playwright qui valide le rejet sur readonly vault

**Validation étape 3** :
- [ ] cargo + vitest + visual + check + build : tout vert
- [ ] Tests Playwright nouveaux verts
- [ ] Smoke test final Matheo

#### Étape 4 — Clôture

- [ ] Mise à jour `JOURNAL.md`
- [ ] Mise à jour `STATE.md`
- [ ] Commit final : `fix(sidebar): replace HTML5 drag with pointer events for reliable file moves`
- [ ] Mise à jour de WORKPLAN.md : marquer chantier 3 ✅

### Critères de succès Chantier 3

- [ ] Drag-drop sidebar fonctionne en réel
- [ ] Indicateur visuel propre (source faded, target highlighted)
- [ ] Test automatique en place (plus jamais de "pas testé donc on ne sait pas")
- [ ] Pas de régression
- [ ] Toast (si chantier 2 fait) après drop

---

## Format Communication (à respecter par Claude Code)

### Récap fin d'étape

Chaque fin d'étape, envoyer un récap structuré :

```
═══════════════════════════════════════════════════
✅ CHANTIER X — ÉTAPE Y TERMINÉE
═══════════════════════════════════════════════════

CE QUI A ÉTÉ FAIT
- [point 1]
- [point 2]

TESTS
- cargo : X/X
- vitest : X/X
- visual : X/X
- svelte-check : 0/0
- build : OK

FICHIERS MODIFIÉS
- [path 1]
- [path 2]

DÉCISIONS PRISES (en autonomie)
- [décision 1] : [justification courte]

BUGS / BLOCAGES
- [aucun] ou [liste]

PROCHAINE ÉTAPE
Étape Y+1 : [titre court]

⏸ J'attends ton OK pour démarrer.
```

### Récap fin de chantier

```
═══════════════════════════════════════════════════
🏁 CHANTIER X TERMINÉ
═══════════════════════════════════════════════════

COMMITS : [liste hashs]

CRITÈRES DE SUCCÈS
- [✅/❌] [critère 1]
- [✅/❌] [critère 2]

CE QUI EST LIVRÉ
[description fonctionnelle de l'amélioration utilisateur]

POINTS D'ATTENTION POUR MATHEO
- [point 1]
- [point 2]

DETTES TECHNIQUES IDENTIFIÉES (envoyées au backlog)
- [item 1]
- [item 2]

⏸ Smoke test final demandé. Si OK, je passe au chantier suivant.
```

---

## Notes globales

### Skills à explorer en début de session

Avant d'attaquer un chantier, lire les skills pertinents dans `~/Ressources/Skills/` :
- Skills SvelteKit
- Skills Tauri
- Skills TDD
- Skill Kodyo design system

### Fichiers maîtres à la racine

- `CLAUDE.md` — instructions générales pour Claude Code
- `SPEC.md` — spec fonctionnelle de Markhub
- `PLAN.md` — plan global du projet (par phases)
- `TESTS.md` — catalogue des tests
- `JOURNAL.md` — journal de session (append-only, jamais réécrit)
- `STATE.md` — état actuel du projet (peut être réécrit à chaque clôture)
- `BACKLOG.md` — items hors-scope MVP
- `design.md` — référence visuelle (Warp-inspired)
- `WORKPLAN.md` — **CE FICHIER** (plan de développement actif)

### Décisions actées

- Identité produit : agrégateur multi-vault de markdowns dev (pas un PKM)
- Esthétique : Warp-inspired (IDE/terminal)
- Cmd+W comme seul raccourci clavier custom (universel)
- Phase 7 wiki-links/extract-to-note : tuée définitivement
- BlockNote remplace Crepe (chantier 1 ci-dessus)

### Backlog post-MVP (cf. BACKLOG.md)

- Onglets de fichiers (Phase 5c)
- Outline panel (jamais cadré)
- E2E real-binary avec WebdriverIO + tauri-driver
- Settings panel utilisateur
- Recherche full-text cross-vaults
- Drag-drop entre vaults différents
- Smooth caret animation

---

## Mode d'emploi pour Matheo

En début de session Claude Code, écrire simplement :

```
Lis WORKPLAN.md et attaque le chantier en cours.
```

Ou pour un chantier spécifique :

```
Lis WORKPLAN.md et démarre le chantier 2 (système de toast).
```

Claude Code doit alors :
1. Lire WORKPLAN.md intégralement
2. Identifier le chantier en cours (premier non-✅ dans le tableau)
3. Lire la spec détaillée
4. Suivre les étapes une par une avec récaps
5. Attendre OK entre chaque étape
6. Mettre à jour WORKPLAN.md en fin de chantier
