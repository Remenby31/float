import { createFileRoute, redirect } from '@tanstack/react-router';

import { LoginPage } from '@/features/auth/components/LoginPage';
import { meQueryOptions } from '@/features/auth/api/queries';
import { authToken } from '@/lib/api/client';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    if (!authToken.get()) return;
    try {
      await context.queryClient.ensureQueryData(meQueryOptions());
    } catch {
      authToken.clear();
      return;
    }
    throw redirect({ to: '/app' });
  },
  component: LoginPage,
});
