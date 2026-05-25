export function relativeDate(d: string | null): string {
	if (!d) return '';
	const date = new Date(d);
	const now = new Date();
	const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
	if (diff === 0) return 'today';
	if (diff === 1) return 'tomorrow';
	if (diff === -1) return 'yesterday';
	if (diff > 0 && diff < 7) return date.toLocaleDateString('en', { weekday: 'short' });
	return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
