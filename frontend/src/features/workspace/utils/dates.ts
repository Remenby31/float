export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function relativeDate(value: string | null, options?: { long?: boolean }): string {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const dayDiff = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);

  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'tomorrow';
  if (dayDiff === -1) return 'yesterday';

  const style = options?.long ? 'long' : 'short';
  if (dayDiff > 0 && dayDiff < 7) {
    const name = date.toLocaleDateString('en', { weekday: style });
    return options?.long ? name.toLowerCase() : name;
  }

  const result = date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  return options?.long ? result.toLowerCase() : result;
}

export function timeLabel(value: string): string {
  const date = new Date(value);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  if (!hours && !minutes) return '';
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function dayLabel(value: string): string {
  return new Date(value).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
