# FEATURE — Panneau Sommaire (Outline)

> Spec détaillée pour la feature Sommaire de Markhub.
> À démarrer après le chantier 1 (migration BlockNote).
> Branche dédiée : `feat/outline-panel`

---

## Statut

**Priorité** : P2 (post chantiers 1-3)
**État** : Spec validée, en attente de démarrage
**Dépendance** : Chantier 1 (migration BlockNote) doit être terminé avant, car la détection des headings se fera via l'API blocks de BlockNote.

---

## Contexte

Pour les fichiers longs avec beaucoup de sections (specs, journaux, briefs, CLAUDE.md de chaque vault), naviguer dans le document est pénible — il faut scroller manuellement. Toutes les apps de référence (Notion, GitBook, Linear, Outline) proposent une vue chemin de fer / sommaire des headings, cliquable.

**Décision actée par Matheo le 2026-05-10** : panneau slide-in à droite, déclenché par une icône dans la barre d'outils éditeur. Pas un chemin de fer permanent à la Notion.

Justification du choix :
- Plus discret en mode normal (l'utilisateur l'ouvre seulement quand il en a besoin)
- Cohérent avec le pattern Markhub (chrome IDE, content lecture)
- Permet une largeur de panneau confortable (260px) sans encombrer en permanence

---

## Mission

Créer un panneau Sommaire qui :
- S'ouvre/ferme via une icône dans la barre d'outils éditeur (à droite des contrôles de style)
- Affiche les headings H1-H3 du document actif, cliquables
- Indique le heading actuellement visible dans le viewport
- Permet de scroller à un heading via click avec smooth scroll
- Pousse l'éditeur quand ouvert (l'éditeur rétrécit, pas de recouvrement)
- Persiste son état ouvert/fermé entre sessions

---

## Spécifications

### Position et déclenchement

- **Icône** : Lucide `List`, dans la barre d'outils éditeur
- **Emplacement** : à droite des contrôles de style (B / I / `<>` / H1 H2 H3 / lien), légèrement détachée par un séparateur visuel (gap supplémentaire ou divider 1px) pour signifier qu'il s'agit d'une action UI distincte des styles
- **Action** : click toggle ouvre/ferme le panneau
- **Animation** : slide-in depuis la droite + fade-in, 200-250ms ease-out
- **État actif de l'icône** : quand le panneau est ouvert, l'icône a un fond `--color-surface-active`, cohérent avec un bouton toggle en état activé
- **Tooltip** : "Sommaire" (au hover, après 500ms)

### Layout du panneau

- **Largeur** : 260px fixe (pas redimensionnable en MVP, à reconsidérer post-MVP si retours utilisateur)
- **Position** : pousse l'éditeur vers la gauche (l'éditeur rétrécit), ne recouvre pas le contenu
- **Bordure gauche** : 1px solid `--color-border`
- **Background** : `--color-bg` (cohérent avec le canvas, pas comme la sidebar plus sombre)
- **Sticky top** : le panneau scroll indépendamment de l'éditeur si très long
- **Padding interne** : 16px top, 0 horizontal (les items prennent 100% width avec padding propre)

### Contenu du panneau

Structure visuelle :

```
┌─────────────────────────────────┐
│ SOMMAIRE                        │  ← label uppercase tracked
├─────────────────────────────────┤
│ Heading H1                      │
│   Heading H2                    │
│     Heading H3                  │
│   Heading H2                    │
│ Heading H1                      │
│ ...                             │
└─────────────────────────────────┘
```

#### Label "SOMMAIRE"

- Texte : "SOMMAIRE" en uppercase
- Font-size : `--text-caption` (cohérent avec VAULTS / FICHIERS de la sidebar)
- Color : `--color-text-muted`
- Letter-spacing : tracked (cohérent avec les autres labels)
- Padding : 0 16px 12px 16px

#### Items (liens vers headings)

- List-style : none
- Padding par item : 6px 12px
- Cursor : pointer
- Font-size : 13px (légèrement plus petit que le body)
- Font-weight : normal (sauf actif, voir plus bas)
- Color par défaut : `--color-text-muted`
- Line-height : 1.4

#### Indentation par niveau

