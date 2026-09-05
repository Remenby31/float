# React Frontend Migration Spec

## Status

Draft. This document prepares a future migration of Float's frontend from SvelteKit 5 to React, while keeping the Rust API and the current self-hosted deployment model.

## Why Migrate

Float is becoming interaction-heavy: command palette, keyboard-first creation, rich task editing, date parsing, drag and drop, sync, optimistic updates, and PWA behavior. These areas are exactly where React's ecosystem is deepest.

The goal is not to rewrite for novelty. The goal is to reduce long-term UI friction:

- More mature primitives for focus management, popovers, dialogs, menus, and keyboard navigation.
- A larger component ecosystem for product UI.
- More shared mental models and easier future hiring/collaboration.
- Cleaner server-state handling with TanStack Query.
- A migration path that preserves the Rust backend and the current product behavior.

## Non-Goals

- Do not rewrite the Rust API during the frontend migration.
- Do not switch to a fullstack JavaScript backend.
- Do not adopt Next.js unless Float gains SEO/public-page requirements.
- Do not redesign the product from scratch during the migration.
- Do not change the database as part of the frontend migration.

## Current State

### Backend

- Rust API using Axum.
- SeaORM entities and migrations.
- JWT auth.
- SQLite in the current deploy compose:
  - `DATABASE_URL=sqlite:///app/data/float.db?mode=rwc`
- API mounted under `/api`.
- Server-sent event sync exists under the backend routes.

### Frontend

- SvelteKit 5.
- Tailwind 4.
- PWA via `vite-plugin-pwa`.
- Core app lives under:
  - `frontend/src/routes/login/+page.svelte`
  - `frontend/src/routes/app/+layout.svelte`
  - `frontend/src/routes/app/+page.svelte`
- Shared UI lives under:
  - `frontend/src/lib/components/`
- Shared client code:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/stores/data.svelte.ts`
  - `frontend/src/lib/stores/sync.ts`
  - `frontend/src/lib/keyboard.ts`
  - `frontend/src/lib/smart-input.ts`
  - `frontend/src/lib/editor/`

## Recommended Target Stack

Use React as a frontend app shell, not as a fullstack replacement.

```txt
Rust API + SeaORM + SQLite/Postgres
        |
      REST/SSE
        |
