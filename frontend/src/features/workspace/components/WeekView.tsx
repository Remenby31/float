import { useState } from 'react';

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
}

export function WeekView({ week, hoveredTaskId, onHover, onToggleDone, onOpenTask, onReschedule }: WeekViewProps) {
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

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

  return (
    <div className="week-scroll mb-8 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
      {week.days.map((day) => {
        const tasks = [...day.overdueTasks, ...day.tasks];
        const hasContent = tasks.length > 0;
        const dateIso = day.date.toISOString();
        return (
          <section
            className={`flex max-h-[310px] shrink-0 snap-center flex-col overflow-hidden rounded-2xl transition-all md:aspect-[3/4] ${
              hasContent ? 'w-[85vw] md:w-0 md:flex-1' : 'w-[60px] md:w-[60px] md:flex-none'
            } ${dropDate === dateIso ? 'border border-accent bg-accent/5' : day.isToday ? 'border border-accent/45 bg-surface/70' : hasContent ? 'border border-border bg-surface/35' : 'border border-transparent bg-surface/20'}`}
            key={dateIso}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDate(null);
            }}
            onDragOver={(event) => {
              if (!dragTask) return;
              event.preventDefault();
              setDropDate(dateIso);
            }}
            onDrop={(event) => {
              event.preventDefault();
              void dropOnDay(dateIso);
            }}
          >
            <header className={`flex items-baseline gap-1 px-2 py-2 ${hasContent ? 'border-b border-border/60' : 'flex-col items-center'}`}>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${day.isToday ? 'text-accent' : 'text-text-muted'}`}>{day.label}</span>
              <span className={`${hasContent ? 'text-base' : 'text-sm'} font-bold ${day.isToday ? 'text-text' : 'text-text-secondary'}`}>{day.dayNum}</span>
            </header>
            {hasContent ? (
              <div className="scrollbar-thin flex-1 overflow-y-auto p-0.5">
                {day.overdueTasks.map((item) => <WeekTaskRow dt={item} hoveredTaskId={hoveredTaskId} isOverdue key={item.task.id} onDragEnd={() => setDragTask(null)} onDragStart={setDragTask} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} />)}
                {day.tasks.map((item) => <WeekTaskRow dt={item} hoveredTaskId={hoveredTaskId} key={item.task.id} onDragEnd={() => setDragTask(null)} onDragStart={setDragTask} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} />)}
              </div>
            ) : null}
          </section>
        );
      })}

      {week.later.length ? (
        <section className="flex max-h-[310px] w-[85vw] shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-border bg-surface/35 md:aspect-[3/4] md:w-0 md:flex-1">
          <header className="border-b border-border/60 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">later</header>
          <div className="scrollbar-thin flex-1 overflow-y-auto p-0.5">
            {week.later.map((item) => <WeekTaskRow dt={item} hoveredTaskId={hoveredTaskId} key={item.task.id} onDragEnd={() => setDragTask(null)} onDragStart={setDragTask} onHover={onHover} onOpenTask={onOpenTask} onToggleDone={onToggleDone} showDayLabel />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

interface WeekTaskRowProps {
  dt: DatedTask;
  isOverdue?: boolean;
  showDayLabel?: boolean;
  hoveredTaskId: string | null;
  onHover: (id: string | null) => void;
  onToggleDone: (task: Task) => unknown | Promise<unknown>;
  onOpenTask: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
}

function WeekTaskRow({ dt, isOverdue = false, showDayLabel = false, hoveredTaskId, onHover, onToggleDone, onOpenTask, onDragStart, onDragEnd }: WeekTaskRowProps) {
  const time = timeLabel(dt.task.due_date ?? '');
  const tooltip = `${dt.projectName}${time ? ` · ${time}` : ''}${isOverdue ? ' · overdue' : ''}${showDayLabel && dt.task.due_date ? ` · ${dayLabel(dt.task.due_date)}` : ''}`;
  return (
    <div
      className={`group mx-0.5 my-0.5 flex cursor-pointer items-start gap-1.5 rounded-md px-1.5 py-1 transition ${hoveredTaskId === dt.task.id ? 'ring-1 ring-accent/50' : ''}`}
      draggable
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button')) onOpenTask(dt.task);
      }}
      onDragEnd={onDragEnd}
      onDragStart={() => onDragStart(dt.task)}
      onMouseEnter={() => onHover(dt.task.id)}
      onMouseLeave={() => onHover(null)}
      role="listitem"
      style={{ backgroundColor: `${dt.projectColor ?? '#525252'}15` }}
      title={tooltip}
    >
      <button aria-label="toggle done" className="touch-target relative mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition hover:border-success hover:bg-success" onClick={(event) => { event.stopPropagation(); void onToggleDone(dt.task); }} style={{ borderColor: isOverdue ? 'var(--color-danger)' : 'var(--color-border-strong)' }} type="button" />
      {dt.projectIcon ? <span className="mt-0.5 shrink-0 text-[10px]">{dt.projectIcon}</span> : <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: dt.projectColor ?? '#525252' }} />}
      <span className="min-w-0 flex-1 break-words text-xs hover:text-text-secondary">{dt.task.title}</span>
      {showDayLabel && dt.task.due_date ? <span className="shrink-0 text-[10px] text-text-muted">{dayLabel(dt.task.due_date)}</span> : null}
    </div>
  );
}