- **H1** : padding-left 12px (pas d'indentation supplémentaire)
- **H2** : padding-left 28px (16px de plus que H1)
- **H3** : padding-left 44px (32px de plus que H1)

#### États interactifs

- **Hover** : background `--color-surface-hover`, color `--color-text` (passe à plein), curseur pointer
- **Actif (heading dans le viewport courant)** : background `--color-surface-active`, color `--color-accent`, font-weight 500
- **Click** : smooth scroll vers le heading dans l'éditeur, durée 300ms ease-out

#### Truncation

- Si le heading est très long, ellipsis après 2 lignes max
- Tooltip au hover montrant le heading complet (après 500ms)

### Empty state

Si le document a 0 ou 1 heading (ou aucun) :

```
┌─────────────────────────────────┐
│ SOMMAIRE                        │
├─────────────────────────────────┤
│                                 │
│   Aucun titre dans ce document  │
│                                 │
└─────────────────────────────────┘
```

- Texte centré horizontalement et verticalement
- Color `--color-text-muted`
- Font-size 13px
- Padding 32px pour l'aération

### Persistence

L'état ouvert/fermé du panneau est **persisté dans config.json** (cohérent avec les autres états UI persistés : vaults expandedFolders, dernier fichier ouvert, theme).

Schéma config.json (extension) :
```json
{
  "ui": {
    "outlinePanelOpen": true
  }
}
```

- Au démarrage de l'app : restoration de l'état précédent
- **Le panneau reste ouvert quand l'utilisateur change de fichier** : le contenu se met à jour pour le nouveau fichier, mais le panneau ne se ferme pas automatiquement
- Si le nouveau fichier n'a pas de headings : empty state s'affiche, panneau toujours ouvert

### Détection des headings

#### Source des données

- **Source unique** : API blocks de BlockNote (post chantier 1)
- On lit la **structure parsée** par BlockNote, pas le markdown source brut
- Cette approche évite d'attraper des `#` dans des code blocks ou commentaires

Pseudocode :
```typescript
function extractOutline(editor: BlockNoteEditor): OutlineEntry[] {
  const blocks = editor.document; // ou équivalent BlockNote API
  return blocks
    .filter(block => block.type === 'heading')
    .map(block => ({
      id: block.id,
      level: block.props.level, // 1, 2, 3
      text: extractTextFromBlock(block),
    }))
    .filter(entry => entry.level <= 3); // H1-H3 uniquement en MVP
}
```

#### Niveaux retenus

- **H1, H2, H3** uniquement en MVP
- H4, H5, H6 ignorés (rare en pratique, panneau pas chargé)
- Post-MVP : étendre à H4-H6 si retour utilisateur

#### Exclusions

- **Frontmatter** : exclu (rendu séparément via `<details>` au-dessus de l'éditeur, ce n'est pas du contenu structurel)
- **Code blocks** : leur contenu n'est pas analysé pour les `#` (BlockNote les voit comme `codeBlock` type, pas comme `heading`)
- **Quotes / citations** : si elles contiennent un heading markdown brut (rare), c'est traité comme texte par BlockNote, donc pas dans l'outline

### Mise à jour dynamique

- Quand l'utilisateur tape ou modifie le contenu, l'outline se met à jour
- **Debounce 250ms** sur la mise à jour (évite le flicker à chaque keystroke)
- Pas de saut de scroll dans le panneau lors de la mise à jour (préserver la scrollTop position si le panneau a scrollé)

### Heading actif (synchronisation avec le viewport éditeur)

- On utilise un `IntersectionObserver` sur les headings rendus dans l'éditeur
- Le heading actif = le premier heading visible dans le viewport (plus haut dans la fenêtre)
- Mise à jour en temps réel pendant que l'utilisateur scroll
- Smooth transition de l'état actif (pas de jump abrupt)

### Click sur un heading dans le panneau

Comportement :
1. Capturer le click
2. Scroller smoothement vers le heading correspondant dans l'éditeur (300ms ease-out)
3. Le heading actif dans le panneau se met à jour (devient celui cliqué)
4. **Ne pas voler le focus** : si l'utilisateur était en train d'éditer, son curseur reste où il est, seul le scroll change

Note : le click n'active pas le mode édition sur le heading. Pour éditer un heading, l'utilisateur doit cliquer dessus dans l'éditeur lui-même.

---

## Précautions techniques

### A. Performance

- L'extraction de l'outline doit être rapide (pas de re-parse complet)
- BlockNote expose probablement déjà les blocks structurés en mémoire
- Debounce 250ms sur la mise à jour pour éviter de bloquer le rendu pendant la frappe
- L'IntersectionObserver est natif et performant, pas de polling de scroll

### B. Synchronisation édition/scroll

Click sur un heading dans le panneau pendant que l'utilisateur édite :
- Le focus de l'éditeur n'est PAS volé
- Le curseur reste à sa position d'édition
- Seul le scroll change
- Le heading cliqué devient l'actif dans le panneau

### C. Rendu vs édition

Le panneau fonctionne identiquement en mode preview et en mode source (si BlockNote propose un mode source), tant qu'on lit l'outline depuis la structure de blocks.

### D. Multilingue / unicode

Les headings peuvent contenir n'importe quels caractères Unicode (emojis, accents, scripts non-latins). Le rendu doit les supporter sans casser. La truncation par ellipsis doit fonctionner correctement avec ces caractères.

### E. Très long document

Si un document a 100+ headings :
- Le panneau scroll indépendamment de l'éditeur
- Pas de pagination, pas de search dans l'outline (post-MVP si demande)
- Le heading actif scroll vers la vue dans le panneau si nécessaire (`scrollIntoView({ block: 'center', behavior: 'smooth' })`)

### F. Width adaptation

- Largeur fenêtre < 1100px et panneau ouvert : l'éditeur devient très étroit (potentiellement < 700px)
- En MVP : on accepte ce trade-off, l'utilisateur peut fermer le panneau s'il a besoin de place
- Post-MVP : envisager une largeur de fenêtre minimale en dessous de laquelle on désactive l'icône, ou on bascule en mode overlay

---

## Étapes d'implémentation

### Étape 1 — Store et extraction d'outline

**Objectif** : avoir une source de vérité pour l'outline du document actif, mise à jour réactive.

- [ ] Créer `src/lib/stores/outline.svelte.ts` :
  - State `outline: OutlineEntry[]`
  - State `activeHeadingId: string | null`
  - Méthode `setOutline(entries: OutlineEntry[])`
  - Méthode `setActiveHeading(id: string | null)`
  - Type `OutlineEntry { id, level, text }`
- [ ] Créer la fonction d'extraction depuis l'API BlockNote :
  - Fichier `src/lib/utils/extractOutline.ts`
  - Fonction `extractOutline(editor: BlockNoteEditor): OutlineEntry[]`
  - Filtrer les blocks de type `heading` avec level 1-3
- [ ] Tests unit (`tests/unit/extractOutline.test.ts`) :
  - Document sans heading → tableau vide
  - Document avec un seul H1 → 1 entry
  - Document avec H1-H6 mélangés → seuls H1-H3 retenus
  - Headings dans des code blocks → ignorés
  - Frontmatter → ignoré
  - Caractères unicode → préservés
- [ ] Tests unit du store :
  - setOutline met à jour l'état
  - setActiveHeading update activeHeadingId
  - Reactivité testable

**Validation étape 1** :
- [ ] Tests verts
- [ ] svelte-check 0/0
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 2.**

### Étape 2 — Composant OutlinePanel

**Objectif** : composant standalone testable visuellement.

- [ ] Créer `src/lib/components/OutlinePanel.svelte` :
  - Props : `outline: OutlineEntry[]`, `activeHeadingId: string | null`, `onItemClick: (id: string) => void`
  - Render label "SOMMAIRE", liste des items avec indentation par niveau
  - Empty state si outline.length === 0
  - Hover, active states CSS
- [ ] Tests component (`tests/component/OutlinePanel.test.svelte.ts`) :
  - Rendu liste avec 5 items mixtes H1/H2/H3
  - Indentation correcte par niveau
  - Empty state quand outline vide
  - Click sur item → onItemClick appelé avec le bon id
  - Active state visuel sur l'item correspondant à activeHeadingId
- [ ] Tests visuels Playwright (route fixture `_visual/outline-panel`) :
  - Screenshot avec 5 items mixtes (dark + light)
  - Screenshot empty state
  - Screenshot avec un item actif

**Validation étape 2** :
- [ ] Tests verts
- [ ] Screenshots cohérents avec design.md
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 3.**

### Étape 3 — Intégration toolbar éditeur + toggle

**Objectif** : ajouter l'icône dans la toolbar et gérer le toggle ouvert/fermé.

- [ ] Modifier `EditorToolbar.svelte` :
  - Ajouter un séparateur visuel après les contrôles de style
  - Ajouter le bouton icône `List` avec aria-label "Sommaire"
  - État actif visuel quand panneau ouvert
  - Émettre `onOutlineToggle` au click
- [ ] Modifier le store config (Rust + front) :
  - Ajouter le champ `ui.outlinePanelOpen: boolean` (default true ou false, à arbitrer — proposition : `true` pour découvrabilité)
  - Tests Rust : round-trip avec rétrocompat (default false si manquant)
- [ ] Créer le store front `src/lib/stores/uiState.svelte.ts` :
  - `outlinePanelOpen: boolean` reactive
  - Méthode `toggleOutlinePanel()`
  - Persistence via configSave debounced

**Validation étape 3** :
- [ ] Toolbar rendue avec icône List visible
- [ ] Click toggle l'état
- [ ] Persistence config.json fonctionne (test cargo)
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 4.**

### Étape 4 — Layout + IntersectionObserver

**Objectif** : insérer le panneau dans le layout et synchroniser le heading actif.

- [ ] Modifier `+page.svelte` :
  - Layout flex : sidebar à gauche, éditeur au centre, OutlinePanel à droite (conditionnel sur outlinePanelOpen)
  - Animation slide-in du panneau (CSS transform + transition)
  - L'éditeur rétrécit quand le panneau s'ouvre
- [ ] Hook IntersectionObserver dans `Editor.svelte` :
  - Observer tous les éléments DOM des headings (post-rendu BlockNote)
  - Quand un heading entre dans le viewport (ou le quitte) : recalculer l'actif
  - Le heading actif = le plus haut dans le viewport
  - Update du store `outline.activeHeadingId`
- [ ] Click sur un item du panneau :
  - Trouver l'élément DOM du heading correspondant
  - `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`
  - Update activeHeadingId immédiat (pas attendre IntersectionObserver)

**Validation étape 4** :
- [ ] Smoke test Matheo :
  - Ouvrir un fichier riche (avec ≥ 5 headings)
  - Click icône → panneau s'ouvre avec slide-in
  - Headings affichés correctement, indentés par niveau
  - Scroller dans l'éditeur → heading actif se met à jour dans le panneau
  - Click sur un heading dans le panneau → smooth scroll vers ce heading
  - Click icône à nouveau → panneau se ferme avec slide-out
  - Fermer + relancer l'app : état du panneau restauré
- [ ] Smoke test fichier sans heading → empty state visible
- [ ] Smoke test light + dark mode

⏸ **Attendre OK Matheo avant étape 5.**

### Étape 5 — Tests E2E + clôture

- [ ] Tests Playwright E2E :
  - Toggle panneau via icône
  - Click sur un heading scroll vers le bon endroit
  - Persistence après reload
- [ ] Tests visuels :
  - Screenshot app entière avec panneau ouvert (dark + light)
  - Screenshot app entière avec panneau fermé
- [ ] Mise à jour `JOURNAL.md`
- [ ] Mise à jour `BACKLOG.md` : retirer item "outline panel"
- [ ] Mise à jour `STATE.md`
- [ ] Commit final : `feat(editor): add outline panel with heading navigation`
- [ ] Mise à jour de `WORKPLAN.md` : marquer chantier 4 ✅

**Validation étape 5** :
- [ ] cargo + vitest + visual + check + build : tout vert
- [ ] Smoke test final Matheo
- [ ] Récap final

---

## Critères de succès

- [ ] Panneau s'ouvre/ferme via icône avec animation slide
- [ ] Headings H1-H3 affichés avec indentation correcte
- [ ] Heading actif synchronisé avec le scroll de l'éditeur
- [ ] Click sur un heading scroll smoothement
- [ ] Persistence ouvert/fermé entre sessions
- [ ] Persistence ouvert au switch de fichier
- [ ] Empty state propre quand pas de heading
- [ ] Cohérence visuelle dark + light avec design.md
- [ ] Pas de vol de focus en édition
- [ ] Tous les tests verts

---

## Hors scope MVP (pour BACKLOG.md)

- Niveaux H4-H6 (à activer si demande utilisateur)
- Search dans l'outline (utile sur très long document)
- Largeur du panneau redimensionnable
- Mode overlay sur petits écrans
- Compte de mots par section
- Bouton "back to top"
- Drag pour réordonner les sections via outline
- Numérotation auto (1.1, 1.2, etc.)
