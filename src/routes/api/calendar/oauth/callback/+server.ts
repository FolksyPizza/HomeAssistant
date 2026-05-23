import { redirect } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getGoogleCalendarOAuthConfig } from '$lib/server/setup-config';
import type { RequestHandler } from './$types';

const TOKEN_PATH = join(process.cwd(), 'data', 'google-tokens.json');

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state') || '/settings';
	const errorParam = url.searchParams.get('error');

	if (errorParam) {
		throw redirect(302, `${state}?calendar_error=${encodeURIComponent(errorParam)}`);
	}

	if (!code) {
		throw redirect(302, `${state}?calendar_error=no_code`);
	}

	const oauth = getGoogleCalendarOAuthConfig(url.origin);

	if (!oauth.configured) {
		throw redirect(302, `${state}?calendar_error=not_configured`);
	}

	try {
		// Exchange authorization code for tokens
		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id: oauth.clientId,
				client_secret: oauth.clientSecret,
				redirect_uri: oauth.redirectUri,
				grant_type: 'authorization_code'
			})
		});

		if (!tokenResponse.ok) {
			const err = await tokenResponse.text();
			console.error('Google token exchange failed:', err);
			throw redirect(302, `${state}?calendar_error=token_exchange_failed`);
		}

		const tokens = await tokenResponse.json() as {
			access_token: string;
			refresh_token?: string;
			expires_in: number;
			scope: string;
		};

		// Fetch user email
		let email = '';
		try {
			const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: `Bearer ${tokens.access_token}` }
			});
			if (profileRes.ok) {
				const profile = await profileRes.json() as { email?: string };
				email = profile.email || '';
			}
		} catch {
			// non-fatal
		}

		// Store tokens to disk
		const stored = {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token || null,
			expires_at: Date.now() + tokens.expires_in * 1000,
			scope: tokens.scope,
			email,
			connected_at: new Date().toISOString()
		};

		await mkdir(join(process.cwd(), 'data'), { recursive: true });
		await writeFile(TOKEN_PATH, JSON.stringify(stored, null, 2), 'utf-8');

		// Redirect back with success flag
		const dest = state === 'setup' ? '/setup?step=4&calendar_connected=1' : `${state}?calendar_connected=1`;
		throw redirect(302, dest);
	} catch (error) {
		// Re-throw SvelteKit redirects
		if (error && typeof error === 'object' && 'status' in error) throw error;
		console.error('OAuth callback error:', error);
		throw redirect(302, `${state}?calendar_error=server_error`);
	}
};
