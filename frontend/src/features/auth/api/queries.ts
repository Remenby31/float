import { queryOptions } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export const meQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.me(),
    queryFn: api.me,
    staleTime: 5 * 60_000,
  });
