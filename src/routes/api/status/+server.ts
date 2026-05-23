import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDisplayStatus } from '$lib/server/status';

export const GET: RequestHandler = async () => {
	try {
		return json(await getDisplayStatus());
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown status error';
		return json(
			{
				updatedAt: new Date().toISOString(),
				quickSummary: 'Display status is temporarily unavailable.',
				cards: [],
				connections: [],
				error: message
			},
			{ status: 502 }
		);
	}
};
