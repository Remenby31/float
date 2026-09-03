export interface ParsedTask {
  title: string;
  due_date?: string;
  project?: string;
}

export interface Suggestion {
  type: 'date' | 'time' | 'project';
  label: string;
  value: string;
  description?: string;
}

const DATE_KEYWORDS: { key: string; label: string; getDate: () => Date }[] = [
  { key: 'today', label: 'today', getDate: () => startOfDay(new Date()) },
  { key: 'aujourdhui', label: "aujourd'hui", getDate: () => startOfDay(new Date()) },
  { key: 'tomorrow', label: 'tomorrow', getDate: () => addDays(startOfDay(new Date()), 1) },
  { key: 'demain', label: 'demain', getDate: () => addDays(startOfDay(new Date()), 1) },
  { key: 'monday', label: 'monday', getDate: () => nextDay(1) },
  { key: 'mon', label: 'monday', getDate: () => nextDay(1) },
  { key: 'lundi', label: 'lundi', getDate: () => nextDay(1) },
  { key: 'lun', label: 'lundi', getDate: () => nextDay(1) },
  { key: 'tuesday', label: 'tuesday', getDate: () => nextDay(2) },
  { key: 'tue', label: 'tuesday', getDate: () => nextDay(2) },
  { key: 'mardi', label: 'mardi', getDate: () => nextDay(2) },
  { key: 'mar', label: 'mardi', getDate: () => nextDay(2) },
  { key: 'wednesday', label: 'wednesday', getDate: () => nextDay(3) },
  { key: 'wed', label: 'wednesday', getDate: () => nextDay(3) },
  { key: 'mercredi', label: 'mercredi', getDate: () => nextDay(3) },
  { key: 'mer', label: 'mercredi', getDate: () => nextDay(3) },
  { key: 'thursday', label: 'thursday', getDate: () => nextDay(4) },
  { key: 'thu', label: 'thursday', getDate: () => nextDay(4) },
  { key: 'jeudi', label: 'jeudi', getDate: () => nextDay(4) },
  { key: 'jeu', label: 'jeudi', getDate: () => nextDay(4) },
  { key: 'friday', label: 'friday', getDate: () => nextDay(5) },
  { key: 'fri', label: 'friday', getDate: () => nextDay(5) },
  { key: 'vendredi', label: 'vendredi', getDate: () => nextDay(5) },
  { key: 'ven', label: 'vendredi', getDate: () => nextDay(5) },
  { key: 'saturday', label: 'saturday', getDate: () => nextDay(6) },
  { key: 'sat', label: 'saturday', getDate: () => nextDay(6) },
  { key: 'samedi', label: 'samedi', getDate: () => nextDay(6) },
  { key: 'sam', label: 'samedi', getDate: () => nextDay(6) },
  { key: 'sunday', label: 'sunday', getDate: () => nextDay(0) },
  { key: 'sun', label: 'sunday', getDate: () => nextDay(0) },
  { key: 'dimanche', label: 'dimanche', getDate: () => nextDay(0) },
  { key: 'dim', label: 'dimanche', getDate: () => nextDay(0) },
  { key: 'nextweek', label: 'next week', getDate: () => addDays(startOfDay(new Date()), 7) },
  { key: 'semaineprochaine', label: 'semaine prochaine', getDate: () => addDays(startOfDay(new Date()), 7) },
];

const TIME_KEYWORDS: { key: string; label: string; hours: number; minutes: number }[] = [
  { key: 'matin', label: 'matin', hours: 9, minutes: 0 },
  { key: 'morning', label: 'morning', hours: 9, minutes: 0 },
  { key: 'midi', label: 'midi', hours: 12, minutes: 0 },
  { key: 'noon', label: 'noon', hours: 12, minutes: 0 },
  { key: 'soir', label: 'ce soir', hours: 19, minutes: 0 },
  { key: 'cesoir', label: 'ce soir', hours: 19, minutes: 0 },
  { key: 'evening', label: 'evening', hours: 19, minutes: 0 },
];

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function nextDay(dayOfWeek: number): Date {
  const now = new Date();
  let difference = dayOfWeek - now.getDay();
  if (difference <= 0) difference += 7;
  return addDays(startOfDay(now), difference);
}

