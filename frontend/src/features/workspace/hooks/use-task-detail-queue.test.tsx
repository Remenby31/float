import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTaskDetailQueue } from '@/features/workspace/hooks/use-task-detail-queue';

afterEach(cleanup);

describe('task detail mutation queue', () => {
  it('finishes each change before starting the next one', async () => {
    const { result } = renderHook(() => useTaskDetailQueue());
    let release: (value: string) => void = () => {};
    const firstResponse = new Promise<string>((resolve) => { release = resolve; });
    const firstOperation = vi.fn(() => firstResponse);
    const secondOperation = vi.fn(async () => 'second');
    const first = result.current(firstOperation);
    const second = result.current(secondOperation);
    await Promise.resolve();
    expect(firstOperation).toHaveBeenCalledOnce();
    expect(secondOperation).not.toHaveBeenCalled();
    release('first');
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(secondOperation).toHaveBeenCalledOnce();
  });

  it('reports a failed operation without blocking the next change', async () => {
    const { result } = renderHook(() => useTaskDetailQueue());
    const error = new Error('temporary outage');
    const first = result.current(async () => { throw error; });
    const second = result.current(async () => 'retry saved');
    await expect(first).rejects.toBe(error);
    await expect(second).resolves.toBe('retry saved');
  });
});
