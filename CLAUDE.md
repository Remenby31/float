# Float

Task management app. Rust backend (SeaORM + Actix) + SvelteKit frontend + Tailwind 4.

## Testing

Always test UI changes with Playwright (`playwright-cli` skill) on https://float.remenby.fr before deploying.
Credentials in `.secrets` file (gitignored).

## Deploy

Push to GitHub → SSH to mini PC → `git pull` → `docker compose -f deploy/docker-compose.yml up -d --build`
