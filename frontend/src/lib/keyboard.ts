// Simple event bus for keyboard shortcuts
type Handler = () => void;
const handlers: Record<string, Handler[]> = {};
let setupDone = false;

export function onShortcut(key: string, handler: Handler) {
	if (!handlers[key]) handlers[key] = [];
	handlers[key].push(handler);
	return () => {
		handlers[key] = handlers[key].filter(h => h !== handler);
	};
}

export function setupKeyboard() {
	if (typeof window === 'undefined' || setupDone) return;
	setupDone = true;

	window.addEventListener('keydown', (e) => {
		const el = e.target as HTMLElement;
		const tag = el?.tagName;
		const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
			|| el?.isContentEditable || !!el?.closest?.('[contenteditable]');
		if (isEditable) {
			if (e.key === 'Escape') {
				el.blur();
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

		if (key === 'escape') { fire('escape'); return; }
	});
}

function fire(key: string) {
	for (const h of handlers[key] || []) h();
}
