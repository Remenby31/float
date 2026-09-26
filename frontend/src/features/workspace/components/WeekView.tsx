import { useState } from 'react';

import { PlusIcon } from '@/components/icons';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import type { Task } from '@/types/api';
import type { DatedTask, WeekData } from '@/features/workspace/types';
import { dayLabel, timeLabel } from '@/features/workspace/utils/dates';

interface WeekViewProps {
  week: WeekData;
  hoveredTaskId: string | null;
  onHover: (id: string | null) => void;
  onToggleDone: (task: Task) => unknown | Promise<unknown>;
  onOpenTask: (task: Task) => void;
  onReschedule: (task: Task, dueDate: string) => unknown | Promise<unknown>;
  onAddTask: (date: string) => void;
}

export function WeekView({ week, hoveredTaskId, onHover, onToggleDone, onOpenTask, onReschedule, onAddTask }: WeekViewProps) {
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const dropOnDay = async (dateIso: string) => {
    setDropDate(null);
    if (!dragTask) return;
    const date = new Date(dateIso);
    if (dragTask.due_date) {
      const current = new Date(dragTask.due_date);
      date.setHours(current.getHours(), current.getMinutes(), 0, 0);
    }
    const task = dragTask;
    setDragTask(null);
    await onReschedule(task, date.toISOString());
  };

  const renderTask = (item: DatedTask, overdue = false, later = false) => (
    <div
      className={`day-task ${hoveredTaskId === item.task.id ? 'is-hovered' : ''}`}
      draggable
      key={item.task.id}
      onDragEnd={() => { setDragTask(null); setDropDate(null); }}
      onDragStart={() => setDragTask(item.task)}
      onMouseEnter={() => onHover(item.task.id)}
      onMouseLeave={() => onHover(null)}
      role="listitem"
    >
      <TaskCheckbox checked={item.task.is_done} onClick={() => void onToggleDone(item.task)} />
      <button className={`day-task-title ${item.task.is_done ? 'task-done line-through' : ''}`} onClick={() => onOpenTask(item.task)} type="button">{item.task.title}</button>
      {overdue && !item.task.is_done ? <span className="text-[9px] text-accent">Overdue</span> : null}
      <span className="task-context" title={item.projectName}>{later && item.task.due_date ? dayLabel(item.task.due_date) : timeLabel(item.task.due_date ?? '') || item.projectName}</span>
    </div>
  );

  return (
    <div className="week-agenda">
      {week.days.map((day) => {
        const dateIso = day.date.toISOString();
        const tasks = [...day.overdueTasks, ...day.tasks];
        const open = expanded[dateIso] ?? (day.isToday || tasks.length > 0);
        const name = day.date.toLocaleDateString('en', { weekday: 'long' });
        const contentId = `day-${day.date.getFullYear()}-${day.date.getMonth()}-${day.dayNum}`;
        return (
          <section
            aria-label={name}
            className={`week-day ${day.isToday ? 'is-today' : ''} ${dropDate === dateIso ? 'is-drop-target' : ''}`}
            key={dateIso}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDate(null); }}
            onDragOver={(event) => { if (dragTask) { event.preventDefault(); setDropDate(dateIso); } }}
            onDrop={(event) => { event.preventDefault(); void dropOnDay(dateIso); }}
          >
            <h3>
              <button aria-controls={contentId} aria-expanded={open} className="day-toggle" onClick={() => setExpanded((values) => ({ ...values, [dateIso]: !open }))} type="button">
                <span className="day-heading-wrap"><span className="day-heading">{name}</span>{day.isToday ? <span className="today-label">Today</span> : null}</span>
                <span className="day-number">{String(day.dayNum).padStart(2, '0')}</span>
              </button>
            </h3>
            {open ? (
              <div className="day-content" id={contentId}>
                <p className="day-meta">{day.date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}<span aria-hidden="true"> — </span>{tasks.filter((item) => !item.task.is_done).length} to do</p>
                {tasks.length ? <div aria-label={`${name} tasks`} className="day-tasks" role="list">{day.overdueTasks.map((item) => renderTask(item, true))}{day.tasks.map((item) => renderTask(item))}</div> : <p className="day-empty">A little room to breathe.</p>}
                <button className="day-add" onClick={() => onAddTask(dateIso)} type="button"><PlusIcon size={12} />Add a new task…</button>
              </div>
            ) : null}
          </section>
        );
      })}
      {week.later.length ? (
        <section aria-label="Later" className="week-day">
          <h3 className="day-toggle"><span className="day-heading">Later</span><span className="day-number">↗</span></h3>
          <div aria-label="Later tasks" className="day-tasks" role="list">{week.later.map((item) => renderTask(item, false, true))}</div>
        </section>
      ) : null}
    </div>
  );
}
