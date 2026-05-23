import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAssistantHealth } from '$lib/server/assistant';

export const GET: RequestHandler = async ({ url }) => {
	try {
		return json(await getAssistantHealth(url.searchParams.get('baseUrl') ?? undefined));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown assistant error';
		return json(
			{
				reachable: false,
				baseUrl: 'http://llm-server:11434',
				modelCount: 0,
				models: [],
				defaultModel: 'llama3.2:3b',
				preferredMode: 'browser-mic',
				transcriptionProvider: 'mock-browser-hint',
				ttsProvider: 'browser-speech',
				piVoiceServiceEnabled: false,
				browserMicSupported: true,
				connections: [],
				error: message
			},
			{ status: 502 }
		);
	}
};
