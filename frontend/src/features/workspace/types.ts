import type { Task } from '@/types/api';

export interface DatedTask {
  task: Task;
  projectName: string;
  projectColor: string | null;
  projectIcon: string | null;
  familyId: string;
  familyName: string;
  familyColor: string | null;
  familyIcon: string | null;
}

export interface WeekDay {
  date: Date;
  label: string;
  dayNum: number;
  tasks: DatedTask[];
  overdueTasks: DatedTask[];
  isToday: boolean;
}

export interface WeekData {
  days: WeekDay[];
  later: DatedTask[];
}
