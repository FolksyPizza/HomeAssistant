import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transcribeAssistantAudio } from '$lib/server/assistant';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		return json(await transcribeAssistantAudio(formData));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown transcription error';
		return json({ message }, { status: 502 });
	}
};