React 19 + TypeScript + Vite
TanStack Router
TanStack Query
Tailwind 4 + shadcn/ui + Radix UI
Tiptap React
Vite PWA
```

### Choices

- **React 19 + TypeScript**: stable ecosystem, excellent typing, broad library support.
- **Vite**: keeps the current fast dev-server model and avoids Next.js complexity.
- **TanStack Router**: type-safe routes, URL search params, route loaders, good fit for an app-like UI.
- **TanStack Query**: server-state cache, optimistic mutations, retries, invalidation, and background refetch.
- **Tailwind 4**: preserve the existing styling approach.
- **shadcn/ui + Radix UI**: owned component code plus robust accessible primitives.
- **React Aria**: reserve for components that need especially precise keyboard/focus behavior.
- **Tiptap React**: keep the editor domain model while replacing Svelte bindings.
- **Vite PWA**: preserve installability and offline update behavior.

## Proposed Directory Layout

Create a new frontend directory first, keep the current Svelte frontend intact until parity is reached.

```txt
float/
├── frontend/              # current SvelteKit frontend, kept during migration
├── frontend-react/        # new React frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── router.tsx
│   │   │   ├── query-client.ts
│   │   │   └── providers.tsx
│   │   ├── routes/
│   │   │   ├── login.tsx
│   │   │   └── app.tsx
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── queries.ts
│   │   ├── components/
│   │   │   ├── command-palette/
│   │   │   ├── date-picker/
│   │   │   ├── editor/
│   │   │   ├── task-detail/
│   │   │   └── week-view/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── tasks/
│   │   │   └── sync/
│   │   ├── lib/
│   │   │   ├── keyboard.ts
│   │   │   ├── smart-input.ts
│   │   │   ├── dates.ts
│   │   │   └── cn.ts
│   │   ├── styles/
│   │   │   └── app.css
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── deploy/
```

When parity is reached, either:

- Rename `frontend-react/` to `frontend/`, or
- Update Dockerfiles and compose to build `frontend-react/`.

## API Strategy

Start by porting `frontend/src/lib/api.ts` into `frontend-react/src/api/client.ts`.

Keep the REST surface unchanged:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/projects`
- `POST /api/projects`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/tasks`
- `POST /api/projects/:projectId/tasks`
- `PUT /api/projects/:projectId/tasks/:id`
- `DELETE /api/projects/:projectId/tasks/:id`
- Attachments and labels unchanged.

Use TanStack Query as the state boundary:

- `useProjects()`
- `useTasks()`
- `useCreateTask()`
- `useUpdateTask()`
- `useDeleteTask()`
- `useMoveTask()`
- `useReorderTasks()`
- `useReorderProjects()`
- `useMe()`

Do not recreate the Svelte global store directly. In React, server state should live in TanStack Query, while local UI state should live near the components that own it.

## State Model

### Server State

TanStack Query owns:

- User session validation.
- Projects.
- Tasks.
- Labels.
- Attachments.
- Refetch/invalidation.
- Optimistic task/project mutations.

### Client State

Local React state owns:

- Command palette open state.
- Active command palette mode.
- Date picker open state.
- Task detail drawer/modal state.
- Sidebar state.
- Hover/drag state.
- Undo/redo stack.

### Undo/Redo

Keep undo/redo as a small app-level client store, but make every action call TanStack Query mutations.

Candidate implementation:

- Zustand for undo/redo and UI-only global state.
- Or a small React context if the state remains tiny.

Do not use Redux.

## Route Map

The current app can map to:

```txt
/login
/app
/app?project=<projectId>
/app?task=<taskId>
/app?date=<yyyy-mm-dd>
```

Avoid adding many routes too early. Float currently behaves like one dense workspace. URL search params are enough for selected task/project/date state.

TanStack Router should own:

- Auth guard for `/app`.
- Redirect to `/login` when token is missing or `/auth/me` fails.
- Search params for selected task/project/date.

## Component Migration Map

| Svelte Component | React Target | Notes |
|---|---|---|
| `CommandPalette.svelte` | `components/command-palette/CommandPalette.tsx` | Use Radix Dialog/Command-style primitives or cmdk. Must preserve Tab/Enter behavior. |
| `DatePicker.svelte` | `components/date-picker/DatePicker.tsx` | Consider React Aria for keyboard/calendar behavior. |
| `SmartInput.svelte` | `components/smart-input/SmartInput.tsx` | Port parser first, UI second. |
| `TaskDetail.svelte` | `components/task-detail/TaskDetail.tsx` | Drawer/dialog state should be URL-addressable later. |
| `NoteEditor.svelte` | `components/editor/NoteEditor.tsx` | Use Tiptap React. |
| `WeekView.svelte` | `components/week-view/WeekView.tsx` | Keep current layout behavior. |
| `WeekTaskRow.svelte` | `components/week-view/WeekTaskRow.tsx` | Convert row to semantic buttons where possible. |
| `ColorPicker.svelte` | `components/color-picker/ColorPicker.tsx` | Radix Popover/Menu candidate. |
| `ToastContainer.svelte` | `components/toast/ToastProvider.tsx` | Use Sonner or Radix Toast. |
| `DeleteConfirmModal.svelte` | `components/dialogs/DeleteConfirmDialog.tsx` | Radix AlertDialog. |

## UX Requirements To Preserve

### Command Palette

The React version must preserve the recent UX decisions:

- `Cmd+K` / `Ctrl+K` opens the palette.
- Typing text creates a task candidate.
- `@dem`, `@tom`, `@15h`, etc. show suggestions.
- `Tab` or `Enter` accepts an `@` suggestion.
- `Tab` or `Enter` enters create mode.
- Project selection accepts `Tab` or `Enter`.
- After selecting a project, focus returns to the task input.
- The user can keep editing the task after choosing a project.
- No visible `Create` button in compact create mode.
- No persistent shortcut footer in create mode.
- Project selection collapses into a compact chip.
- `Escape` closes the project picker first, then exits create mode, then closes the palette.

### Main Workspace

- Preserve the current dense task/project overview.
- Keep inline completion fast.
- Keep project groups and leaf-project task ownership.
- Keep command palette as the primary fast-entry flow.
- Keep light/dark theme.

### Mobile

- Preserve touch target size.
- Keep sidebar behavior.
- Ensure command palette remains usable on small screens.

## Implementation Phases

### Phase 0: Prep

- Add this spec.
- Decide whether React lives in `frontend-react/` or replaces `frontend/` immediately.
- Add a short ADR once the final stack is confirmed.
- Capture screenshots of current key flows:
  - Login.
  - Main app.
  - Command palette search.
  - Command palette create flow.
  - Date picker.
  - Task detail/editor.

### Phase 1: React Shell

- Scaffold `frontend-react/` with Vite + React + TypeScript.
- Add Tailwind 4.
- Add TanStack Router and Query.
- Add base app providers.
- Add auth token handling.
- Add `/login` and `/app` route guard.
- Wire Dockerfile locally but do not deploy yet.

Acceptance:

- Can log in against existing `/api`.
- Can load `/app`.
- Can render placeholder app shell.

### Phase 2: API And Data Layer

- Port API types and client.
- Add TanStack Query hooks.
- Add optimistic mutation patterns for:
  - Create task.
  - Update task.
  - Complete task.
  - Move task.
  - Delete task.
  - Update project.
- Port SSE sync integration and invalidate affected queries.

Acceptance:

- Project/task data loads.
- Mutations update UI immediately and recover on failure.
- SSE refreshes data without manual reload.

### Phase 3: Main Workspace Parity

- Port app layout.
- Port sidebar/project list.
- Port main project/task overview.
- Port week view.
- Port theme.
- Port basic task completion/edit flows.

Acceptance:

- Existing production tasks/projects render correctly.
- Completing/restoring tasks works.
- Project grouping matches Svelte UI.
- No regressions in desktop/mobile layout.

### Phase 4: Command Palette First-Class

- Implement command palette in React.
- Prefer Radix Dialog + cmdk or a custom command list using Radix primitives.
- Treat keyboard behavior as a testable contract.
- Port `smart-input.ts`.
- Add Playwright tests specifically for keyboard flow.

Acceptance:

- The UX requirements in "Command Palette" all pass.
- Playwright validates `@dem` + `Tab` + project `Tab` + continued editing.
- No task is created during non-submit smoke tests.

### Phase 5: Editor, Date Picker, Attachments

- Port Tiptap editor to React.
- Port date picker, ideally with React Aria for robust keyboard behavior.
- Port attachments UI.
- Port color picker.
- Port delete dialogs and toasts.

Acceptance:

- Task detail supports title, description, date, done state, project move, attachments.
- Editor content round-trips with existing backend data.
- Date picker handles shortcuts and typed dates.

### Phase 6: Deployment Cutover

- Update Dockerfile and compose to build React frontend.
- Keep the same public hostname.
- Deploy to mini PC.
- Run production Playwright smoke tests.
- Keep the Svelte frontend branch/tag for rollback.

Acceptance:

- `https://float.remenby.fr` serves the React app.
- Login works.
- Main app loads real data.
- Command palette smoke passes.
- Docker Compose shows all services `Up`.

