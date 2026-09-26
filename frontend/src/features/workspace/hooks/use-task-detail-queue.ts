import { useCallback, useRef } from 'react';

// Task updates return the whole task and share optimistic rollback snapshots.
// Serialize detail operations, including moves, so one response cannot erase
// another edit or send a follow-up to the previous project's URL.
export function useTaskDetailQueue() {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  return useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(operation);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
}
