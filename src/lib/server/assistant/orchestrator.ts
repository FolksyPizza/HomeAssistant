import { getRuntimeConfig } from '$lib/server/runtime';
import { getAudioCaptureProviders } from '$lib/server/assistant/providers/audio-capture-provider';
import {
	createOllamaConnection,
	getLlmProvider
} from '$lib/server/assistant/providers/llm-provider';
import { getPiVoiceProvider } from '$lib/server/assistant/providers/pi-voice-provider';
import { getTranscriptionProvider } from '$lib/server/assistant/providers/transcription-provider';
import { executeAssistantTool } from '$lib/server/assistant/providers/tool-executor';
import type {
	AssistantHealth,
	AssistantSessionRequest,
	AssistantTranscriptResult,
	AssistantVoiceTurnRequest,
	AssistantVoiceTurnResponse,
	AssistantTurnResponse
} from '$lib/types';

export class AssistantOrchestrator {
	private readonly llmProvider = getLlmProvider();
	private readonly transcriptionProvider = getTranscriptionProvider();
	private readonly audioProviders = getAudioCaptureProviders();
	private readonly piVoiceProvider = getPiVoiceProvider();

	async getHealth(baseUrlOverride?: string): Promise<AssistantHealth> {
		const runtime = getRuntimeConfig();
		const transcriptionConnectionPromise = this.transcriptionProvider.health();
		const piVoiceHealthPromise = this.piVoiceProvider.health();

		try {
			const [ollama, transcription, piVoice] = await Promise.all([
				this.llmProvider.getHealth(baseUrlOverride),
				transcriptionConnectionPromise,
				piVoiceHealthPromise
			]);

			return {
				reachable: true,
				baseUrl: ollama.baseUrl,
				modelCount: ollama.modelCount,
				models: ollama.models,
				defaultModel: runtime.assistant.defaultModel,
				preferredMode: runtime.assistant.preferredMode,
				transcriptionProvider: runtime.assistant.transcriptionProvider,
				ttsProvider: runtime.assistant.ttsProvider,
				piVoiceServiceEnabled: runtime.assistant.piVoiceServiceEnabled,
				browserMicSupported: runtime.featureFlags.browserMicTesting,
				connections: [
					createOllamaConnection(ollama.baseUrl, ollama.modelCount, ollama.latencyMs),
					transcription,
					...this.audioProviders.map((provider) => provider.describe()),
					piVoice.capture,
					piVoice.speech
				]
			};
		} catch (error) {
			const [transcription, piVoice] = await Promise.all([
				transcriptionConnectionPromise,
				piVoiceHealthPromise
			]);
			const message = error instanceof Error ? error.message : 'Unknown assistant error';
			return {
				reachable: false,
				baseUrl: baseUrlOverride?.trim() || runtime.assistant.ollamaBaseUrl,
				modelCount: 0,
				models: [],
				defaultModel: runtime.assistant.defaultModel,
				preferredMode: runtime.assistant.preferredMode,
				transcriptionProvider: runtime.assistant.transcriptionProvider,
				ttsProvider: runtime.assistant.ttsProvider,
				piVoiceServiceEnabled: runtime.assistant.piVoiceServiceEnabled,
				browserMicSupported: runtime.featureFlags.browserMicTesting,
				connections: [
					{
						id: 'ollama',
						label: 'Ollama',
						target: baseUrlOverride?.trim() || runtime.assistant.ollamaBaseUrl,
						state: 'offline',
						detail: message
					},
					transcription,
					...this.audioProviders.map((provider) => provider.describe()),
					piVoice.capture,
					piVoice.speech
				],
				error: message
			};
		}
	}

	async transcribe(
		audio: File,
		browserTranscriptHint?: string
	): Promise<AssistantTranscriptResult> {
		return this.transcriptionProvider.transcribe(audio, browserTranscriptHint);
	}

	async runTurn(request: AssistantSessionRequest): Promise<AssistantTurnResponse> {
		const runtime = getRuntimeConfig();
		const prompt = request.prompt.trim();
		if (!prompt) {
			throw new Error('Prompt cannot be empty.');
		}

		const toolExecution = await executeAssistantTool(prompt);
		if (toolExecution) {
			return {
				submittedPrompt: prompt,
				response: toolExecution.summary,
				model: request.model?.trim() || runtime.assistant.defaultModel,
				createdAt: new Date().toISOString(),
				transcript: request.transcript,
				connectionState: 'online',
				state: 'responding',
				responseSource: 'tool',
				toolExecution
			};
		}

		const model = request.model?.trim() || runtime.assistant.defaultModel;
		const chat = await this.llmProvider.chat({
			model,
			baseUrl: request.baseUrl,
			messages: [
				{
					role: 'system',
					content:
						'You are the voice layer for a calm Raspberry Pi smart-home display. Keep responses concise and useful. If the user is asking to create an agenda or calendar event and enough scheduling details are present, prefer direct action-oriented phrasing.'
				},
				{
					role: 'user',
					content: prompt
				}
			]
		});

		return {
			submittedPrompt: prompt,
			response: chat.response,
			model: chat.model,
			createdAt: new Date().toISOString(),
			transcript: request.transcript,
			connectionState: 'online',
			state: 'responding',
			responseSource: 'llm'
		};
	}

	async runPiVoiceTurn(request: AssistantVoiceTurnRequest): Promise<AssistantVoiceTurnResponse> {
		const capture = await this.piVoiceProvider.listen(request);
		if (!capture.transcript.trim()) {
			throw new Error('Pi-local capture completed, but Whisper did not return a transcript.');
		}

		const turn = await this.runTurn({
			prompt: capture.transcript,
			transcript: capture.transcript,
			model: request.model,
			baseUrl: request.baseUrl
		});

		const speech =
			request.speakResponse === false
				? undefined
				: await this.piVoiceProvider.speak(turn.response);

		return {
			capture,
			turn,
			speech
		};
	}
}

export function createAssistantOrchestrator(): AssistantOrchestrator {
	return new AssistantOrchestrator();
}
