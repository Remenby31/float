import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { authToken } from '@/lib/api/client';
import { workspaceKeys } from '@/features/workspace/api/queries';

interface SyncEvent {
  kind?: 'project' | 'task' | 'attachment';
}

export function useWorkspaceSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = authToken.get();
    if (!token) return;

    let source: EventSource | undefined;
    let reconnectTimer: number | undefined;
    let stopped = false;
    let retryDelay = 1_000;

    const connect = () => {
      if (stopped) return;
      source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
      source.onopen = () => {
        retryDelay = 1_000;
      };
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as SyncEvent;
          if (event.kind === 'project') {
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.projects });
          }
          if (event.kind === 'task') {
            void queryClient.invalidateQueries({ queryKey: workspaceKeys.tasks });
          }
          if (event.kind === 'attachment') {
            void queryClient.invalidateQueries({ queryKey: ['attachments'] });
          }
        } catch {
          // Ignore malformed events and keep the stream alive.
        }
      };
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        reconnectTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30_000);
      };
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [queryClient]);
}
