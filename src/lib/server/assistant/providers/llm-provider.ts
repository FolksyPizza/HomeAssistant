import { getRuntimeConfig } from '$lib/server/runtime';
import type { ConnectionState, ServiceConnection } from '$lib/types';

export interface LlmProvider {
	getHealth(baseUrlOverride?: string): Promise<{
		baseUrl: string;
		modelCount: number;
		models: Array<{ name: string; modifiedAt: string; size?: number }>;
		latencyMs?: number;
	}>;
	chat(input: {
		model: string;
		messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
		baseUrl?: string;
	}): Promise<{ response: string; model: string }>;
}

interface TimedResponse {
	response: Response;
	latencyMs: number;
}

function resolveConnectionState(ok: boolean): ConnectionState {
	return ok ? 'online' : 'offline';
}

async function timedFetch(
	target: URL,
	init: RequestInit = {},
	timeoutMs = 4000
): Promise<TimedResponse> {
	const startedAt = Date.now();
	const response = await fetch(target, {
		...init,
		signal: AbortSignal.timeout(timeoutMs)
	});

	return {
		response,
		latencyMs: Date.now() - startedAt
	};
}

class OllamaLlmProvider implements LlmProvider {
	private async fetchOllama(
		path: string,
		init: RequestInit = {},
		timeoutMs = 4000,
		baseUrlOverride?: string
	): Promise<TimedResponse> {
		const runtime = getRuntimeConfig();
		const target = new URL(path, baseUrlOverride?.trim() || runtime.assistant.ollamaBaseUrl);

		return timedFetch(
			target,
			{
				...init,
				headers: {
					'content-type': 'application/json',
					...(init.headers ?? {})
				}
			},
			timeoutMs
		);
	}

	async getHealth(baseUrlOverride?: string): Promise<{
		baseUrl: string;
		modelCount: number;
		models: Array<{ name: string; modifiedAt: string; size?: number }>;
		latencyMs?: number;
	}> {
		const { response, latencyMs } = await this.fetchOllama(
			'/api/tags',
			{ method: 'GET', headers: {} },
			4000,
			baseUrlOverride
		);

		if (!response.ok) {
			throw new Error(`Ollama server returned ${response.status}`);
		}

		const payload = (await response.json()) as {
			models?: Array<{ name: string; modified_at: string; size?: number }>;
		};

		return {
			baseUrl: baseUrlOverride?.trim() || getRuntimeConfig().assistant.ollamaBaseUrl,
			modelCount: payload.models?.length ?? 0,
			models: (payload.models ?? []).map((model) => ({
				name: model.name,
				modifiedAt: model.modified_at,
				size: model.size
			})),
			latencyMs
		};
	}

	async chat(input: {
		model: string;
		messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
		baseUrl?: string;
	}): Promise<{ response: string; model: string }> {
		const performChat = async (targetModel: string): Promise<{ response: string; model: string }> => {
			const { response } = await this.fetchOllama(
				'/api/chat',
				{
					method: 'POST',
					body: JSON.stringify({
						model: targetModel,
						stream: false,
						messages: input.messages
					})
				},
				90000,
				input.baseUrl
			);

			if (response.ok) {
				const payload = (await response.json()) as {
					message?: {
						content?: string;
					};
				};
				return {
					response: payload.message?.content?.trim() || 'No assistant response was returned.',
					model: targetModel
				};
			}

			if (response.status === 404) {
				const health = await this.getHealth(input.baseUrl);
				const fallbackModel = health.models[0]?.name;
				if (fallbackModel && fallbackModel !== targetModel) {
					return performChat(fallbackModel);
				}
			}

			throw new Error(`Ollama chat failed with ${response.status}`);
		};

		return performChat(input.model);
	}
}

export function createOllamaConnection(baseUrl: string, modelCount: number, latencyMs?: number): ServiceConnection {
	return {
		id: 'ollama',
		label: 'Ollama',
		target: baseUrl,
		state: resolveConnectionState(true),
		detail: `Remote inference is available with ${modelCount} model${modelCount === 1 ? '' : 's'}.`,
		latencyMs
	};
}

export function getLlmProvider(): LlmProvider {
	return new OllamaLlmProvider();
}
