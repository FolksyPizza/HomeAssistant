import { json } from '@sveltejs/kit';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getGoogleCalendarOAuthConfig } from '$lib/server/setup-config';
import type { RequestHandler } from './$types';

const TOKEN_PATH = join(process.cwd(), 'data', 'google-tokens.json');

interface StoredTokens {
	access_token: string;
	refresh_token: string | null;
	expires_at: number;
	scope: string;
	email: string;
	connected_at: string;
}

interface GoogleCalendarEvent {
	id: string;
	summary?: string;
	location?: string;
	description?: string;
	colorId?: string;
	start: { dateTime?: string; date?: string; timeZone?: string };
	end: { dateTime?: string; date?: string; timeZone?: string };
}

const CALENDAR_COLORS: Record<string, string> = {
	'1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
	'5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1',
	'9': '#5484ed', '10': '#51b749', '11': '#dc2127'
};

async function readTokens(): Promise<StoredTokens | null> {
	try {
		const raw = await readFile(TOKEN_PATH, 'utf-8');
		return JSON.parse(raw) as StoredTokens;
	} catch {
		return null;
	}
}

async function refreshAccessToken(tokens: StoredTokens, origin: string): Promise<StoredTokens | null> {
	if (!tokens.refresh_token) return null;

	const oauth = getGoogleCalendarOAuthConfig(origin);
	if (!oauth.configured) return null;

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: tokens.refresh_token,
			client_id: oauth.clientId,
			client_secret: oauth.clientSecret
		})
	});

	if (!res.ok) return null;

	const data = await res.json() as { access_token: string; expires_in: number };
	const updated: StoredTokens = {
		...tokens,
		access_token: data.access_token,
		expires_at: Date.now() + data.expires_in * 1000
	};

	try {
		await writeFile(TOKEN_PATH, JSON.stringify(updated, null, 2), 'utf-8');
	} catch {
		// non-fatal
	}

	return updated;
}

async function getValidToken(origin: string): Promise<{ token: string; email: string } | null> {
	let tokens = await readTokens();
	if (!tokens) return null;

	// Refresh if expiring within 5 minutes
	if (tokens.expires_at - Date.now() < 5 * 60 * 1000) {
		tokens = await refreshAccessToken(tokens, origin);
		if (!tokens) return null;
	}

	return { token: tokens.access_token, email: tokens.email };
}

function eventColor(colorId?: string): string {
	return colorId ? (CALENDAR_COLORS[colorId] ?? '#8ab4ff') : '#8ab4ff';
}

export const GET: RequestHandler = async ({ url }) => {
	const auth = await getValidToken(url.origin);

	if (!auth) {
		return json({ connected: false, events: [], error: 'Not connected to Google Calendar' });
	}

	const now = new Date();
	const timeMin = now.toISOString();
	const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
	const maxResults = url.searchParams.get('maxResults') || '20';

	try {
		const params = new URLSearchParams({
			timeMin,
			timeMax,
			maxResults,
			singleEvents: 'true',
			orderBy: 'startTime'
		});

		const res = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
			{ headers: { Authorization: `Bearer ${auth.token}` } }
		);

		if (!res.ok) {
			const err = await res.json() as { error?: { message?: string } };
			return json({ connected: true, events: [], error: err.error?.message || 'Calendar fetch failed' });
		}

		const data = await res.json() as { items: GoogleCalendarEvent[] };

		const events = (data.items || []).map((item) => {
			const start = item.start.dateTime || item.start.date || now.toISOString();
			const end = item.end.dateTime || item.end.date || start;
			return {
				id: item.id,
				title: item.summary || '(No title)',
				startsAt: start,
				endsAt: end,
				location: item.location || '',
				note: item.description || undefined,
				color: eventColor(item.colorId),
				createdBy: 'seed' as const
			};
		});

		return json({
			connected: true,
			email: auth.email,
			events,
			focusDay: now.toISOString().slice(0, 10),
			providerLabel: `Google · ${auth.email}`,
			nextOpenSlot: '',
			syncStatus: 'synced',
			updatedAt: new Date().toISOString()
		});
	} catch (error) {
		return json({ connected: true, events: [], error: String(error) });
	}
};

// Check connection status
export const HEAD: RequestHandler = async () => {
	const tokens = await readTokens();
	return new Response(null, {
		status: tokens ? 200 : 404,
		headers: { 'X-Calendar-Connected': tokens ? 'true' : 'false' }
	});
};

// Disconnect (delete tokens)
export const DELETE: RequestHandler = async () => {
	const { unlink } = await import('fs/promises');
	try {
		await unlink(TOKEN_PATH);
	} catch {
		// already gone
	}
	return json({ disconnected: true });
};
