import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { submitAssistantVoiceTurn } from '$lib/server/assistant';
import type { AssistantVoiceTurnRequest } from '$lib/types';

function isEntryMode(value: unknown): value is AssistantVoiceTurnRequest['entryMode'] {
	return value === 'push-to-talk' || value === 'wake-word';
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Partial<AssistantVoiceTurnRequest>;
		if (!isEntryMode(body.entryMode)) {
			return json({ message: 'Expected `entryMode` to be `push-to-talk` or `wake-word`.' }, { status: 400 });
		}

		return json(
			await submitAssistantVoiceTurn({
				entryMode: body.entryMode,
				wakeWordPhrase: body.wakeWordPhrase,
				silenceTimeoutSeconds: body.silenceTimeoutSeconds,
				maxListenSeconds: body.maxListenSeconds,
				model: body.model,
				baseUrl: body.baseUrl,
				speakResponse: body.speakResponse
			})
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown Pi voice error';
		return json({ message }, { status: 502 });
	}
};
