---
name: react-spa-stack
description: Use when building or migrating a React app that talks to a separate backend API — picking between Vite/Next.js/TanStack Start, setting up TanStack Router + Query, or structuring a React codebase feature-first. Covers the stack decision, folder layout, and the import rules that keep it clean.
---

# React SPA stack (app-behind-auth, separate API)

For apps where **you already own a backend** and the UI is behind auth: dashboards,
internal tools, task managers, admin panels. Not for content/SEO sites.

## 1. Pick the build tool — decide before writing code

| You need | Use |
|---|---|
| App behind auth, separate API, no SEO | **Vite + React** |
| Public pages, SEO, SSR/ISR, edge rendering | **Next.js** |
| SSR *and* you want Vite + typed routing | **TanStack Start** |

**Default to Vite.** Next.js is a server framework; if you already have an API server,
adopting it means running a second server (Node) to render pages that nobody needs
rendered. That's deployment weight, a second runtime to patch, and RSC constraints
on every component — bought for nothing.

Reach for Next.js only when a *public* page must be fast on first paint or indexed.
Reach for TanStack Start when you want that SSR but on Vite's dev loop.

**Red flag:** "we might need SSR later" is not a reason. A Vite SPA can be moved
to TanStack Start later — same Vite config, same Router. The migration is real but bounded.

## 2. The stack

```
Build        Vite
Routing      @tanstack/react-router      (file-based, fully typed)
Server state @tanstack/react-query       (the ONLY owner of API data)
Client state Zustand                     (UI toggles, drafts, prefs)
Styling      Tailwind v4                 (@tailwindcss/vite, CSS-first config)
Forms        react-hook-form + zod       (or @tanstack/react-form)
Validation   zod                         (share schemas with API types)
Tests        Vitest + Testing Library, Playwright for E2E
Lint         ESLint flat config + import/no-restricted-paths (see §4)
```

**Server state vs client state is the split that matters.** Anything that comes from
the API belongs to Query and nowhere else. Do not copy Query data into Zustand — you
will desync. Zustand holds only what the server never sees.

## 3. Router + Query: wire them once, correctly

Two caches will fight. **Turn the Router's cache off and let Query own it:**

```ts
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,   // ← Query owns freshness, not Router
})
```

Prefetch in the route loader so data is in flight before the component renders —
often before its bundle even finishes evaluating:

```ts
export const Route = createFileRoute('/projects/$projectId')({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(projectQueryOptions(params.projectId)),
  component: ProjectPage,
})

function ProjectPage() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(projectQueryOptions(projectId))  // already warm
}
```

Use `queryOptions()` factories so the key and the fetcher can never drift apart:

```ts
export const projectQueryOptions = (id: string) =>
  queryOptions({ queryKey: ['projects', id], queryFn: () => api.getProject(id) })
```

**Query key convention:** `[entity]`, `[entity, id]`, `[entity, id, sub]`. Hierarchical
keys make `invalidateQueries({ queryKey: ['projects'] })` cascade correctly.

## 4. Folder structure — feature-first, one-way imports

Follows [bulletproof-react](https://github.com/alan2207/bulletproof-react):

```
src/
├── app/              # composition root only
│   ├── routes/       # route tree (file-based)
│   ├── app.tsx
│   ├── provider.tsx  # QueryClientProvider, theme, error boundary
│   └── router.tsx
├── components/       # shared dumb UI (Button, Modal, …)
├── config/           # env vars, constants
├── features/         # ← the real code lives here
│   └── <feature>/
│       ├── api/         # query options + mutation hooks for this feature
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── types/
│       └── utils/
├── hooks/            # shared hooks
├── lib/              # configured libs (api client, query client)
├── stores/           # global client state
├── testing/          # test utils, MSW handlers
├── types/            # shared types
└── utils/
```

**Imports flow one way: `shared → features → app`.** A feature never imports another
feature. If two features need the same thing, it moves down into `components/`,
`lib/`, or `hooks/`. Enforce it in ESLint rather than in code review:

```js
'import/no-restricted-paths': ['error', { zones: [
  // features must not import from app
  { target: './src/features', from: './src/app' },
  // shared must not import from features or app
  { target: ['./src/components','./src/hooks','./src/lib','./src/types','./src/utils'],
    from: ['./src/features','./src/app'] },
  // no cross-feature imports — one zone per feature
  { target: './src/features/auth', from: './src/features', except: ['./auth'] },
]}]
```

That last zone must be repeated per feature. It's tedious and it's the rule that
actually prevents the codebase from turning into a ball of mud.

## 5. Non-obvious things that bite

- **`staleTime` defaults to 0**, so Query refetches on every mount. Set a real
  default (`60_000`) in the QueryClient or every navigation hits the network.
- **Optimistic updates need the rollback path.** `onMutate` snapshots, `onError`
  restores, `onSettled` invalidates. Skipping `onError` means a failed mutation
  leaves the UI lying.
- **One QueryClient per app, created once.** Creating it inside a component body
  makes a new cache on every render.
- **TanStack Router needs its generated route tree** (`routeTree.gen.ts`) — it's a
  build artifact from the Vite plugin. Commit it or generate it pre-build; a missing
  tree fails at runtime, not at typecheck.
- **Tailwind v4 has no `tailwind.config.js`.** Config is CSS-first via `@theme` in
  your stylesheet, plugin via `@tailwindcss/vite`. v3 tutorials will mislead you.

## 6. Migrating from another framework

Port in this order — each step ships independently:

1. **Types and API client first.** Framework-agnostic, zero risk, unblocks everything.
2. **Shell:** provider tree, router, one route rendering a placeholder.
3. **Leaf components** (dumb, no data) — mechanical.
4. **One feature end to end**, including its Query hooks. Prove the pattern.
5. **Remaining features**, then delete the old app.

Do not port the old state store. Server state becomes Query; the rest becomes
Zustand or dies. A store ported 1:1 carries the old framework's shape into the new one.
