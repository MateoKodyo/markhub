# FEATURE — Empty State (écran d'accueil de l'éditeur)

> Spec détaillée pour les états vides de l'éditeur Markhub.
> À démarrer après le chantier 1 (migration BlockNote).
> Branche dédiée : `feat/empty-state`

---

## Statut

**Priorité** : P2 (post chantiers 1-3)
**État** : Spec validée, en attente de démarrage
**Dépendance** : Aucune dépendance technique forte. Peut démarrer dès qu'un slot est libre. Idéalement après chantier 1 (BlockNote) pour éviter de styliser un écran qui devra de toute façon cohabiter avec le nouvel éditeur.

---

## Contexte

Quand l'utilisateur lance Markhub pour la première fois, ou quand il a aucun fichier ouvert, l'éditeur affiche un écran vide silencieux. C'est désagréable, et surtout l'utilisateur ne sait pas quoi faire.

**Pattern de référence** : Cursor (et VS Code dans une moindre mesure) affichent un écran d'accueil avec actions claires + liste des projets récents. Le résultat : zéro friction pour démarrer une session.

**Décision actée par Matheo le 2026-05-10** : implémenter un empty state Markhub-natif, plus discret que Cursor, texte-first à la Linear, avec actions adaptées au contexte.

---

## Mission

Créer un écran d'accueil pour la zone éditeur quand :
- **Scénario A** : Markhub n'a aucun vault (premier lancement, ou tous vaults retirés)
- **Scénario B** : Markhub a des vaults mais aucun fichier ouvert (état initial post chantier onglets, ou onglet fermé)

L'écran doit proposer des actions adaptées au scénario, et donner accès rapide aux vaults existants.

---

## Spécifications

### Position et apparition

