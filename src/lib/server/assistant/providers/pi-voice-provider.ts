import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getRuntimeConfig } from '$lib/server/runtime';
import type {
	AssistantSpeechResult,
	AssistantVoiceTurnRequest,
	PiVoiceCaptureResult,
	ServiceConnection
} from '$lib/types';

const execFileAsync = promisify(execFile);

interface PiVoiceBridgeHealthResponse {
	available: boolean;
	status: {
		python_dependencies: Record<string, boolean>;
		files: Record<string, boolean>;
		audio?: {
			input?: boolean;
			output?: boolean;
		};
		errors?: Record<string, string>;
	};
}

interface PiVoiceHealth {
	capture: ServiceConnection;
	speech: ServiceConnection;
}

function buildBridgeConfig() {
	const runtime = getRuntimeConfig();
	return {
		input_device: runtime.assistant.piVoice.inputDevice,
		input_sample_rate: runtime.assistant.piVoice.inputSampleRate,
		wake_word_model: runtime.assistant.piVoice.wakeWordModel,
		whisper_cli: runtime.assistant.piVoice.whisperCli,
		whisper_model: runtime.assistant.piVoice.whisperModel,
		piper_binary: runtime.assistant.piVoice.piperBinary,
		piper_model: runtime.assistant.piVoice.piperModel
	};
}

function parseBridgePayload<T>(stdout: string): T {
	const lines = stdout
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		try {
			return JSON.parse(lines[index]) as T;
		} catch {
			continue;
		}
	}

	throw new Error('Pi voice helper did not return valid JSON.');
}

function extractBridgeErrorMessage(raw: string): string {
	try {
		const parsed = parseBridgePayload<{ error?: string }>(raw);
		if (parsed.error) {
			return parsed.error;
		}
	} catch {
		// Fall back to raw output below.
	}

	return raw.trim() || 'Pi voice helper failed.';
}

async function runPiVoiceBridge<T>(
	command: 'health' | 'listen' | 'speak',
	args: string[],
	timeoutMs: number
): Promise<T> {
	const runtime = getRuntimeConfig();
	const bridgeConfig = JSON.stringify(buildBridgeConfig());
	const result = await execFileAsync(
		runtime.assistant.piVoice.pythonPath,
		[runtime.assistant.piVoice.helperScript, command, '--config', bridgeConfig, ...args],
		{
			timeout: timeoutMs,
			maxBuffer: 1024 * 1024
		}
	).catch((error: Error & { stdout?: string; stderr?: string }) => {
		const message = error.stdout || error.stderr || error.message;
		throw new Error(extractBridgeErrorMessage(message));
	});

	return parseBridgePayload<T>(result.stdout);
}

function describeDisabledConnection(id: string, label: string, detail: string): ServiceConnection {
	return {
		id,
		label,
		target: 'pi-local voice bridge',
		state: 'degraded',
		detail
	};
}

function formatBridgeError(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown Pi voice error';
}

export class PiVoiceProvider {
	async health(): Promise<PiVoiceHealth> {
		const runtime = getRuntimeConfig();
		if (!runtime.assistant.piVoiceServiceEnabled) {
			return {
				capture: describeDisabledConnection(
					'pi-voice-capture',
					'Pi-local capture',
					'Pi-local voice is disabled. Set `PI_VOICE_SERVICE_ENABLED=true` when the Pi tools are installed.'
				),
				speech: describeDisabledConnection(
					'pi-voice-tts',
					'Pi-local speech',
					'Pi-local TTS is disabled. Set `PI_VOICE_SERVICE_ENABLED=true` when Piper is installed.'
				)
			};
		}

		try {
			const payload = await runPiVoiceBridge<PiVoiceBridgeHealthResponse>('health', [], 15000);
			const dependencyFailures = Object.entries(payload.status.python_dependencies)
				.filter(([, available]) => !available)
				.map(([name]) => name);
			const captureFileFailures = ['wake_word_model', 'whisper_cli', 'whisper_model'].filter(
				(name) => !payload.status.files[name]
			);
			const speechFileFailures = ['piper_binary', 'piper_model'].filter(
				(name) => !payload.status.files[name]
			);

			const captureReady =
				payload.available &&
				dependencyFailures.length === 0 &&
				captureFileFailures.length === 0 &&
				Boolean(payload.status.audio?.input);
			const speechReady =
				payload.available &&
				dependencyFailures.length === 0 &&
				speechFileFailures.length === 0 &&
				Boolean(payload.status.audio?.output);

			return {
				capture: {
					id: 'pi-voice-capture',
					label: 'Pi-local capture',
					target: runtime.assistant.piVoice.helperScript,
					state: captureReady ? 'online' : 'degraded',
					detail: captureReady
						? 'Wake-word and Pi microphone capture are ready.'
						: payload.status.audio?.input === false
							? 'No Pi microphone was detected.'
							: `Missing ${[...dependencyFailures, ...captureFileFailures].join(', ')}.`
				},
				speech: {
					id: 'pi-voice-tts',
					label: 'Pi-local speech',
					target: runtime.assistant.piVoice.helperScript,
					state: speechReady ? 'online' : 'degraded',
					detail: speechReady
						? 'Piper speech playback is ready.'
						: payload.status.audio?.output === false
							? 'No Pi speaker output was detected.'
							: `Missing ${[...dependencyFailures, ...speechFileFailures].join(', ')}.`
				}
			};
		} catch (error) {
			const detail = formatBridgeError(error);
			return {
				capture: {
					id: 'pi-voice-capture',
					label: 'Pi-local capture',
					target: runtime.assistant.piVoice.helperScript,
					state: 'offline',
					detail
				},
				speech: {
					id: 'pi-voice-tts',
					label: 'Pi-local speech',
					target: runtime.assistant.piVoice.helperScript,
					state: 'offline',
					detail
				}
			};
		}
	}

	async listen(request: AssistantVoiceTurnRequest): Promise<PiVoiceCaptureResult> {
		const runtime = getRuntimeConfig();
		if (!runtime.assistant.piVoiceServiceEnabled) {
			throw new Error('Pi-local voice is disabled.');
		}

		const maxListenSeconds = request.maxListenSeconds ?? 30;
		const timeoutMs =
			request.entryMode === 'wake-word'
				? Math.max(150000, maxListenSeconds * 1000 + 120000)
				: Math.max(90000, maxListenSeconds * 1000 + 45000);

		return runPiVoiceBridge<PiVoiceCaptureResult>(
			'listen',
			[
				'--entry-mode',
				request.entryMode,
				'--silence-timeout',
				String(request.silenceTimeoutSeconds ?? 2),
				'--max-listen-seconds',
				String(maxListenSeconds)
			],
			timeoutMs
		);
	}

	async speak(text: string): Promise<AssistantSpeechResult> {
		const runtime = getRuntimeConfig();
		if (!runtime.assistant.piVoiceServiceEnabled) {
			return {
				provider: 'none',
				spoken: false,
				note: 'Pi-local speech is disabled.'
			};
		}

		return runPiVoiceBridge<AssistantSpeechResult>(
			'speak',
			['--text', text],
			Math.max(30000, text.length * 180)
		);
	}
}

let provider: PiVoiceProvider | null = null;

export function getPiVoiceProvider(): PiVoiceProvider {
	if (!provider) {
		provider = new PiVoiceProvider();
	}

	return provider;
}
