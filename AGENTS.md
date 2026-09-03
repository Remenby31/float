# Float

Task management app. Rust backend (Axum 0.8 + SeaORM 1, SQLite) + React 19/Vite frontend + TanStack Router/Query + Tailwind 4 + TipTap 3.

## Skills

Architecture references in `.claude/skills/`:
- Read `react-spa-stack` for frontend architecture, routing, server state, or React feature work.
- Read `postgres-ontology` only for database redesign, ontology work, or SQLite→Postgres migration.

## Frontend

- Run frontend commands from `frontend/`.
- Keep API data in TanStack Query; Zustand is for UI state and undo/redo only.
- Preserve the import flow `shared → features → app/routes`; ESLint enforces the seams with `import-x/no-restricted-paths`.
- Generate and commit `src/routeTree.gen.ts` through the Vite build.

## Testing

Run `npm run check` in `frontend/`. Test UI changes with Playwright locally, then run the non-destructive smoke flow on `https://float.remenby.fr` before deploying. Credentials are in `.secrets` (gitignored).

## Deploy

Push to GitHub → SSH to mini PC → `git pull` → `docker compose -f deploy/docker-compose.yml up -d --build`
