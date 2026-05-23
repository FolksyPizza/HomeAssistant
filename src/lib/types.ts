export type DemoMode = 'default' | 'empty' | 'error';

export const AMBIENT_PHOTO_CATEGORIES = [
	'nature',
	'landscapes',
	'forests',
	'mountains',
	'lakes',
	'oceans',
	'deserts',
	'landmarks',
	'cities',
	'architecture',
	'seasonal',
	'sunrise-sunset',
	'night-sky'
] as const;

export type AmbientPhotoCategory = (typeof AMBIENT_PHOTO_CATEGORIES)[number];
export type AmbientPhotoSourceKind = 'bundled' | 'local-directory' | 'remote';
export type ThemeMode = 'dark' | 'light';
export type AssistantInteractionMode = 'browser-mic' | 'pi-local';
export type AssistantEntryMode = 'push-to-talk' | 'wake-word';
export type ConnectionState = 'online' | 'degraded' | 'offline';
export type AssistantState =
	| 'idle'
	| 'listening'
	| 'transcribing'
	| 'sending'
	| 'responding'
	| 'sleeping'
	| 'error';

export interface AmbientPhoto {
	id: string;
	src: string;
	categories: AmbientPhotoCategory[];
	title: string;
	width?: number;
	height?: number;
	location?: string;
	photographerCredit?: string;
	creditUrl?: string;
	sourceUrl?: string;
}

export interface AmbientPhotoManifestResponse {
	source: AmbientPhotoSourceKind;
	photos: AmbientPhoto[];
	categories: AmbientPhotoCategory[];
	fallback: AmbientPhoto;
}

export interface NavItem {
	label: string;
	href: string;
	description: string;
	icon: string;
}

export interface AssistantHealth {
	reachable: boolean;
	baseUrl: string;
	modelCount: number;
	models: Array<{
		name: string;
		modifiedAt: string;
		size?: number;
	}>;
	defaultModel: string;
	preferredMode: AssistantInteractionMode;
	transcriptionProvider: string;
	ttsProvider: string;
	piVoiceServiceEnabled: boolean;
	browserMicSupported: boolean;
	connections: ServiceConnection[];
	error?: string;
}

export type ResourceState<T> =
	| { status: 'loading' }
	| { status: 'empty'; message?: string }
	| { status: 'error'; error: string }
	| { status: 'success'; data: T };

export type WeatherIcon = 'sun' | 'cloud' | 'rain' | 'storm' | 'moon';

export interface ForecastEntry {
	day: string;
	condition: string;
	high: number;
	low: number;
	icon: WeatherIcon;
	precipitationChance: number;
}

export interface WeatherResponse {
	location: string;
	zip: string;
	updatedAt: string;
	aqi: number;
	sunrise: string;
	sunset: string;
	dailySummary: string;
	alerts: string[];
	current: {
		temperature: number;
		feelsLike: number;
		condition: string;
		summary: string;
		high: number;
		low: number;
		humidity: number;
		wind: string;
		icon: WeatherIcon;
	};
	forecast: ForecastEntry[];
}

export interface CalendarEvent {
	id: string;
	title: string;
	startsAt: string;
	endsAt: string;
	location: string;
	note?: string;
	color: string;
	createdBy: 'seed' | 'manual' | 'assistant';
}

export interface CalendarResponse {
	focusDay: string;
	providerLabel: string;
	nextOpenSlot: string;
	syncStatus: string;
	updatedAt: string;
	events: CalendarEvent[];
}

export interface StatusMetric {
	label: string;
	value: string;
	trend?: string;
}

export interface StatusCardData {
	id: string;
	title: string;
	category: string;
	state: ConnectionState;
	summary: string;
	detail: string;
	metrics: StatusMetric[];
}

export interface ServiceConnection {
	id: string;
	label: string;
	target: string;
	state: ConnectionState;
	detail: string;
	latencyMs?: number;
}

export interface StatusResponse {
	updatedAt: string;
	quickSummary: string;
	cards: StatusCardData[];
	connections: ServiceConnection[];
}

export interface HomeAssistantEntitySummary {
	id: string;
	label: string;
	state: string;
	secondary?: string;
}

export interface HomeAssistantResponse {
	connected: boolean;
	baseUrl: string;
	configured: boolean;
	updatedAt: string;
	summary: string;
	areas: Array<{
		name: string;
		summary: string;
	}>;
	entities: HomeAssistantEntitySummary[];
	error?: string;
}

