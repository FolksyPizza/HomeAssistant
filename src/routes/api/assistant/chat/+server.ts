import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { proxyOllamaChat } from '$lib/server/assistant';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			model?: string;
			messages?: unknown[];
			baseUrl?: string;
			[key: string]: unknown;
		};

		if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || !body.model) {
			return json(
				{ message: 'Expected a JSON body with model and messages.' },
				{ status: 400 }
			);
		}

		const response = await proxyOllamaChat(
			{
				...body,
				baseUrl: undefined
			},
			body.baseUrl
		);
		const payload = await response.json();
		return json(payload, { status: response.status });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown assistant error';
		return json({ message }, { status: 502 });
	}
};
