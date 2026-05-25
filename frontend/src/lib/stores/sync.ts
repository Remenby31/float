type DataStore = {
	refreshProjects: () => Promise<void>;
	refreshTasks: () => Promise<void>;
	refreshAll: () => Promise<void>;
};

export function startSync(store: DataStore): () => void {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('float_token') : null;
	if (!token) return () => {};

	let es: EventSource | null = null;
	let retryDelay = 1000;

	function connect() {
		es = new EventSource(`/api/events?token=${encodeURIComponent(token!)}`);

		es.onopen = () => {
			retryDelay = 1000; // reset backoff on success
		};

		es.onmessage = (e) => {
			try {
				const event = JSON.parse(e.data);
				if (event.kind === 'project') store.refreshProjects();
				if (event.kind === 'task') store.refreshTasks();
				if (event.kind === 'attachment') store.refreshTasks();
			} catch {
				// ignore parse errors
			}
		};

		es.onerror = () => {
			es?.close();
			// Exponential backoff reconnection
			setTimeout(() => {
				retryDelay = Math.min(retryDelay * 2, 30000);
				connect();
			}, retryDelay);
		};
	}

	connect();

	return () => {
		es?.close();
		es = null;
	};
}
