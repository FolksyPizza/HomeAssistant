import { env } from '$env/dynamic/private';
import { resolve } from 'node:path';
import {
	DEFAULT_AMBIENT_RUNTIME,
	DEFAULT_HOME_ASSISTANT_BASE_URL,
	DEFAULT_OLLAMA_BASE_URL,
	DEFAULT_OLLAMA_MODEL,
	DEFAULT_RUNTIME_FEATURE_FLAGS,
	DEFAULT_SERVER_HOST,
	DEFAULT_SERVER_PORT
} from '$lib/config/runtime';
import { getSetupConfig } from '$lib/server/setup-config';
import type { AppRuntimeConfig } from '$lib/types';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined) {
		return fallback;
	}

	return value === 'true';
}

function parseNumber(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveRuntimePath(value: string | undefined, fallback: string): string {
	const nextValue = value?.trim() || fallback;
	return resolve(process.cwd(), nextValue);
}

export function getRuntimeConfig(): AppRuntimeConfig {
	const setupConfig = getSetupConfig();
	const httpsEnabled = parseBoolean(env.DEV_HTTPS, false);
	const whisperServiceUrl = env.WHISPER_TRANSCRIBE_URL?.trim();
	const homeAssistantBaseUrl = env.HOME_ASSISTANT_BASE_URL?.trim();
	const piVoiceEnabled = parseBoolean(env.PI_VOICE_SERVICE_ENABLED, false);
	const transcriptionProvider = whisperServiceUrl
		? 'whisper-service'
		: piVoiceEnabled
			? 'local-whisper'
			: 'mock-browser-hint';
	const ttsProvider = piVoiceEnabled ? 'pi-local-piper' : 'browser-speech';

	return {
		server: {
			host: env.HOST?.trim() || DEFAULT_SERVER_HOST,
			port: parseNumber(env.PORT, DEFAULT_SERVER_PORT),
			preferredProtocol: httpsEnabled ? 'https' : 'http'
		},
		https: {
			enabled: httpsEnabled,
			certFile: env.DEV_HTTPS_CERT_FILE?.trim(),
			keyFile: env.DEV_HTTPS_KEY_FILE?.trim()
		},
		assistant: {
			ollamaBaseUrl: env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
			defaultModel: env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
			preferredMode: env.ASSISTANT_MODE === 'pi-local' ? 'pi-local' : 'browser-mic',
			transcriptionProvider,
			ttsProvider,
			transcriptionServiceUrl: whisperServiceUrl,
			piVoiceServiceEnabled: piVoiceEnabled,
			piVoice: {
				pythonPath: env.PI_VOICE_PYTHON?.trim() || 'python3',
				helperScript: resolveRuntimePath(
					env.PI_VOICE_HELPER_SCRIPT,
					'scripts/pi_voice_bridge.py'
				),
				wakeWordModel: resolveRuntimePath(env.PI_VOICE_WAKE_WORD_MODEL, 'wakeword.onnx'),
				whisperCli: resolveRuntimePath(
					env.PI_VOICE_WHISPER_CLI,
					'whisper.cpp/build/bin/whisper-cli'
				),
				whisperModel: resolveRuntimePath(
					env.PI_VOICE_WHISPER_MODEL,
					'whisper.cpp/models/ggml-base.en.bin'
				),
				piperBinary: resolveRuntimePath(env.PI_VOICE_PIPER_BINARY, 'piper/piper'),
				piperModel: resolveRuntimePath(
					env.PI_VOICE_PIPER_MODEL,
					'piper/en_GB-semaine-medium.onnx'
				),
				inputDevice: env.PI_VOICE_INPUT_DEVICE?.trim() || undefined,
				inputSampleRate:
					env.PI_VOICE_INPUT_SAMPLE_RATE?.trim()
						? parseNumber(env.PI_VOICE_INPUT_SAMPLE_RATE, 0)
						: undefined
			}
		},
		homeAssistant: {
			baseUrl: homeAssistantBaseUrl || DEFAULT_HOME_ASSISTANT_BASE_URL,
			configured: Boolean(homeAssistantBaseUrl && env.HOME_ASSISTANT_TOKEN?.trim())
		},
		calendar: {
			googleOauthConfigured: Boolean(
				(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim()) ||
				(setupConfig.googleCalendar.clientId && setupConfig.googleCalendar.clientSecret)
			),
			googleRedirectUri:
				env.GOOGLE_REDIRECT_URI?.trim() || setupConfig.googleCalendar.redirectUri || undefined
		},
		ambient: {
			photoDurationMs: parseNumber(
				env.AMBIENT_PHOTO_DURATION_MS,
				DEFAULT_AMBIENT_RUNTIME.photoDurationMs
			),
			fadeDurationMs: parseNumber(
				env.AMBIENT_PHOTO_FADE_DURATION_MS,
				DEFAULT_AMBIENT_RUNTIME.fadeDurationMs
			),
			motionDurationMs: parseNumber(
				env.AMBIENT_PHOTO_MOTION_DURATION_MS,
				DEFAULT_AMBIENT_RUNTIME.motionDurationMs
			),
			motionScale: Number(env.AMBIENT_PHOTO_MOTION_SCALE ?? DEFAULT_AMBIENT_RUNTIME.motionScale)
		},
		featureFlags: {
			browserMicTesting: parseBoolean(
				env.FEATURE_BROWSER_MIC_TESTING,
				DEFAULT_RUNTIME_FEATURE_FLAGS.browserMicTesting
			),
			piVoiceMode: parseBoolean(
				env.FEATURE_PI_VOICE_MODE,
				DEFAULT_RUNTIME_FEATURE_FLAGS.piVoiceMode
			),
			assistantDebugPanels: parseBoolean(
				env.FEATURE_ASSISTANT_DEBUG,
				DEFAULT_RUNTIME_FEATURE_FLAGS.assistantDebugPanels
			),
			calendarModule: parseBoolean(
				env.FEATURE_CALENDAR_MODULE,
				DEFAULT_RUNTIME_FEATURE_FLAGS.calendarModule
			)
		}
	};
}
