# Float

Task management app. Rust backend (Axum 0.8 + SeaORM 1, SQLite) + SvelteKit frontend + Tailwind 4 + TipTap 3.

## Skills

Reference architecture for the planned rewrite, in `.claude/skills/`:
- `react-spa-stack` — Vite/React/TanStack stack choice + bulletproof-react structure
- `postgres-ontology` — typed entity/relation schemas in Postgres, SQLite→PG migration

## Testing

Always test UI changes with Playwright (`playwright-cli` skill) on https://float.remenby.fr before deploying.
Credentials in `.secrets` file (gitignored).

## Deploy

Push to GitHub → SSH to mini PC → `git pull` → `docker compose -f deploy/docker-compose.yml up -d --build`
