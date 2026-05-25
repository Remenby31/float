<p align="center">
  <img src="frontend/static/favicon.svg" width="64" height="64" alt="float">
</p>

<h1 align="center">float</h1>

<p align="center">
  <strong>A personal task manager where the goal is to empty the bucket. When everything's done, you float.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> •
  <a href="#features">Features</a> •
  <a href="#stack">Stack</a> •
  <a href="#self-hosting">Self-hosting</a> •
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/backend-Rust%20%2F%20Axum-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/frontend-SvelteKit%205-red?logo=svelte" alt="SvelteKit">
  <img src="https://img.shields.io/badge/database-PostgreSQL-blue?logo=postgresql&logoColor=white" alt="PostgreSQL">
</p>

---

Not another todo app that rewards you for adding more. Float is built around one idea: **tasks are weight — get rid of them and you float.**

No gamification, no streaks, no guilt. Add tasks, knock them out, reach zero.

## Features

- **Smart input** — type `buy milk @tomorrow @15h` and the date is parsed automatically
- **Sub-projects** — one level of nesting, tasks belong to leaves only
- **Overview** — all projects side by side, add and complete tasks inline
- **Command palette** — `Cmd+K` to search everything instantly
- **Dark / light** — system-aware, one-click toggle
- **Date picker** — quick shortcuts (today, tomorrow, monday) + natural language + mini calendar
- **File attachments** — drag or click to attach files to any task
- **Keyboard shortcuts** — `n` to add, `Esc` to close, `Cmd+K` to search
- **"You're floating"** — the state you reach when every task is done

## Stack

```
SvelteKit 5 + Tailwind ──► Caddy ──► Axum (Rust) ──► PostgreSQL
```

| Layer | Technology |
|-------|-----------|
| Frontend | SvelteKit 5, Tailwind CSS, Inter font |
| Backend | Rust, Axum, SeaORM, JWT auth |
| Database | PostgreSQL 16 (UUID primary keys) |
| Proxy | Caddy |
| Deploy | Docker Compose, Cloudflare Tunnel |

## Self-hosting

### Prerequisites

- Docker + Docker Compose
- A domain with Cloudflare (optional, for HTTPS)

### Deploy

```bash
git clone https://github.com/Remenby31/float.git
cd float

# Generate a JWT secret
export JWT_SECRET=$(openssl rand -base64 32)

# Start everything
cd deploy
docker compose up -d
```

Float is now running on `http://localhost:8888`.

### Create your account

Registration is disabled by default (personal app). Create your user manually:

```bash
# Generate a bcrypt hash for your password
node -e "const b=require('bcryptjs');console.log(b.hashSync('your-password',10))"

# Insert into the database
docker exec float-db psql -U float -c \
  "INSERT INTO users (email, username, password_hash) \
   VALUES ('you@example.com', 'yourname', '\$2b\$10\$...');"
```

### Expose with Cloudflare Tunnel

Add to your tunnel config:

```yaml
- hostname: float.yourdomain.com
  service: http://localhost:8888
```

## Development

### Backend

```bash
# Start PostgreSQL
docker compose up db -d

# Run the API (auto-migrates on startup)
cd crates/api
cargo run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api` to `localhost:3000` (the Rust API).

### Project structure

```
float/
├── crates/
│   ├── api/           # Axum HTTP server, routes, auth
│   ├── core/          # Shared types
│   ├── db/            # SeaORM entities
│   └── migration/     # Database migrations
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── components/   # SmartInput, TaskDetail, DatePicker, CommandPalette, ColorPicker
│       │   ├── api.ts        # API client
│       │   ├── smart-input.ts # @ mention parser
│       │   ├── theme.svelte.ts
│       │   └── keyboard.ts
│       └── routes/
│           ├── login/
│           ├── register/
│           └── app/
│               ├── overview/
│               └── project/[id]/
├── deploy/
│   ├── docker-compose.yml
│   └── Caddyfile
├── float-branding/    # Design system, tokens, logo
└── README.md
```

## Design

Monochrome, dark-first, Inter. Inspired by Linear and Notion.

- No color noise — the UI is black and white, color is for your project dots
- Minimal text — the interface should be intuitive without labels
- Micro-animations — 200ms ease-out, spring on completion, stagger on load

## License

MIT
