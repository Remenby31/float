<p align="center">
  <img src="frontend/public/favicon.svg" width="64" height="64" alt="Float">
</p>

<h1 align="center">Float</h1>

<p align="center"><strong>A personal task manager where the goal is to empty the bucket. When everything is done, you float.</strong></p>

Float is a keyboard-friendly task workspace with groups, projects, smart dates, a weekly overview, rich notes, attachments, undo/redo, live synchronization, light/dark themes, and PWA support.

## Stack

```text
React 19 + Vite + TanStack Router/Query + Tailwind 4 + TipTap 3
                              │
                            REST/SSE
                              │
                    Rust + Axum + SeaORM + SQLite
```

The React frontend is a client-only SPA. The Rust API remains the single backend and owns authentication, files, synchronization, and persistence.

## Development

Run the API:

```bash
source .env
cargo run -p float-api
```

Run the frontend in another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Vite serves the app on `http://localhost:5173` and proxies `/api` to `http://localhost:3000`. Override the proxy for read-only integration testing with `FLOAT_API_PROXY_TARGET`.

## Tests

```bash
cd frontend
npm run check
```

The check runs ESLint, Vitest, TypeScript, and the production build. End-to-end smoke tests expect a running frontend and credentials in the environment:

```bash
set -a
source ../.secrets
set +a
FLOAT_E2E_BASE_URL=http://127.0.0.1:5173 npm run test:e2e
```

## Deployment

```bash
git push
ssh <mini-pc>
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

The frontend image builds the Vite bundle and serves it with Caddy on port `3001`. The outer Caddy service keeps `/api/*` routed to Axum and all other requests routed to the React SPA.

## Structure

```text
float/
├── crates/
│   ├── api/            # Axum routes, JWT auth, SSE, attachments
│   ├── core/
│   ├── db/             # SeaORM entities
│   └── migration/      # SQLite migrations
├── frontend/
│   ├── src/app/        # providers and router composition
│   ├── src/components/ # shared UI
│   ├── src/features/   # auth and workspace modules
│   ├── src/lib/        # API and Query clients
│   └── src/routes/     # TanStack file routes
└── deploy/
```

Server state belongs to TanStack Query. Zustand is limited to UI state, notifications, and undo/redo history. Imports flow from shared modules to features to app/routes, enforced by ESLint.

## License

MIT
