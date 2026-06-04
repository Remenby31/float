// Simple event bus for keyboard shortcuts
type Handler = () => void;
const handlers: Record<string, Handler[]> = {};

export function onShortcut(key: string, handler: Handler) {
	if (!handlers[key]) handlers[key] = [];
	handlers[key].push(handler);
	return () => {
		handlers[key] = handlers[key].filter(h => h !== handler);
	};
}

export function setupKeyboard() {
	if (typeof window === 'undefined') return;

	window.addEventListener('keydown', (e) => {
		// Don't capture when typing in inputs
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) {
			// Only Escape works in inputs
			if (e.key === 'Escape') {
				(e.target as HTMLElement).blur();
				fire('escape');
			}
			return;
		}

		const key = e.key.toLowerCase();
		const mod = e.metaKey || e.ctrlKey;

		if (mod && key === 'k') {
			e.preventDefault();
			fire('cmd+k');
			return;
		}

		if (mod && key === 'z' && !e.shiftKey) {
			e.preventDefault();
			fire('cmd+z');
			return;
		}

		if (mod && key === 'z' && e.shiftKey) {
			e.preventDefault();
			fire('cmd+shift+z');
			return;
		}

		if (key === 'n') { fire('n'); return; }
		if (key === '1') { fire('1'); return; }
		if (key === '2') { fire('2'); return; }
		if (key === 'escape') { fire('escape'); return; }
	});
}

function fire(key: string) {
	for (const h of handlers[key] || []) h();
}
