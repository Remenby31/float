export interface Toast {
	id: number;
	message: string;
	type: 'error' | 'success';
}

let toasts = $state<Toast[]>([]);
let nextId = 0;

export function getToastStore() {
	function add(message: string, type: 'error' | 'success' = 'error') {
		const id = nextId++;
		toasts = [...toasts, { id, message, type }];
		setTimeout(() => {
			toasts = toasts.filter(t => t.id !== id);
		}, 4000);
	}

	function dismiss(id: number) {
		toasts = toasts.filter(t => t.id !== id);
	}

	return {
		get toasts() { return toasts; },
		error: (msg: string) => add(msg, 'error'),
		success: (msg: string) => add(msg, 'success'),
		dismiss,
	};
}
