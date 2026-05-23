import { redirect } from '@sveltejs/kit';
import { getGoogleCalendarOAuthConfig } from '$lib/server/setup-config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const oauth = getGoogleCalendarOAuthConfig(url.origin);
	const from = url.searchParams.get('from') || '/settings';
	const errorDestination =
		from === 'setup'
			? '/setup?step=3&calendar_error=not_configured'
			: `${from}?calendar_error=not_configured`;

	if (!oauth.configured) {
		throw redirect(302, errorDestination);
	}

	const params = new URLSearchParams({
		client_id: oauth.clientId,
		redirect_uri: oauth.redirectUri,
		response_type: 'code',
		scope: [
			'https://www.googleapis.com/auth/calendar.readonly',
			'https://www.googleapis.com/auth/userinfo.email'
		].join(' '),
		access_type: 'offline',
		prompt: 'consent',
		state: from
	});

	throw redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};
