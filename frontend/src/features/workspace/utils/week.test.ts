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