- **Zone** : remplace le contenu de l'éditeur central (à droite de la sidebar)
- **Layout** : flex column centré verticalement et horizontalement
- **Apparition** : pas d'animation au premier render, fade-in subtil (150ms) si l'utilisateur arrive ici en fermant son dernier onglet
- **Statut bar** : reste visible en bas mais avec contenu adapté ("Aucun fichier sélectionné", déjà existant)
- **Toolbar éditeur** : masquée (les boutons B/I/H1/H2/H3 n'ont pas de sens sans contenu)

### Architecture de l'écran

Structure générale :

```
┌─────────────────────────────────────────┐
│                                         │
│              [LOGO]                     │
│              Markhub                    │
│      Éditeur Markdown local-first       │
│                                         │
│       ─── Actions principales ──        │
│                                         │
│       [icon]  Action 1                  │
│       [icon]  Action 2                  │
│       [icon]  Action 3                  │
│       [icon]  Action 4                  │
│                                         │
│       ─── Vaults récents ────           │
│                                         │
│       ●  Karajan                        │
│       ●  inbox modifié                  │
│       ●  Cortex                         │
│       ●  Test                           │
│                                         │
└─────────────────────────────────────────┘
```

### Spécifications par section

#### Logo + tagline

- **Logo** : à définir (en attendant, on utilise l'icône Lucide `BookText` ou un wordmark texte "Markhub")
- **Wordmark "Markhub"** : font-size 28px, font-weight 600, color `--color-text`
- **Tagline** : "Éditeur Markdown local-first"
  - Font-size 14px
  - Color `--color-text-muted`
  - Margin-top 8px
- **Spacing** : margin-bottom 48px avant la section actions

#### Section "Actions principales"

- **Label de section** : aucun (les actions sont auto-explicatives via leurs labels)
- **Layout** : liste verticale (pas de cards 2x2 à la Cursor — plus discret, plus Linear)
- **Largeur max du bloc** : 320px centré
- **Items** : voir détails par scénario ci-dessous

#### Item d'action (pattern réutilisable)

Structure :
```
[icône Lucide]  Label de l'action
                Description optionnelle en plus petit
```

Spécifications :
- **Padding** : 12px 16px
- **Border-radius** : `--radius-md`
- **Cursor** : pointer
- **Hover** : background `--color-surface-hover`
- **Active (au click)** : background `--color-surface-active`
- **Layout** : icône à gauche (24x24), texte à droite (label + optionnel description)
- **Gap entre items** : 4px
- **Icône** : color `--color-text-muted` par défaut, `--color-text` au hover
- **Label** : font-size 14px, font-weight 500, color `--color-text`
- **Description** : font-size 12px, color `--color-text-muted`, optionnelle

#### Section "Vaults récents" (scénario A) ou "Vaults" (B)

- **Label de section** : "VAULTS" en uppercase tracked, cohérent avec sidebar
  - Font-size `--text-caption`
  - Color `--color-text-muted`
  - Letter-spacing tracked
  - Margin-top 32px, margin-bottom 12px
- **Layout** : liste verticale, même largeur que les actions (320px centré)
- **Item vault** :
  - Pastille couleur du vault (8px de diamètre)
  - Nom du vault (14px, color `--color-text`)
  - Padding 8px 16px
  - Hover : background `--color-surface-hover`, cursor pointer
  - Click : sélectionne le vault dans la sidebar (highlight) — pas d'ouverture automatique de fichier (l'utilisateur a le choix)
- **Si aucun vault** : section masquée (pas de "Aucun vault récent")
- **Limite** : tous les vaults affichés, pas de pagination (max raisonnable ~10 vaults en pratique)

### Actions par scénario

#### Scénario A — Markhub n'a aucun vault

Le plus important : guider vers l'ajout d'un vault.

```
[FolderOpen]    Ouvrir un vault
                Sélectionner un dossier existant

[FolderPlus]    Créer un nouveau vault
                Créer un dossier et l'ajouter
```

- **"Ouvrir un vault"** : déclenche le picker macOS (`@tauri-apps/plugin-dialog open`), vault ajouté avec basename comme nom, auto-sélectionné
- **"Créer un nouveau vault"** : 
  - Étape 1 : picker emplacement parent
  - Étape 2 : input dialog pour le nom du nouveau dossier
  - Étape 3 : crée le dossier sur disque + ajoute comme vault + sélectionné
  - Si déjà géré ailleurs : utilise le flow existant

**Pas de section "Vaults récents"** dans ce scénario (puisqu'il n'y en a pas).

#### Scénario B — Vault sélectionné, aucun fichier ouvert

L'utilisateur peut faire 4 choses pertinentes :

```
[FilePlus]      Nouveau fichier
                Créer un fichier dans [nom du vault]

[FolderPlus]    Nouveau dossier
                Créer un dossier dans [nom du vault]

[FileSearch]    Ouvrir un fichier
                Naviguer dans [nom du vault]

[FolderOpen]    Ajouter un autre vault
```

- **"Nouveau fichier"** : focus sur la sidebar, déclenche le flow de création de fichier inline (équivalent du clic sur le bouton + file)
- **"Nouveau dossier"** : pareil pour dossier
- **"Ouvrir un fichier"** : focus sur le champ filtre de la sidebar (préparation à un futur Cmd+P palette de fichiers, mais en MVP on utilise juste le filtre existant)
- **"Ajouter un autre vault"** : déclenche le picker comme scénario A

**Section "Vaults"** affichée en dessous : permet de basculer rapidement vers un autre vault.

### Détection du scénario

Logique :
```
si vaults.length === 0 → Scénario A
sinon → Scénario B
```

(Pour l'instant on n'a pas de scénario "vault sélectionné" différent de "aucun vault sélectionné" car la sidebar gère déjà ça. Si plus tard on a la notion de vault "actif" sans fichier ouvert, on adaptera.)

### Comportement après action

- **Après "Ouvrir un vault" / "Créer un vault" réussi** :
  - Le vault est ajouté à la sidebar
  - Le vault devient sélectionné
  - L'empty state passe du scénario A au scénario B
  - Toast (post chantier 2) : "Vault ajouté" ou "Vault créé"
- **Après "Nouveau fichier" / "Nouveau dossier" réussi** :
  - Le fichier/dossier est créé
  - Le fichier est ouvert dans l'éditeur (l'empty state disparaît)
  - Toast (post chantier 2)
- **Si action annulée** (picker fermé, input vide) :
  - L'empty state reste affiché
  - Aucun toast

### Persistence et mémoire

- **Pas de persistence spécifique pour cet écran** : il s'affiche conditionnellement selon l'état (vaults.length, openFiles.length)
- **Pas de message "Welcome back"** ou similaire : on évite le sentiment de chrome inutile

---

## Précautions techniques

### A. Performance

L'empty state est un composant léger. Pas de problème de perf attendu.

### B. Cohérence visuelle dark + light

Tous les éléments doivent rendre correctement dans les deux modes. Tester en priorité.

