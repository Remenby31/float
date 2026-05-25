export interface ParsedTask {
	title: string;
	due_date?: string; // ISO string
	project?: string;
}

export interface Suggestion {
	type: 'date' | 'time' | 'project';
	label: string;
	value: string;
	description?: string;
}

const DATE_KEYWORDS: { key: string; label: string; fn: () => Date }[] = [
	{ key: 'today', label: 'today', fn: () => startOfDay(new Date()) },
	{ key: 'aujourdhui', label: "aujourd'hui", fn: () => startOfDay(new Date()) },
	{ key: 'tomorrow', label: 'tomorrow', fn: () => addDays(startOfDay(new Date()), 1) },
	{ key: 'demain', label: 'demain', fn: () => addDays(startOfDay(new Date()), 1) },
	{ key: 'monday', label: 'monday', fn: () => nextDay(1) },
	{ key: 'lundi', label: 'lundi', fn: () => nextDay(1) },
	{ key: 'tuesday', label: 'tuesday', fn: () => nextDay(2) },
	{ key: 'mardi', label: 'mardi', fn: () => nextDay(2) },
	{ key: 'wednesday', label: 'wednesday', fn: () => nextDay(3) },
	{ key: 'mercredi', label: 'mercredi', fn: () => nextDay(3) },
	{ key: 'thursday', label: 'thursday', fn: () => nextDay(4) },
	{ key: 'jeudi', label: 'jeudi', fn: () => nextDay(4) },
	{ key: 'friday', label: 'friday', fn: () => nextDay(5) },
	{ key: 'vendredi', label: 'vendredi', fn: () => nextDay(5) },
	{ key: 'saturday', label: 'saturday', fn: () => nextDay(6) },
	{ key: 'samedi', label: 'samedi', fn: () => nextDay(6) },
	{ key: 'sunday', label: 'sunday', fn: () => nextDay(0) },
	{ key: 'dimanche', label: 'dimanche', fn: () => nextDay(0) },
	{ key: 'nextweek', label: 'next week', fn: () => addDays(startOfDay(new Date()), 7) },
	{ key: 'semaineprochaine', label: 'semaine prochaine', fn: () => addDays(startOfDay(new Date()), 7) },
];

function startOfDay(d: Date): Date {
	const r = new Date(d);
	r.setHours(0, 0, 0, 0);
	return r;
}

function addDays(d: Date, n: number): Date {
	const r = new Date(d);
	r.setDate(r.getDate() + n);
	return r;
}

function nextDay(dayOfWeek: number): Date {
	const now = new Date();
	const current = now.getDay();
	let diff = dayOfWeek - current;
	if (diff <= 0) diff += 7;
	return addDays(startOfDay(now), diff);
}

function parseRelativeDays(s: string): number | null {
	const m = s.match(/^(\d+)(j|d|days?|jours?)$/i);
	if (m) return parseInt(m[1]);
	return null;
}

function parseTime(s: string): { hours: number; minutes: number } | null {
	let m = s.match(/^(\d{1,2})h(\d{2})?$/);
	if (m) return { hours: parseInt(m[1]), minutes: m[2] ? parseInt(m[2]) : 0 };
	m = s.match(/^(\d{1,2}):(\d{2})$/);
	if (m) return { hours: parseInt(m[1]), minutes: parseInt(m[2]) };
	m = s.match(/^(\d{1,2})(am|pm)$/i);
	if (m) {
		let h = parseInt(m[1]);
		if (m[2].toLowerCase() === 'pm' && h < 12) h += 12;
		if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
		return { hours: h, minutes: 0 };
	}
	return null;
}

function parseDateKeyword(val: string): Date | null {
	const entry = DATE_KEYWORDS.find(d => d.key === val);
	if (entry) return entry.fn();
	return null;
}

export function parseInput(text: string): ParsedTask {
	const tokens = text.split(/\s+/);
	const titleParts: string[] = [];
	let dueDate: Date | undefined;
	let project: string | undefined;

	for (const token of tokens) {
		if (token.startsWith('@')) {
			const val = token.slice(1).toLowerCase();
			if (!val) { titleParts.push(token); continue; }

			const dateResult = parseDateKeyword(val);
			if (dateResult) { dueDate = dateResult; continue; }

			const days = parseRelativeDays(val);
			if (days !== null) { dueDate = addDays(startOfDay(new Date()), days); continue; }

			const time = parseTime(val);
			if (time) {
				if (!dueDate) dueDate = startOfDay(new Date());
				dueDate = new Date(dueDate);
				dueDate.setHours(time.hours, time.minutes);
				continue;
			}

			project = val;
			continue;
		}
		titleParts.push(token);
	}

	return {
		title: titleParts.join(' ').trim(),
		due_date: dueDate?.toISOString(),
		project,
	};
}

function formatDatePreview(d: Date): string {
	const now = new Date();
	const diff = Math.ceil((d.getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24));
	const dayName = d.toLocaleDateString('en', { weekday: 'short' });
	const dateStr = d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
	if (diff === 0) return 'today';
	if (diff === 1) return 'tomorrow';
	return `${dayName} ${dateStr}`;
}

export function getSuggestions(partial: string, projects: string[]): Suggestion[] {
	const lower = partial.toLowerCase();
	const results: Suggestion[] = [];

	for (const d of DATE_KEYWORDS) {
		if (d.key.startsWith(lower) || d.label.startsWith(lower)) {
			const date = d.fn();
			results.push({ type: 'date', label: d.label, value: d.key, description: formatDatePreview(date) });
		}
	}

	if (/^\d/.test(lower)) {
		const time = parseTime(lower);
		if (time) {
			const formatted = `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}`;
			results.push({ type: 'time', label: lower, value: lower, description: formatted });
		} else {
			for (const t of ['9h', '10h', '12h', '14h', '15h', '16h', '17h', '18h']) {
				if (t.startsWith(lower)) results.push({ type: 'time', label: t, value: t });
			}
		}
	}

	if (lower.match(/^\d+[jd]?$/)) {
		const num = parseInt(lower);
		if (num > 0 && num < 365) {
			const date = addDays(startOfDay(new Date()), num);
			results.push({ type: 'date', label: `${num}j`, value: `${num}j`, description: formatDatePreview(date) });
		}
	}

	for (const p of projects) {
		if (p.toLowerCase().startsWith(lower)) {
			results.push({ type: 'project', label: p, value: p });
		}
	}

	return results.slice(0, 8);
}
