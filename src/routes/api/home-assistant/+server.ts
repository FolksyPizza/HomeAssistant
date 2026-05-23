import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getHomeAssistantSummary } from '$lib/server/home-assistant';

export const GET: RequestHandler = async () => {
	try {
		return json(await getHomeAssistantSummary());
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown Home Assistant error';
		return json(
			{
				connected: false,
				configured: false,
				baseUrl: '',
				updatedAt: new Date().toISOString(),
				summary: 'Home Assistant is unavailable.',
				areas: [],
				entities: [],
				error: message
			},
			{ status: 502 }
		);
	}
};