### C. Empty state dans une fenêtre étroite

Si l'utilisateur a une fenêtre très étroite (< 800px de large), le bloc 320px max doit rester centré et lisible. Pas de overflow horizontal.

### D. Accessibilité

- Tous les boutons d'action doivent avoir un `aria-label` descriptif
- Navigation au clavier : Tab cycle entre les actions, Enter active
- Focus visible (outline ou équivalent)

### E. Pas de raccourci clavier custom

Cohérent avec la règle Markhub : pas de raccourcis sauf Cmd+W. L'empty state utilise uniquement le click et la navigation Tab.

### F. Internationalisation

En MVP, FR uniquement (cohérent avec le reste de Markhub). Pas de système i18n pour cette feature.

### G. Multi-écran / DPI

Le logo et les icônes doivent rester nets sur écrans Retina (SVG natif).

---

## Étapes d'implémentation

### Étape 1 — Composant EmptyState standalone

**Objectif** : créer le composant et le tester en isolation visuelle.

- [ ] Créer `src/lib/components/EmptyState.svelte` :
  - Props :
    - `scenario: 'no-vault' | 'no-file'`
    - `vaults: Vault[]` (pour la section vaults)
    - `currentVault?: Vault` (pour le scénario B, nom du vault dans les descriptions)
    - Callbacks : `onOpenVault`, `onCreateVault`, `onNewFile`, `onNewFolder`, `onOpenFile`, `onSelectVault`
  - Rendu logo + wordmark + tagline
  - Rendu actions selon scénario
  - Rendu section vaults si applicable
- [ ] Tests component (`tests/component/EmptyState.test.svelte.ts`) :
  - Rendu scénario A (pas de vault) : 2 actions visibles, pas de section vaults
  - Rendu scénario B avec 3 vaults : 4 actions, section vaults avec 3 items
  - Click "Ouvrir un vault" → callback onOpenVault appelé
  - Click sur un vault dans la liste → callback onSelectVault avec le bon vault
- [ ] Route fixture `_visual/empty-state` :
  - `?scenario=no-vault` → render scénario A
  - `?scenario=no-file&vaults=4` → render scénario B avec 4 vaults
- [ ] Tests visuels Playwright :
  - Scénario A dark + light
  - Scénario B avec 4 vaults dark + light
  - Scénario B avec 0 vault (pas pertinent normalement, mais vérifier que ça ne crash pas)

**Validation étape 1** :
- [ ] Tests verts
- [ ] Screenshots cohérents avec design.md
- [ ] svelte-check 0/0
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 2.**

### Étape 2 — Intégration dans le layout principal

**Objectif** : afficher l'empty state au bon moment dans l'app.

- [ ] Modifier `+page.svelte` (ou le layout équivalent) :
  - Logique conditionnelle : afficher EmptyState ou Editor selon l'état
    - Si `vaults.length === 0` → EmptyState scénario A
    - Sinon si `activeFile === null` (ou `openFiles.length === 0` post-chantier onglets) → EmptyState scénario B
    - Sinon → Editor classique
- [ ] Câbler les callbacks :
  - `onOpenVault` → flow existant d'ajout de vault (`vaultsStore.addVaultFromPath` ou équivalent)
  - `onCreateVault` → nouveau flow (picker emplacement + input nom + create_directory + addVault)
  - `onNewFile` → focus sidebar + déclenche le flow de création inline
  - `onNewFolder` → pareil pour dossier
  - `onOpenFile` → focus sur le champ filtre de la sidebar
  - `onSelectVault(vault)` → `vaultsStore.setActiveVault(vault.id)` ou équivalent
- [ ] Animation fade-in 150ms si l'utilisateur arrive sur l'empty state en fermant son dernier onglet (post-chantier onglets)

**Validation étape 2** :
- [ ] Smoke test Matheo :
  - Premier lancement (config.json supprimé) → scénario A visible
  - Ajouter un vault via le bouton → empty state passe au scénario B
  - Cliquer sur un fichier → empty state disparaît, éditeur visible
  - Retirer tous les vaults → retour au scénario A
- [ ] Toutes les actions fonctionnent et déclenchent le bon comportement
- [ ] Pas de régression sur la sidebar et le reste de l'app
- [ ] Récap envoyé

⏸ **Attendre OK Matheo avant étape 3.**

### Étape 3 — Polish + flow "Créer un nouveau vault"

