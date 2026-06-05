const CACHE_NAME = 'float-v1';
const APP_SHELL = [
	'/',
	'/app',
	'/login',
	'/manifest.json',
	'/favicon.svg',
	'/icon-192.png',
	'/icon-512.png',
];

// Install: cache app shell (don't skipWaiting — let the update prompt handle it)
self.addEventListener('install', (e) => {
	e.waitUntil(
		caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
	);
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
		)
	);
	self.clients.claim();
});

// Skip waiting when told by the page
self.addEventListener('message', (e) => {
	if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch strategy
self.addEventListener('fetch', (e) => {
	const url = new URL(e.request.url);

	// API calls: network-first, cache fallback for GET only
	if (url.pathname.startsWith('/api/')) {
		if (e.request.method !== 'GET') return; // let mutations pass through
		e.respondWith(
			fetch(e.request)
				.then(res => {
					const clone = res.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
					return res;
				})
				.catch(() => caches.match(e.request))
		);
		return;
	}

	// Static assets & pages: cache-first, network fallback
	e.respondWith(
		caches.match(e.request).then(cached => {
			if (cached) return cached;
			return fetch(e.request).then(res => {
				// Cache successful responses for static assets
				if (res.ok && (url.pathname.match(/\.(js|css|woff2?|png|svg|jpg|ico)$/) || url.pathname.startsWith('/app'))) {
					const clone = res.clone();
					caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
				}
				return res;
			}).catch(() => {
				// Offline fallback: serve cached /app for navigation requests
				if (e.request.mode === 'navigate') {
					return caches.match('/app');
				}
			});
		})
	);
});
