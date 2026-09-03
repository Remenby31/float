import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from '@/components/icons';
import { relativeDate, timeLabel } from '@/features/workspace/utils/dates';

interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => unknown | Promise<unknown>;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [viewDate, setViewDate] = useState(() => (value ? new Date(value) : new Date()));
  const [position, setPosition] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);
  const timeValue = value ? formatInputTime(new Date(value)) : '';

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    return [
      ...Array<number | null>(firstDay === 0 ? 6 : firstDay - 1).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [viewDate]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const openPicker = () => {
    if (open) {
      setOpen(false);
      setTextInput('');
      return;
    }
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (!mobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const goUp = window.innerHeight - rect.bottom < 350;
      setPosition(
        goUp
          ? { position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: Math.min(rect.left, window.innerWidth - 272) }
          : { position: 'fixed', top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 272) },
      );
    }
    setViewDate(value ? new Date(value) : new Date());
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const setDate = async (date: Date | null) => {
    await onChange(date?.toISOString() ?? null);
    setOpen(false);
    setTextInput('');
  };

  const setRelativeDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    void setDate(date);
  };

  const setNextMonday = () => {
    const date = new Date();
    const difference = date.getDay() === 0 ? 1 : 8 - date.getDay();
    date.setDate(date.getDate() + difference);
    date.setHours(9, 0, 0, 0);
    void setDate(date);
  };

  const applyTime = (time: string) => {
    if (!value || !time) return;
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date(value);
    date.setHours(hours, minutes, 0, 0);
    void onChange(date.toISOString());
  };

  const clearTime = () => {
    if (!value) return;
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    void onChange(date.toISOString());
  };

  const submitText = () => {
    const date = parseTextDate(textInput, value);
    if (date) void setDate(date);
  };

  return (
    <div>
      <button
        ref={triggerRef}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
          value ? 'border-border-strong bg-surface text-text' : 'border-border text-text-muted hover:bg-surface/60 hover:text-text-secondary'
        }`}
        onClick={openPicker}
        type="button"
      >
        <CalendarIcon size={12} />
        {value ? `${relativeDate(value, { long: true })}${timeLabel(value) ? ` ${timeLabel(value)}` : ''}` : 'set date'}
      </button>

      {open
        ? createPortal(
            <>
              <button
                aria-label="close date picker"
                className={`fixed inset-0 z-[75] ${isMobile ? 'bg-black/50 backdrop-blur-[2px]' : ''}`}
                data-floating-overlay="true"
                onClick={() => setOpen(false)}
                type="button"
              />
              <section
                className={`${isMobile ? 'modal-in fixed inset-x-0 bottom-0 z-[80] w-full rounded-t-2xl safe-bottom' : 'modal-in z-[80] w-64 rounded-xl'} overflow-hidden border border-border bg-elevated shadow-2xl`}
                data-floating-overlay="true"
                onClick={(event) => event.stopPropagation()}
                style={isMobile ? undefined : position}
              >
                <div className="flex flex-wrap gap-1.5 border-b border-border p-2">
                  <QuickDate label="today" onClick={() => setRelativeDate(0)} />
                  <QuickDate label="tomorrow" onClick={() => setRelativeDate(1)} />
                  <QuickDate label="monday" onClick={setNextMonday} />
                  <QuickDate label="next week" onClick={() => setRelativeDate(7)} />
                  {value ? <button className="rounded-lg px-2.5 py-1 text-xs text-text-muted hover:text-danger" onClick={() => void setDate(null)} type="button">clear</button> : null}
                </div>

                <div className="border-b border-border p-2">
                  <input
                    ref={inputRef}
                    className="field !rounded-lg !px-2.5 !py-1.5 !text-xs"
                    onChange={(event) => setTextInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitText();
                      }
                    }}
                    placeholder="fri, 3d, jun 15, 15h, 3pm..."
                    value={textInput}
                  />
                </div>

                {value ? (
                  <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
                    <ClockIcon className="shrink-0 text-text-muted" size={11} />
                    <div className="flex gap-1">
                      {['09:00', '12:00', '14:00', '17:00'].map((time) => (
                        <button
                          className={`rounded px-1.5 py-0.5 text-[10px] ${timeValue === time ? 'bg-accent text-accent-fg' : 'bg-surface text-text-muted hover:text-text'}`}
                          key={time}
                          onClick={() => applyTime(time)}
                          type="button"
                        >
                          {time.replace(':00', 'h')}
                        </button>
                      ))}
                    </div>
                    <input className="ml-auto w-[76px] rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-text outline-none" onChange={(event) => applyTime(event.target.value)} type="time" value={timeValue} />
                    {timeValue ? <button className="text-[10px] text-text-muted hover:text-danger" onClick={clearTime} type="button">×</button> : null}
                  </div>
                ) : null}

                <div className="p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <button aria-label="previous month" className="icon-button !h-5 !w-5" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} type="button"><ChevronLeftIcon size={10} /></button>
                    <span className="text-[11px] font-medium text-text-secondary">{viewDate.toLocaleDateString('en', { month: 'long', year: 'numeric' }).toLowerCase()}</span>
                    <button aria-label="next month" className="icon-button !h-5 !w-5" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} type="button"><ChevronRightIcon size={10} /></button>
                  </div>
                  <div className="mb-1 grid grid-cols-7">
                    {['m', 't', 'w', 't', 'f', 's', 's'].map((day, index) => <div className="py-0.5 text-center text-[9px] text-text-muted" key={`${day}-${index}`}>{day}</div>)}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) =>
                      day ? (
                        <button
                          className={`aspect-square rounded-md text-[11px] transition ${isSelected(day, viewDate, value) ? 'bg-accent font-medium text-accent-fg' : isToday(day, viewDate) ? 'font-medium text-text ring-1 ring-border-strong' : 'text-text-secondary hover:bg-surface hover:text-text'}`}
                          key={`${day}-${index}`}
                          onClick={() => void setDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 9, 0, 0))}
                          type="button"
                        >
                          {day}
                        </button>
                      ) : <span key={`empty-${index}`} />,
                    )}
                  </div>
                </div>
              </section>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function QuickDate({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="rounded-lg bg-surface px-2.5 py-1 text-xs text-text-secondary hover:bg-tertiary hover:text-text" onClick={onClick} type="button">{label}</button>;
}

function formatInputTime(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return hours || minutes ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}` : '';
}

