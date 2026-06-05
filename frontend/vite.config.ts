import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			manifest: false, // use existing static/manifest.json
			workbox: {
				globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
				navigateFallback: '/app',
				runtimeCaching: [
					{
						urlPattern: /^\/api\//,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
							networkTimeoutSeconds: 3,
						},
					},
				],
			},
		}),
	],
});
