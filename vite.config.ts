import fs from 'node:fs';
import path from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

function resolveHttpsOptions(mode: string) {
	const env = loadEnv(mode, process.cwd(), '');

	if (env.DEV_HTTPS !== 'true') {
		return undefined;
	}

	const keyFile = path.resolve(
		env.DEV_HTTPS_KEY_FILE || path.join(process.cwd(), '.cert/dev-key.pem')
	);
	const certFile = path.resolve(
		env.DEV_HTTPS_CERT_FILE || path.join(process.cwd(), '.cert/dev-cert.pem')
	);

	if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
		console.warn(
			`HTTPS requested but certificate files were not found at ${certFile} and ${keyFile}. Falling back to HTTP.`
		);
		return undefined;
	}

	return {
		key: fs.readFileSync(keyFile),
		cert: fs.readFileSync(certFile)
	};
}

export default defineConfig(({ mode }) => {
	const https = resolveHttpsOptions(mode);

	return {
		plugins: [sveltekit()],
		server: {
			host: '0.0.0.0',
			port: 8989,
			https
		},
		preview: {
			host: '0.0.0.0',
			port: 8989,
			https
		}
	};
});
