export function relativeDate(d: string | null): string {
	if (!d) return '';
	const date = new Date(d);
	const now = new Date();
	// Compare by calendar day, not raw time diff
	const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
	const dayDiff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / (1000 * 60 * 60 * 24));
	if (dayDiff === 0) return 'today';
	if (dayDiff === 1) return 'tomorrow';
	if (dayDiff === -1) return 'yesterday';
	if (dayDiff > 0 && dayDiff < 7) return date.toLocaleDateString('en', { weekday: 'short' });
	return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
