# Float frontend

React 19 SPA built with Vite, TanStack Router, TanStack Query, Tailwind 4, Zustand, and TipTap 3.

```bash
npm ci
npm run dev
npm run check
```

The dev server proxies `/api` to `http://localhost:3000`. Set `FLOAT_API_PROXY_TARGET` to use another API origin during integration testing.

Server data is owned by TanStack Query. UI-only state and undo/redo live in Zustand. Feature modules do not import one another; composition belongs in `src/app` and `src/routes`.
