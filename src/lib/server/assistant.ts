import { createAssistantOrchestrator } from '$lib/server/assistant/orchestrator';
import { getLlmProvider } from '$lib/server/assistant/providers/llm-provider';
import { getRuntimeConfig } from '$lib/server/runtime';
import type {
	AssistantHealth,
	AssistantSessionRequest,
	AssistantTranscriptResult,
	AssistantVoiceTurnRequest,
	AssistantVoiceTurnResponse,
	AssistantTurnResponse,
	ServiceConnection
} from '$lib/types';

const orchestrator = createAssistantOrchestrator();

export async function getAssistantHealth(baseUrlOverride?: string): Promise<AssistantHealth> {
	return orchestrator.getHealth(baseUrlOverride);
}

export async function proxyOllamaChat(body: unknown, baseUrlOverride?: string): Promise<Response> {
	const health = await getLlmProvider().getHealth(baseUrlOverride);
	const target = new URL('/api/chat', health.baseUrl);

	return fetch(target, {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(90000)
	});
}

export async function transcribeAssistantAudio(formData: FormData): Promise<AssistantTranscriptResult> {
	const audio = formData.get('audio');
	const browserTranscriptHint = formData.get('browserTranscriptHint');

	if (!(audio instanceof File)) {
		throw new Error('Expected an audio file upload.');
	}

	return orchestrator.transcribe(
		audio,
		typeof browserTranscriptHint === 'string' ? browserTranscriptHint : undefined
	);
}

export async function submitAssistantTurn(
	request: AssistantSessionRequest
): Promise<AssistantTurnResponse> {
	return orchestrator.runTurn(request);
}

export async function submitAssistantVoiceTurn(
	request: AssistantVoiceTurnRequest
): Promise<AssistantVoiceTurnResponse> {
	return orchestrator.runPiVoiceTurn(request);
}

export function getHomeAssistantStubConnection(): ServiceConnection {
	const runtime = getRuntimeConfig();
	const configured = runtime.homeAssistant.configured;

	return {
		id: 'home-assistant',
		label: 'Home Assistant',
		target: runtime.homeAssistant.baseUrl || '',
		state: configured ? 'degraded' : 'degraded',
		detail: configured
			? 'Home Assistant is set up and ready to connect.'
			: 'Add your Home Assistant details in Settings.'
	};
}
