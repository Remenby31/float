export function startOfDay(d: Date): Date {
	const r = new Date(d);
	r.setHours(0, 0, 0, 0);
	return r;
}

export function relativeDate(d: string | null, opts?: { long?: boolean }): string {
	if (!d) return '';
	const date = new Date(d);
	const now = new Date();
	const dayDiff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24));
	if (dayDiff === 0) return 'today';
	if (dayDiff === 1) return 'tomorrow';
	if (dayDiff === -1) return 'yesterday';
	const style = opts?.long ? 'long' : 'short';
	if (dayDiff > 0 && dayDiff < 7) {
		const name = date.toLocaleDateString('en', { weekday: style });
		return opts?.long ? name.toLowerCase() : name;
	}
	const result = date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
	return opts?.long ? result.toLowerCase() : result;
}

export function timeLabel(d: string): string {
	const date = new Date(d);
	const h = date.getHours();
	const m = date.getMinutes();
	if (!h && !m) return '';
	return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function dayLabel(d: string): string {
	const date = new Date(d);
	return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
}
