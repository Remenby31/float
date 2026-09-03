import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSuggestions, parseInput } from '@/features/workspace/utils/smart-input';

describe('smart input', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(new Date('2026-09-03T10:00:00+02:00')));
  afterEach(() => vi.useRealTimers());

  it('parses a task title, relative date, and time', () => {
    const result = parseInput('prepare demo @demain @15h');
    expect(result.title).toBe('prepare demo');
    expect(new Date(result.due_date ?? '').getDate()).toBe(4);
    expect(new Date(result.due_date ?? '').getHours()).toBe(15);
  });

  it('keeps an unknown mention as a project hint', () => {
    expect(parseInput('write brief @float')).toMatchObject({ title: 'write brief', project: 'float' });
  });

  it('offers the same compact date completion used by the palette', () => {
    expect(getSuggestions('dem', [])[0]).toMatchObject({ type: 'date', label: 'demain' });
  });
});