**Objectif** : finaliser le flow le plus complexe (création vault).

- [ ] Implémenter le flow "Créer un nouveau vault" :
  - Étape 1 : picker macOS pour choisir l'emplacement parent
  - Étape 2 : InputDialog (composant existant) pour saisir le nom du dossier
  - Étape 3 : appel Rust `folder_create` pour créer le dossier
  - Étape 4 : `vaultsStore.addVaultFromPath` avec le nouveau path
  - Toast (si chantier 2 fait) : "Vault [nom] créé"
- [ ] Cas d'erreur :
  - Annulation du picker : flow annulé silencieusement
  - Annulation de l'input : flow annulé silencieusement
  - Dossier déjà existant : toast warning (post chantier 2) ou alert simple
  - Permission denied : toast error avec détails
- [ ] Tests Rust :
  - Cas nominal de création + ajout vault
  - Cas dossier existant
  - Cas permission denied (mock)
- [ ] Tests E2E (si possible) ou smoke test manuel rigoureux

**Validation étape 3** :
- [ ] Flow "Créer vault" fonctionnel de bout en bout
- [ ] Cas d'erreur gérés
- [ ] Smoke test Matheo

⏸ **Attendre OK Matheo avant étape 4.**

### Étape 4 — Tests E2E + clôture

- [ ] Tests Playwright E2E :
  - Scénario A → click "Ouvrir un vault" → vault ajouté → scénario B
  - Scénario B → click "Nouveau fichier" → fichier créé → empty state disparaît
  - Click sur un vault dans la section → vault devient actif
- [ ] Tests visuels :
  - Screenshot empty state scénario A complet (dark + light)
  - Screenshot empty state scénario B avec 4 vaults (dark + light)
- [ ] Mise à jour `JOURNAL.md`
- [ ] Mise à jour `BACKLOG.md` :
  - Retirer item "empty state"
  - Ajouter item post-MVP "fichiers récents" (cf. hors scope ci-dessous)
- [ ] Mise à jour `STATE.md`
- [ ] Commit final : `feat(ui): add empty state with vault and file actions`
- [ ] Mise à jour de `WORKPLAN.md` : marquer feature ✅

**Validation étape 4** :
- [ ] cargo + vitest + visual + check + build : tout vert
- [ ] Smoke test final Matheo
- [ ] Récap final

---

## Critères de succès

- [ ] Empty state scénario A : actions claires "Ouvrir vault" et "Créer vault" fonctionnelles
- [ ] Empty state scénario B : 4 actions fonctionnelles + liste des vaults cliquable
- [ ] Détection automatique du scénario selon l'état
- [ ] Cohérence visuelle dark + light avec design.md
- [ ] Pas de régression sur sidebar / éditeur / status bar
- [ ] Tous les tests verts
- [ ] Smoke test final OK

---

## Hors scope MVP (pour BACKLOG.md)

### Feature dédiée "Fichiers récents"

Tracker une liste des N derniers fichiers ouverts (avec leur vault), persistée. À afficher :
- Dans l'empty state scénario B (en dessous ou à la place de "Vaults")
- Dans une éventuelle palette Cmd+P plus tard

Architecture :
- Store `recentFiles.svelte.ts` avec liste FIFO de 10-20 entrées
- Persistence dans config.json
- Mise à jour à chaque ouverture de fichier
- Méthode `clearRecents()` pour vider

Pourquoi pas en MVP : feature autonome qui mérite sa propre spec. Le scénario B fonctionne très bien avec juste la liste des vaults.

### Welcome dialog au premier lancement

Une popup "Bienvenue dans Markhub" avec onboarding rapide. Pas en MVP — l'empty state actions claires est suffisant.

### Templates de fichiers

À l'action "Nouveau fichier", proposer des templates (note vide, dossier de specs, journal du jour, etc.). Post-MVP.

### Stats du vault

Afficher le nombre de fichiers, dernier modifié, taille totale dans la section vault. Cosmétique, post-MVP.

### Drag-drop d'un dossier sur la fenêtre Markhub

Pour ajouter un vault rapidement en draggant un dossier depuis Finder sur la fenêtre. Pattern d'UX intéressant mais demande des handlers spécifiques côté Tauri. Post-MVP.

### Wordmark / logo personnalisé

Le wordmark "Markhub" en SVG custom (pas juste du texte). Quand le branding sera défini.
