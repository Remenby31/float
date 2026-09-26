import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';

import { ToastViewport } from '@/components/ToastViewport';
import { Brand } from '@/components/Brand';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: ({ error, reset }) => (
    <main className="state-page">
      <section className="state-content">
        <Brand />
        <h1 className="display-title">A small<br />pause.</h1>
        <p>Something didn’t load. Let’s give it another go.</p>
        <p className="break-words text-xs">{error.message}</p>
        <button className="primary-button mt-5 px-4" onClick={reset} type="button">try again</button>
      </section>
    </main>
  ),
  notFoundComponent: () => (
    <main className="state-page">
      <section className="state-content"><Brand /><h1 className="display-title">Off the<br />page.</h1><p>There’s nothing at this address. Your tasks are right where you left them.</p><a className="primary-button" href="/app">Back to your workspace ↗</a></section>
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