function isToday(day: number, viewDate: Date) {
  const today = new Date();
  return day === today.getDate() && viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
}

function isSelected(day: number, viewDate: Date, value: string | null) {
  if (!value) return false;
  const selected = new Date(value);
  return day === selected.getDate() && viewDate.getMonth() === selected.getMonth() && viewDate.getFullYear() === selected.getFullYear();
}

function parseTextDate(text: string, currentValue: string | null): Date | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  const addDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(9, 0, 0, 0);
    return date;
  };
  const nextWeekday = (day: number) => {
    const date = new Date();
    let difference = day - date.getDay();
    if (difference <= 0) difference += 7;
    date.setDate(date.getDate() + difference);
    date.setHours(9, 0, 0, 0);
    return date;
  };
  const aliases: Record<string, () => Date> = {
    today: () => addDays(0),
    "aujourd'hui": () => addDays(0),
    tomorrow: () => addDays(1),
    demain: () => addDays(1),
    monday: () => nextWeekday(1), lundi: () => nextWeekday(1),
    tuesday: () => nextWeekday(2), mardi: () => nextWeekday(2),
    wednesday: () => nextWeekday(3), mercredi: () => nextWeekday(3),
    thursday: () => nextWeekday(4), jeudi: () => nextWeekday(4),
    friday: () => nextWeekday(5), vendredi: () => nextWeekday(5),
    saturday: () => nextWeekday(6), samedi: () => nextWeekday(6),
    sunday: () => nextWeekday(0), dimanche: () => nextWeekday(0),
  };
  if (aliases[value]) return aliases[value]();
  const relative = value.match(/^(\d+)\s*(d|j|w|s)$/);
  if (relative) return addDays(Number(relative[1]) * (relative[2] === 'w' || relative[2] === 's' ? 7 : 1));
  const time = value.match(/^(\d{1,2})h(\d{2})?$/) ?? value.match(/^(\d{1,2}):(\d{2})$/);
  if (time && currentValue) {
    const date = new Date(currentValue);
    date.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0);
    return date;
  }
  const ampm = value.match(/^(\d{1,2})(am|pm)$/);
  if (ampm && currentValue) {
    let hours = Number(ampm[1]);
    if (ampm[2] === 'pm' && hours < 12) hours += 12;
    if (ampm[2] === 'am' && hours === 12) hours = 0;
    const date = new Date(currentValue);
    date.setHours(hours, 0, 0, 0);
    return date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
