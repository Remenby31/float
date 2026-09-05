# Float — Plan de tests (parité `main` SvelteKit → React/Vite)

Objectif : vérifier que la migration React couvre tout ce qui fonctionnait sur
`main` (SvelteKit). Chaque feature ci-dessous est rejouée en e2e Playwright
(`frontend/tests/e2e/`) contre le stack local (API Rust + Vite + SQLite seedée).

## Features de `main` à couvrir

| # | Feature (main) | Comment c'était sur main | Test React |
|---|---|---|---|
| 1 | **Auth / login** | email + password, redirection `/app`, erreur si mauvais creds | `smoke.spec.ts` (login) + `workspace.spec.ts` (helper login) |
| 2 | **Vue semaine** | tâches datées groupées lun→dim, en retard sur "aujourd'hui", "later", jour courant surligné | `workspace.spec.ts` › week view |
| 3 | **Sidebar projets** | groupes parents + sous-projets, repli/expand, scroll-to | `workspace.spec.ts` › sidebar + mobile (`smoke`) |
| 4 | **CRUD projet** | créer groupe / sous-projet, renommer (dbl-clic), supprimer (confirm) | `workspace.spec.ts` › group lifecycle |
| 5 | **Couleur + icône projet** | ColorPicker, application récursive aux sous-projets | couvert au rendu (seed avec couleurs/icônes) ; picker = unit/manuel |
| 6 | **CRUD tâche** | ajout via smart-input, cocher/décocher, ouvrir détail, supprimer | `workspace.spec.ts` › task create/toggle/detail/delete |
| 7 | **Smart input / dates** | `@today`, `@demain`, `@lundi`, `@14h`, `@3j`… parsing | `smart-input.test.ts` (unit) + `workspace.spec.ts` (@today) |
| 8 | **Command palette (⌘K)** | recherche projet/tâche, création clavier, sélecteur projet | `smoke.spec.ts` + `workspace.spec.ts` › palette search/create |
| 9 | **Détail tâche** | titre éditable, due date (DatePicker), projet (move), notes TipTap, pièces jointes | `workspace.spec.ts` › detail (titre + delete) ; notes = `migrate.test.ts` |
| 10 | **Drag & drop** | déplacer tâche entre projets/jours, réordonner groupes | manuel (DnD HTML5 non déterministe en headless) |
| 11 | **Tâches terminées cachées au reload** | seules les tâches complétées *dans la session* restent visibles | `workspace.spec.ts` › completed hidden after reload |
| 12 | **Thème clair/sombre** | toggle persistant | `workspace.spec.ts` › theme toggle |
| 13 | **Undo / redo** | ⌘Z / ⌘⇧Z sur actions tâches | boutons présents (assert) ; flux complet = manuel |
| 14 | **Responsive mobile** | menu burger, sidebar, palette | `smoke.spec.ts` › mobile viewport |
| 15 | **PWA / service worker** | offline shell, autoUpdate | build (`vite-plugin-pwa` génère `sw.js`) — vérifié au build |

## Stack de test local

- API : `target/release/float-api` sur `:3000`, `DATABASE_URL=sqlite://./float.db`.
- DB seedée : user de test (`.secrets`) + 5 projets (2 groupes, 2 sous-projets,
  2 groupes-feuilles) + 9 tâches (datées, en retard, sans date, terminée).
- Frontend : `vite dev` sur `:5173`, proxy `/api → :3000`.
- Playwright : `desktop-chromium` + `mobile-chromium` (Pixel 7).

## Commandes

```bash
# unit + lint + build
cd frontend && npm run check
# e2e (stack local up, creds depuis .secrets)
set -a; . ../.secrets; set +a
FLOAT_E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test
```

Les tests destructifs (`workspace.spec.ts`) sont **skippés** si l'URL cible est
la prod (`float.remenby.fr`) — ils ne tournent que sur la DB locale jetable.
