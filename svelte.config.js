import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$components: 'src/lib/components',
			$services: 'src/lib/services',
			$server: 'src/lib/server',
			$utils: 'src/lib/utils'
		},
		// Trust localhost for API testing and allow programmatic access
		csrf: {
			trustedOrigins: ['127.0.0.1:8989', 'localhost:8989', '0.0.0.0:8989']
		}
	}
};

export default config;