export interface AppRuntimeConfig {
	server: {
		host: string;
		port: number;
		preferredProtocol: 'http' | 'https';
	};
	https: {
		enabled: boolean;
		certFile?: string;
		keyFile?: string;
	};
	assistant: {
		ollamaBaseUrl: string;
		defaultModel: string;
		preferredMode: AssistantInteractionMode;
		transcriptionProvider: 'mock-browser-hint' | 'whisper-service' | 'local-whisper';
		ttsProvider: 'none' | 'pi-local-piper' | 'browser-speech';
		transcriptionServiceUrl?: string;
		piVoiceServiceEnabled: boolean;
		piVoice: {
			pythonPath: string;
			helperScript: string;
			wakeWordModel: string;
			whisperCli: string;
			whisperModel: string;
			piperBinary: string;
			piperModel: string;
			inputDevice?: string;
			inputSampleRate?: number;
		};
	};
	homeAssistant: {
		baseUrl?: string;
		configured: boolean;
	};
	calendar: {
		googleOauthConfigured: boolean;
		googleRedirectUri?: string;
	};
	ambient: {
		photoDurationMs: number;
		fadeDurationMs: number;
		motionDurationMs: number;
		motionScale: number;
	};
	featureFlags: {
		browserMicTesting: boolean;
		piVoiceMode: boolean;
		assistantDebugPanels: boolean;
		calendarModule: boolean;
	};
}

export interface AssistantTranscriptResult {
	transcript: string;
	partialTranscript?: string;
	provider: string;
	note?: string;
	audioSeconds?: number;
}

export interface AssistantToolExecution {
	id: string;
	label: string;
	state: 'completed' | 'failed';
	summary: string;
}

export interface AssistantTurnResponse {
	submittedPrompt: string;
	response: string;
	model: string;
	createdAt: string;
	transcript?: string;
	connectionState: ConnectionState;
	state: AssistantState;
	responseSource: 'tool' | 'llm';
	toolExecution?: AssistantToolExecution;
}

export interface AssistantSessionRequest {
	prompt: string;
	transcript?: string;
	model?: string;
	baseUrl?: string;
}

export interface AssistantSpeechResult {
	provider: string;
	spoken: boolean;
	note?: string;
}

export interface PiVoiceCaptureResult extends AssistantTranscriptResult {
	activationSource: AssistantEntryMode;
	wakeWordScore?: number;
}

export interface AssistantVoiceTurnRequest {
	entryMode: AssistantEntryMode;
	wakeWordPhrase?: string;
	silenceTimeoutSeconds?: number;
	maxListenSeconds?: number;
	model?: string;
	baseUrl?: string;
	speakResponse?: boolean;
}

export interface AssistantVoiceTurnResponse {
	capture: PiVoiceCaptureResult;
	turn: AssistantTurnResponse;
	speech?: AssistantSpeechResult;
}

export interface DisplayPreferences {
	user: {
		name: string;
		setupComplete: boolean;
	};
	appearance: {
		theme: ThemeMode;
		showAmbientCaption: boolean;
		highContrastClock: boolean;
	};
	home: {
		showSummaryCards: boolean;
	};
	ambient: {
		categories: AmbientPhotoCategory[];
		motionEnabled: boolean;
		photoDurationMinutes: number;
		fadeDurationSeconds: number;
	};
	weather: {
		zip: string;
		units: 'imperial' | 'metric';
		showSunTimes: boolean;
	};
	homeAssistant: {
		baseUrl: string;
		tokenHint: string;
		tokenConfigured: boolean;
		showOnHome: boolean;
	};
	calendar: {
		provider: 'mock' | 'google';
		googleConnected: boolean;
		agendaWindowDays: number;
		showEventNotes: boolean;
	};
	assistant: {
		interactionMode: AssistantInteractionMode;
		autoSendTranscript: boolean;
		defaultModel: string;
		showPartialTranscript: boolean;
	};
	voice: {
		entryMode: AssistantEntryMode;
		microphoneEnabled: boolean;
		speakerEnabled: boolean;
		sleepMode: boolean;
		allowPushToTalkWhileSleeping: boolean;
		wakeWordEnabled: boolean;
		wakeWordPhrase: string;
		echoCancellation: boolean;
		noiseSuppression: boolean;
		autoGainControl: boolean;
		silenceTimeoutSeconds: number;
	};
	backend: {
		ollamaBaseUrl: string;
		requestTimeoutSeconds: number;
		showConnectionHealthOnHome: boolean;
	};
	kiosk: {
		preferHttpsForMic: boolean;
		keepScreenAwake: boolean;
		reduceAmbientMotion: boolean;
		dimDockInAmbient: boolean;
	};
	developer: {
		showDebugPanels: boolean;
		enableCalendarModule: boolean;
		weatherDemoMode: DemoMode;
		calendarDemoMode: DemoMode;
		mockTranscription: boolean;
	};
}
