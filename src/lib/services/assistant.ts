import type {
	AssistantHealth,
	AssistantTranscriptResult,
	AssistantVoiceTurnResponse,
	AssistantTurnResponse
} from '$lib/types';

export async function fetchAssistantHealth(
	fetcher: typeof fetch,
	baseUrl?: string
): Promise<AssistantHealth> {
	const target = baseUrl
		? `/api/assistant/health?baseUrl=${encodeURIComponent(baseUrl)}`
		: '/api/assistant/health';
	const response = await fetcher(target);

	if (!response.ok) {
		throw new Error(`Assistant health request failed with ${response.status}`);
	}

	return (await response.json()) as AssistantHealth;
}

export async function submitAssistantPrompt(
	fetcher: typeof fetch,
	input: {
		prompt: string;
		transcript?: string;
		model?: string;
		baseUrl?: string;
	}
): Promise<AssistantTurnResponse> {
	const response = await fetcher('/api/assistant/session', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message || `Assistant request failed with ${response.status}`);
	}

	return (await response.json()) as AssistantTurnResponse;
}

export async function transcribeAssistantAudio(
	fetcher: typeof fetch,
	input: {
		audio: Blob;
		filename?: string;
		browserTranscriptHint?: string;
	}
): Promise<AssistantTranscriptResult> {
	const formData = new FormData();
	formData.set('audio', input.audio, input.filename || 'clip.webm');
	if (input.browserTranscriptHint) {
		formData.set('browserTranscriptHint', input.browserTranscriptHint);
	}

	const response = await fetcher('/api/assistant/transcribe', {
		method: 'POST',
		body: formData
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message || `Transcription failed with ${response.status}`);
	}

	return (await response.json()) as AssistantTranscriptResult;
}

export async function submitAssistantVoiceTurn(
	fetcher: typeof fetch,
	input: {
		entryMode: 'push-to-talk' | 'wake-word';
		wakeWordPhrase?: string;
		silenceTimeoutSeconds?: number;
		maxListenSeconds?: number;
		model?: string;
		baseUrl?: string;
		speakResponse?: boolean;
		signal?: AbortSignal;
	}
): Promise<AssistantVoiceTurnResponse> {
	const { signal, ...body } = input;
	const response = await fetcher('/api/assistant/voice', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(body),
		signal
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message || `Pi voice request failed with ${response.status}`);
	}

	return (await response.json()) as AssistantVoiceTurnResponse;
}
