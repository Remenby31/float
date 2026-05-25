let current = $state<'dark' | 'light'>('dark');
let initialized = false;

export function getTheme() {
	function init() {
		if (typeof window === 'undefined' || initialized) return;
		initialized = true;
		const stored = localStorage.getItem('float_theme');
		if (stored === 'light' || stored === 'dark') {
			current = stored;
		} else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
			current = 'light';
		}
		apply();
	}

	function toggle() {
		current = current === 'dark' ? 'light' : 'dark';
		localStorage.setItem('float_theme', current);
		apply();
	}

	function apply() {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('light', current === 'light');
	}

	return {
		get current() { return current; },
		init,
		toggle,
	};
}
