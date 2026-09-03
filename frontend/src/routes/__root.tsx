import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

import { ToastViewport } from '@/components/ToastViewport';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: ({ error, reset }) => (
    <main className="grid min-h-screen place-items-center bg-bg px-5 text-text">
      <section className="w-full max-w-md rounded-2xl border border-border bg-elevated p-5 shadow-xl">
        <p className="text-sm font-medium">Float hit an unexpected error.</p>
        <p className="mt-2 break-words text-xs leading-5 text-text-muted">{error.message}</p>
        <button className="primary-button mt-5 px-4" onClick={reset} type="button">try again</button>
      </section>
    </main>
  ),
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center bg-bg text-text">
      <p className="text-sm text-text-muted">nothing here</p>
    </main>
  ),
});

function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastViewport />
    </>
  );
}
