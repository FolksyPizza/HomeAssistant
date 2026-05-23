import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transcribeAssistantAudio } from '$lib/server/assistant';

/**
 * Test endpoint for transcription using JSON instead of form data
 *
 * This endpoint allows programmatic testing of the transcription API
 * without CSRF protection by using JSON POST instead of form submissions.
 *
 * POST body:
 * {
 *   "audioBase64": "base64-encoded audio data",
 *   "audioFileName": "test.wav",
 *   "browserTranscriptHint": "optional hint"
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json() as {
			audioBase64?: string;
			audioFileName?: string;
			browserTranscriptHint?: string;
		};

		if (!body.audioBase64) {
			return json({ message: 'Expected audioBase64 in request body' }, { status: 400 });
		}

		// Decode base64 audio to Buffer
		const audioBuffer = Buffer.from(body.audioBase64, 'base64');

		// Create FormData and append the audio buffer as a Blob-like object
		const formData = new FormData();

		// Create a Blob from the buffer
		const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
		formData.append('audio', audioBlob, body.audioFileName || 'audio.wav');
		formData.append('browserTranscriptHint', body.browserTranscriptHint || '');

		// Call the same transcription function as the regular endpoint
		const result = await transcribeAssistantAudio(formData as any);

		return json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown transcription error';
		console.error('Transcribe-test endpoint error:', message, error);
		return json({ message }, { status: 502 });
	}
};
