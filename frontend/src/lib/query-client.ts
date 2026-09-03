import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
});
