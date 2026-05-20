# Markus — Plan de Développement (Index global)

> **Document maître** : pilotage haut niveau des chantiers Markus.
> À lire en début de chaque session Claude Code.
> Ordre d'exécution strict : un chantier à la fois, terminé avant le suivant.

---

## ✅ CHANTIER C1 TERMINÉ (2026-05-11)

La **migration de l'éditeur Crepe → BlockNote** est complète et clôturée. Toutes les étapes (1, 2, 2.5.a-e, 4, 3, 5, 6) ont été livrées sur la branche `feat/blocknote-migration` (12 commits ahead de `main`). Voir `PLAN-BLOCKNOTE.md` pour l'historique détaillé et `STATE.md` pour l'état factuel.

**Prochaine action** : merge manuel de `feat/blocknote-migration` sur `main` par Matheo. **Ne PAS merger automatiquement par Claude** (règle finale du plan : "Le merge sur `main` est fait manuellement par Matheo, pas par Claude Code").

Chantiers débloqués pour les prochaines sessions :
- **C2** — Système de toast / notifications (P1)
- **C3** — Drag-drop sidebar HTML5 → pointer events (P1, ~~bug cassé en réel~~ → **user-validated OK 2026-05-12 matin**, chantier déprioritisé sauf nouveau symptôme)
- **Hors plan urgent** : fix folder-delete EPERM macOS (diagnostiqué 2026-05-10 par 2 agents, à coder sur branche dédiée `fix/folder-delete-permission` depuis `main`)

---

## Vue d'Ensemble des Chantiers

| Ordre | Chantier | Priorité | État | Plan détaillé |
|-------|----------|----------|------|---------------|
| 1 | Migration éditeur Crepe → BlockNote | P0 | **✅ TERMINÉ 2026-05-11 — branche prête merge manuel Matheo** | `PLAN-BLOCKNOTE.md` (historique) |
| 2 | Système de Toast / Notifications | P1 | DÉBLOQUÉ (peut démarrer post-merge C1) | §"Chantier 2" ci-dessous |
| 3 | Drag-drop sidebar (HTML5 → pointer events) | P2 | 🟡 USER-VALIDATED OK 2026-05-12 matin — déprio sauf nouveau symptôme | §"Chantier 3" ci-dessous |
| 4 | Outline panel (sommaire) | P2 | SUSPENDU — brief posé | `features/sommaire.md` |
| 5 | Empty state | P2 | SUSPENDU — brief posé | `features/empty-state.md` |
| 6 | Onglets de fichiers (Phase 5c) | P2 | SUSPENDU — backlog | `BACKLOG.md` |

---

## Règles permanentes

À respecter dans tous les chantiers, sans exception :

- **TDD strict** : tests RED avant code GREEN
- **Un chantier à la fois**, pas de parallélisation
- **Format récap fin d'étape obligatoire** (voir §"Format communication" ci-dessous)
- **Commits par étape**, pas de push (Matheo gère ça)
- **Honnêteté brutale** : "tests verts ≠ feature marche". Smoke test obligatoire avant de passer à l'étape suivante.
- **Aucun test désactivé** pour faire passer un build
- **Si un bug résiste 15 min** : skip + journal + continuer
- **Pas de scope creep** : si tu identifies un autre problème, BACKLOG.md, pas dans cette session
- **Communication explicite** : à chaque livraison, indiquer URL de test exacte + procédure + ce qui est visible dans l'app principale

---

## CHANTIER 2 — Système de Toast / Notifications (SUSPENDU)

### Contexte

Quand un fichier est sauvegardé, supprimé, dupliqué, copié dans le presse-papier, déplacé, il n'y a aucun feedback visuel autre que le statut sauvegarde discret en status bar. Plusieurs actions importantes sont silencieuses, ce qui crée une dette UX.

**Décision actée** : implémenter un système de toast léger, cohérent avec design.md, **après** la fin de la migration BlockNote.

### Mission

Créer un système de toast accessible globalement dans l'app, et l'intégrer aux actions importantes existantes.

### Branche

```bash
git checkout -b feat/toast-system
```

### Spécifications fonctionnelles

#### Comportement visuel

- **Position** : bas-droite de la fenêtre, au-dessus de la status bar
- **Largeur** : max 360px, hauteur adaptable
- **Animation entrée** : slide-in depuis la droite + fade-in (200-250ms)
- **Animation sortie** : fade-out (150ms)
- **Auto-dismiss** : 3 secondes par défaut (configurable)
- **Dismiss manuel** : croix à droite, click pour fermer immédiatement
- **Empilement** : plusieurs toasts en file verticale avec gap 8px, plus récent en bas

#### Types de toasts

| Type | Icône Lucide | Accent |
|------|--------------|--------|
| `success` | `Check` | Vert tempéré |
| `info` | `Info` | Bleu doux |
| `warning` | `AlertTriangle` | Orange |
| `error` | `AlertCircle` | Rouge atténué |

#### API

```typescript
import { toast } from '$lib/stores/toast.svelte';

toast.success('Fichier sauvegardé');
toast.success('Chemin copié', { details: '/Users/lkid/Projects/markus/SPEC.md' });
toast.error('Suppression échouée', { details: err.message });
toast.info('Vault déplacé');
toast.warning('Conflit de nom', { duration: 5000 });
```

