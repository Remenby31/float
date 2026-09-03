import { useEffect, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { useUiStore } from '@/stores/ui-store';

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useUiStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
