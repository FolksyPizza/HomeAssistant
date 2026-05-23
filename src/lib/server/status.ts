import { getAssistantHealth, getHomeAssistantStubConnection } from '$lib/server/assistant';
import { getHomeAssistantSummary } from '$lib/server/home-assistant';
import { getRuntimeConfig } from '$lib/server/runtime';
import type { StatusResponse } from '$lib/types';

export async function getDisplayStatus(): Promise<StatusResponse> {
	const runtime = getRuntimeConfig();
	const [assistantHealth, homeAssistant] = await Promise.all([
		getAssistantHealth().catch(() => null),
		getHomeAssistantSummary().catch(() => null)
	]);

	const assistantConnection = assistantHealth?.connections.find((connection) => connection.id === 'ollama');
	const transcriptionConnection = assistantHealth?.connections.find(
		(connection) => connection.id === 'transcription'
	);

	return {
		updatedAt: new Date().toISOString(),
		quickSummary: homeAssistant?.connected
			? 'The display is connected and ready.'
			: 'The display is ready, with Home Assistant available when you are.',
		cards: [
			{
				id: 'assistant',
				title: 'Assistant',
				category: 'Voice',
				state: assistantHealth?.reachable ? 'online' : 'degraded',
				summary: assistantHealth?.reachable
					? `Ollama is online with ${assistantHealth.modelCount} model${assistantHealth.modelCount === 1 ? '' : 's'}.`
					: 'The assistant is waiting for Ollama.',
				detail: transcriptionConnection?.detail || 'Transcription status is shown on the Assistant page.',
				metrics: [
					{ label: 'Mode', value: assistantHealth?.preferredMode ?? runtime.assistant.preferredMode },
					{ label: 'Model', value: assistantHealth?.defaultModel ?? runtime.assistant.defaultModel },
					{
						label: 'Transcription',
						value: assistantHealth?.transcriptionProvider ?? runtime.assistant.transcriptionProvider
					}
				]
			},
			{
				id: 'home-assistant',
				title: 'Home Assistant',
				category: 'Home',
				state: homeAssistant?.connected ? 'online' : 'degraded',
				summary:
					homeAssistant?.summary ||
					'Add Home Assistant details to bring your home into the display.',
				detail: homeAssistant?.connected
					? `${homeAssistant.entities.length} devices are available to show here.`
					: 'Connection details can be added in Settings.',
				metrics: [
					{ label: 'Configured', value: homeAssistant?.configured ? 'Yes' : 'No' },
					{ label: 'Endpoint', value: homeAssistant?.baseUrl || runtime.homeAssistant.baseUrl || 'Unset' },
					{ label: 'Entities', value: String(homeAssistant?.entities.length ?? 0) }
				]
			}
		],
		connections: [
			assistantConnection ?? {
				id: 'ollama',
				label: 'Ollama',
				target: runtime.assistant.ollamaBaseUrl,
				state: 'offline',
				detail: 'Assistant backend is unreachable.'
			},
			transcriptionConnection ?? {
				id: 'transcription',
				label: 'Transcription',
				target:
					runtime.assistant.transcriptionServiceUrl ||
					(runtime.assistant.transcriptionProvider === 'local-whisper'
						? runtime.assistant.piVoice.whisperCli
						: 'mock-browser-hint'),
				state: 'degraded',
				detail: 'Transcription is not connected yet.'
			},
			homeAssistant?.connected
				? {
						id: 'home-assistant',
						label: 'Home Assistant',
						target: homeAssistant.baseUrl,
						state: 'online',
						detail: 'Home Assistant API reachable.'
					}
				: getHomeAssistantStubConnection()
		]
	};
}
