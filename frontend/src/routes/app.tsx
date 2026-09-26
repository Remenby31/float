import { createFileRoute, redirect } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';

import { meQueryOptions } from '@/features/auth/api/queries';
import { WorkspaceShell } from '@/features/workspace/components/WorkspaceShell';
import { projectsQueryOptions, tasksQueryOptions } from '@/features/workspace/api/queries';
import { authToken } from '@/lib/api/client';
import { Brand } from '@/components/Brand';

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context }) => {
    if (!authToken.get()) throw redirect({ to: '/login' });
    try {
      await context.queryClient.ensureQueryData(meQueryOptions());
    } catch {
      authToken.clear();
      throw redirect({ to: '/login' });
    }
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(projectsQueryOptions()),
      context.queryClient.ensureQueryData(tasksQueryOptions()),
    ]),
  pendingComponent: () => (
    <main className="state-page">
      <div className="flex flex-col items-center gap-6" role="status"><Brand /><span className="eyebrow">Making a little room…</span><span className="spinner text-accent" aria-label="loading" /></div>
    </main>
  ),
  component: AppRoute,
});

function AppRoute() {
  const { data: user } = useSuspenseQuery(meQueryOptions());
  return <WorkspaceShell user={user} />;
}
