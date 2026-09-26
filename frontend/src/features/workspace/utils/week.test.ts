import { describe, expect, it } from 'vitest';

import { buildWeekData } from '@/features/workspace/utils/week';
import type { Project, Task } from '@/types/api';

const project: Project = {
  id: 'p1',
  user_id: 'u1',
  title: 'Float',
  description: null,
  color: '#6366f1',
  icon: null,
  parent_id: null,
  is_archived: false,
  position: 0,
};

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    project_id: 'p1',
    title: 'Task',
    description: null,
    weight: 'medium',
    position: 0,
    is_done: false,
    done_at: null,
    due_date: null,
    ...overrides,
  };
}

describe('buildWeekData', () => {
  it('keeps all seven days even when there are no tasks', () => {
    const result = buildWeekData([], [], new Date('2026-09-21T12:00:00.000Z'));
    expect(result.days).toHaveLength(7);
    expect(result.days.filter((day) => day.isToday)).toHaveLength(1);
  });

  it('shows only the completed tasks explicitly kept visible for this session', () => {
    const completed = task({ id: 'done', is_done: true, due_date: '2026-09-21T09:00:00.000Z' });
    const today = new Date('2026-09-21T12:00:00.000Z');
    expect(buildWeekData([project], [completed], today).days[0].tasks).toHaveLength(0);
    const result = buildWeekData([project], [completed], today, new Set(['done']));
    expect(result.days[0].tasks[0].task.is_done).toBe(true);
  });

  it('puts overdue tasks on today and later tasks after the current week', () => {
    const result = buildWeekData(
      [project],
      [
        task({ id: 'overdue', due_date: '2026-08-30T09:00:00.000Z' }),
        task({ id: 'later', due_date: '2026-09-09T09:00:00.000Z' }),
      ],
      new Date('2026-09-03T12:00:00.000Z'),
    );

    expect(result.days.find((day) => day.isToday)?.overdueTasks.map((item) => item.task.id)).toContain('overdue');
    expect(result.later.map((item) => item.task.id)).toContain('later');
  });
});
