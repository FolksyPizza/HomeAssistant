import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { submitAssistantTurn } from '$lib/server/assistant';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			prompt?: string;
			transcript?: string;
			model?: string;
			baseUrl?: string;
		};

		if (!body?.prompt || typeof body.prompt !== 'string') {
			return json({ message: 'Expected a prompt string.' }, { status: 400 });
		}

		return json(
			await submitAssistantTurn({
				prompt: body.prompt,
				transcript: body.transcript,
				model: body.model,
				baseUrl: body.baseUrl
			})
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown assistant error';
		return json({ message }, { status: 502 });
	}
};