function parseRelativeDays(value: string): number | null {
  const match = value.match(/^(\d+)(j|d|days?|jours?)$/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function parseTime(value: string): { hours: number; minutes: number } | null {
  const keyword = TIME_KEYWORDS.find((candidate) => candidate.key === value);
  if (keyword) return { hours: keyword.hours, minutes: keyword.minutes };

  let match = value.match(/^(\d{1,2})h(\d{2})?$/);
  if (match) return { hours: Number.parseInt(match[1], 10), minutes: match[2] ? Number.parseInt(match[2], 10) : 0 };

  match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return { hours: Number.parseInt(match[1], 10), minutes: Number.parseInt(match[2], 10) };

  match = value.match(/^(\d{1,2})(am|pm)$/i);
  if (!match) return null;
  let hours = Number.parseInt(match[1], 10);
  if (match[2].toLowerCase() === 'pm' && hours < 12) hours += 12;
  if (match[2].toLowerCase() === 'am' && hours === 12) hours = 0;
  return { hours, minutes: 0 };
}

export function parseInput(text: string): ParsedTask {
  const title: string[] = [];
  let dueDate: Date | undefined;
  let project: string | undefined;

  for (const token of text.split(/\s+/)) {
    if (!token.startsWith('@')) {
      title.push(token);
      continue;
    }

    const value = token.slice(1).toLowerCase();
    if (!value) {
      title.push(token);
      continue;
    }

    const keyword = DATE_KEYWORDS.find((candidate) => candidate.key === value);
    if (keyword) {
      dueDate = keyword.getDate();
      continue;
    }

    const relativeDays = parseRelativeDays(value);
    if (relativeDays !== null) {
      dueDate = addDays(startOfDay(new Date()), relativeDays);
      continue;
    }

    const time = parseTime(value);
    if (time) {
      dueDate ??= startOfDay(new Date());
      dueDate = new Date(dueDate);
      dueDate.setHours(time.hours, time.minutes);
      continue;
    }

    project = value;
  }

  return {
    title: title.join(' ').trim(),
    due_date: dueDate?.toISOString(),
    project,
  };
}

function formatDatePreview(date: Date): string {
  const difference = Math.ceil((date.getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
  if (difference === 0) return 'today';
  if (difference === 1) return 'tomorrow';
  return `${date.toLocaleDateString('en', { weekday: 'short' })} ${date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })}`;
}

export function getSuggestions(partial: string, projects: string[]): Suggestion[] {
  const query = partial.toLowerCase();
  const suggestions: Suggestion[] = [];

  for (const dateKeyword of DATE_KEYWORDS) {
    if (dateKeyword.key.startsWith(query) || dateKeyword.label.startsWith(query)) {
      const date = dateKeyword.getDate();
      suggestions.push({
        type: 'date',
        label: dateKeyword.label,
        value: dateKeyword.key,
        description: formatDatePreview(date),
      });
    }
  }

  for (const timeKeyword of TIME_KEYWORDS) {
    if (timeKeyword.key.startsWith(query) || timeKeyword.label.startsWith(query)) {
      suggestions.push({
        type: 'time',
        label: timeKeyword.label,
        value: timeKeyword.key,
        description: `${timeKeyword.hours.toString().padStart(2, '0')}:${timeKeyword.minutes
          .toString()
          .padStart(2, '0')}`,
      });
    }
  }

  if (/^\d/.test(query)) {
    const parsedTime = parseTime(query);
    if (parsedTime) {
      suggestions.push({
        type: 'time',
        label: query,
        value: query,
        description: `${parsedTime.hours.toString().padStart(2, '0')}:${parsedTime.minutes
          .toString()
          .padStart(2, '0')}`,
      });
    } else {
      for (const value of ['9h', '10h', '12h', '14h', '15h', '16h', '17h', '18h']) {
        if (value.startsWith(query)) suggestions.push({ type: 'time', label: value, value });
      }
    }
  }

  if (/^\d+[jd]?$/.test(query)) {
    const days = Number.parseInt(query, 10);
    if (days > 0 && days < 365) {
      const date = addDays(startOfDay(new Date()), days);
      suggestions.push({ type: 'date', label: `${days}j`, value: `${days}j`, description: formatDatePreview(date) });
    }
  }

  for (const project of projects) {
    if (project.toLowerCase().startsWith(query)) {
      suggestions.push({ type: 'project', label: project, value: project });
    }
  }

  return suggestions.slice(0, 8);
}
