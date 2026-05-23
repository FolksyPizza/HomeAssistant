import {
	AMBIENT_PHOTO_DURATION_MS,
	AMBIENT_PHOTO_FADE_DURATION_MS,
	AMBIENT_PHOTO_MOTION_DURATION_MS,
	AMBIENT_PHOTO_MOTION_SCALE
} from '$lib/config/ambient-photos';

export const DEFAULT_SERVER_HOST = '0.0.0.0';
export const DEFAULT_SERVER_PORT = 8989;
export const DEFAULT_OLLAMA_BASE_URL = 'http://llm-server:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';
export const DEFAULT_HOME_ASSISTANT_BASE_URL = 'http://homeassistant.local:8123';

export const DEFAULT_RUNTIME_FEATURE_FLAGS = {
	browserMicTesting: true,
	piVoiceMode: true,
	assistantDebugPanels: false,
	calendarModule: false
} as const;

export const DEFAULT_AMBIENT_RUNTIME = {
	photoDurationMs: AMBIENT_PHOTO_DURATION_MS,
	fadeDurationMs: AMBIENT_PHOTO_FADE_DURATION_MS,
	motionDurationMs: AMBIENT_PHOTO_MOTION_DURATION_MS,
	motionScale: AMBIENT_PHOTO_MOTION_SCALE
} as const;
