import type { Project, Task } from '@/types/api';
import type { DatedTask, WeekData, WeekDay } from '@/features/workspace/types';
import { startOfDay } from '@/features/workspace/utils/dates';

export function buildWeekData(projects: Project[], tasks: Task[], today = new Date(), visibleDone: ReadonlySet<string> = new Set()): WeekData {
  const now = startOfDay(today);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

  const dayNames = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
  const days: WeekDay[] = dayNames.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      date,
      label,
      dayNum: date.getDate(),
      tasks: [],
      overdueTasks: [],
      isToday: date.getTime() === now.getTime(),
    };
  });

  const later: DatedTask[] = [];
  const endOfWeek = new Date(monday);
  endOfWeek.setDate(monday.getDate() + 7);

  for (const task of tasks) {
    if ((task.is_done && !visibleDone.has(task.id)) || !task.due_date) continue;
    const project = projects.find((candidate) => candidate.id === task.project_id);
    const parent = project?.parent_id ? projects.find((candidate) => candidate.id === project.parent_id) : undefined;
    const family = parent ?? project;
    const datedTask: DatedTask = {
      task,
      projectName: project?.title ?? '',
      projectColor: project?.color ?? parent?.color ?? null,
      projectIcon: project?.icon ?? null,
      familyId: family?.id ?? task.project_id,
      familyName: family?.title ?? project?.title ?? '',
      familyColor: family?.color ?? null,
      familyIcon: family?.icon ?? null,
    };
    const due = startOfDay(new Date(task.due_date));

    if (due < monday) {
      days.find((day) => day.isToday)?.overdueTasks.push(datedTask);
    } else if (due >= endOfWeek) {
      later.push(datedTask);
    } else {
      const day = days.find((candidate) => candidate.date.getTime() === due.getTime());
      if (day) (due < now ? day.overdueTasks : day.tasks).push(datedTask);
    }
  }

  return { days, later };
}
