import { createFileRoute, redirect } from '@tanstack/react-router';

import { authToken } from '@/lib/api/client';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: authToken.get() ? '/app' : '/login' });
  },
});