Options :
- `details?: string` — sous-titre optionnel
- `duration?: number` — défaut 3000ms
- `dismissible?: boolean` — défaut true

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
| Erreur Tauri | `error` | Message lisible + détails |
| Vault retiré | `info` | "Vault retiré" |
| Vault renommé | `success` | "Vault renommé" |
| Toggle mode readonly | `info` | "Mode lecture seule activé/désactivé" |
| Conflit de nom | `warning` | "Un fichier avec ce nom existe déjà" |

**À NE PAS toaster** : auto-save successful (déjà visible en status bar), frappe utilisateur, sélection fichier sidebar, toggle theme.

### Étapes (à dérouler quand C1 sera terminé)

1. **Étape 1 — Store et composants (TDD strict)** : `src/lib/stores/toast.svelte.ts`, `src/lib/components/Toast.svelte`, `src/lib/components/ToastContainer.svelte`, tests unit + component
2. **Étape 2 — Intégration globale** : monter `<ToastContainer />` dans `+layout.svelte`, ajouter les appels dans tous les handlers du tableau ci-dessus
3. **Étape 3 — Tests visuels et clôture** : Playwright visual + mise à jour journaux

---

## CHANTIER 3 — Drag-drop sidebar (SUSPENDU)

### Contexte

Le drag-drop fichier → dossier dans la sidebar a été implémenté en HTML5 native pendant la session autonome du 9 mai, **sans test automatique**. **Confirmé cassé en réel** par Matheo : "the drag and drop in the left column doesn't work at all."

Probable même symptôme que Crepe : HTML5 native drag fragile en environnement Tauri/webview. Solution : pointer events.

### Mission

1. Confirmer le diagnostic (smoke test rigoureux)
2. Ré-implémenter en pointer events
3. Ajouter un indicateur visuel propre
4. Ajouter des tests automatiques

### Branche

```bash
git checkout -b fix/sidebar-dnd
```

### Étapes (à dérouler quand C1 et C2 seront terminés)

1. **Étape 1 — Diagnostic et reproduction** : tester chaque cas et documenter dans `JOURNAL.md`
2. **Étape 2 — Ré-implémentation en pointer events** : pointerdown/move/up + setPointerCapture, indicateur visuel pendant drag (opacity 0.4 sur source, highlight + ligne accent 2px sur target)
3. **Étape 3 — Tests automatiques Playwright** : déplacement réel, visual feedback, rejet readonly
4. **Étape 4 — Clôture** : journal + commit final

### Critères de succès

- [ ] Drag-drop sidebar fonctionne en réel
- [ ] Indicateur visuel propre
- [ ] Test automatique en place
- [ ] Pas de régression
- [ ] Toast après drop (intégration C2 si fait avant)

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

TESTS AUTOMATIQUES
- cargo : X/X
- vitest : X/X
- visual : X/X
- svelte-check : 0/0
- build : OK

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
- [path 1]
- [path 2]

DÉCISIONS PRISES (en autonomie)
- [décision 1] : [justification courte]

BUGS / BLOCAGES
- [aucun] ou [liste]

PROCHAINE ÉTAPE
Étape Y+1 : [titre court]

⏸ J'attends ton smoke test + validation avant d'enchaîner.
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

- `STATE.md` — état brutal et factuel (porte d'entrée)
- `CLAUDE.md` — méthodologie permanente
- `WORKPLAN.md` — **CE FICHIER** (index global des chantiers)
- `PLAN-BLOCKNOTE.md` — plan détaillé du chantier ACTIF (migration BlockNote)
- `SPEC.md` — spec fonctionnelle Markus
- `PLAN.md` — plan global du projet par phases (historique, phases 0-6)
- `TESTS.md` — catalogue des tests
- `JOURNAL.md` — journal de session (append-only)
- `BACKLOG.md` — items hors-scope MVP
- `MIGRATION-NOTES.md` — notes d'investigation BlockNote (temporaire, à supprimer en fin C1)
- `design.md` — référence visuelle (Warp-inspired)

### Décisions actées

- Identité produit : agrégateur multi-vault de markdowns dev (pas un PKM)
- Esthétique : Warp-inspired (IDE/terminal)
- Cmd+W comme seul raccourci clavier custom
- Phase 7 wiki-links/extract-to-note : tuée définitivement
- BlockNote remplace Crepe (chantier 1, voir `PLAN-BLOCKNOTE.md`)

### Backlog post-MVP (cf. BACKLOG.md)

- Mode source markdown brut (toggle dans header)
- Onglets de fichiers (Phase 5c)
- Outline panel
- E2E real-binary avec WebdriverIO + tauri-driver
- Settings panel utilisateur
- Recherche full-text cross-vaults
- Drag-drop entre vaults différents
- Smooth caret animation

---

## Mode d'emploi pour Matheo

En début de session Claude Code, écrire :

```
Lis WORKPLAN.md et PLAN-BLOCKNOTE.md, puis continue à l'étape suivante.
```

Claude Code doit alors :
1. Lire `WORKPLAN.md` (vue d'ensemble)
2. Lire `PLAN-BLOCKNOTE.md` (plan détaillé du chantier actif)
3. Identifier l'étape en cours (premier non-✅ dans le tableau de progression de `PLAN-BLOCKNOTE.md`)
4. Suivre la spec à la lettre
5. Respecter les règles non négociables
6. Envoyer le récap au format obligatoire en fin d'étape
7. Mettre à jour `PLAN-BLOCKNOTE.md` (cocher l'étape) en fin de validation