## Testing Strategy

### Unit Tests

Use Vitest for:

- `smart-input` parsing.
- Date helpers.
- API client error handling.
- Query hook utilities if separated from React components.

### Component Tests

Use Testing Library for:

- Command palette state transitions.
- Date picker keyboard navigation.
- Task row actions.
- Dialog/confirmation behavior.

### Playwright Tests

Required production smoke flows:

- Login with `.secrets` credentials.
- Open command palette with `Cmd+K`/`Ctrl+K`.
- Type a task with `@dem`.
- Accept date suggestion with `Tab`.
- Enter create mode with `Tab`.
- Select a project with `Tab`.
- Confirm task input remains focused and editable.
- Verify compact UI:
  - no visible `Create` button,
  - no old footer,
  - no persistent project picker after selection,
  - project chip visible.
- Close without creating a real task.

## Migration Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Big-bang rewrite stalls | High | Keep Svelte frontend live; migrate in `frontend-react/` until parity. |
| UI behavior drifts | High | Screenshot current flows and write Playwright parity tests. |
| Command palette regressions | High | Treat keyboard flow as a contract with tests before deployment. |
| State duplication | Medium | Use TanStack Query for server state, local state for UI state. |
| PWA cache serves old bundle | Medium | Version service worker and smoke test in fresh browser context. |
| Docker cutover breaks deploy | Medium | Keep old frontend Dockerfile/compose path available for rollback. |
| Design gets noisier | Medium | Preserve current dense, quiet, work-focused UI. |

## Rollback Plan

Until the React app is proven:

- Keep the Svelte frontend deployable.
- Do not delete `frontend/`.
- Make the React cutover a single deploy change.
- Tag the last Svelte production commit.
- If React deploy fails:
  - revert Dockerfile/compose to Svelte frontend,
  - rebuild on mini PC,
  - rerun the current production smoke test.

## Definition Of Done

The migration is done only when:

- React app is deployed on `https://float.remenby.fr`.
- All current user-facing flows have parity.
- Command palette keyboard flow is at least as good as the current Svelte implementation.
- Production Playwright smoke tests pass.
- Svelte frontend is either removed intentionally or kept only as archived reference.
- README and deployment docs match the new frontend.

## First Concrete PR

Suggested first PR:

1. Add `frontend-react/` scaffold.
2. Add React, Vite, TypeScript, Tailwind 4.
3. Add TanStack Router and Query.
4. Port `api.ts` types/client.
5. Implement login and guarded empty `/app`.
6. Add a basic Playwright login smoke against local dev.

This keeps the first step small, reversible, and valuable.
