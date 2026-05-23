import { AMBIENT_PHOTO_CATEGORIES, type AmbientPhotoCategory, type AssistantEntryMode, type AssistantInteractionMode, type DisplayPreferences, type DemoMode, type ThemeMode } from '$lib/types';

export const DEFAULT_ZIP = '10001';
export const DEFAULT_AMBIENT_PHOTO_CATEGORIES = [
	'nature',
	'landscapes',
	'landmarks',
	'cities',
	'seasonal',
	'sunrise-sunset'
] as const;

const STORAGE_KEY = 'smart-display-preferences-v2';
const LEGACY_ZIP_KEY = 'smart-display-zip';
const LEGACY_AMBIENT_PHOTO_CATEGORIES_KEY = 'smart-display-ambient-photo-categories';

function isAmbientPhotoCategory(value: string): value is AmbientPhotoCategory {
	return (AMBIENT_PHOTO_CATEGORIES as readonly string[]).includes(value);
}

function isDemoMode(value: string): value is DemoMode {
	return value === 'default' || value === 'empty' || value === 'error';
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== 'number' || Number.isNaN(value)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizeTheme(value: unknown, fallback: ThemeMode): ThemeMode {
	return value === 'dark' || value === 'light' ? value : fallback;
}

function sanitizeInteractionMode(
	value: unknown,
	fallback: AssistantInteractionMode
): AssistantInteractionMode {
	return value === 'browser-mic' || value === 'pi-local' ? value : fallback;
}

function sanitizeEntryMode(value: unknown, fallback: AssistantEntryMode): AssistantEntryMode {
	return value === 'push-to-talk' || value === 'wake-word' ? value : fallback;
}

export function sanitizeZip(value: string): string {
	return value.replace(/\D/g, '').slice(0, 5);
}

export function isValidZip(value: string): boolean {
	return /^\d{5}$/.test(value);
}

function getLegacyZip(): string {
	if (typeof window === 'undefined') {
		return DEFAULT_ZIP;
	}

	const stored = window.localStorage.getItem(LEGACY_ZIP_KEY) ?? DEFAULT_ZIP;
	return isValidZip(stored) ? stored : DEFAULT_ZIP;
}

function getLegacyCategories(): AmbientPhotoCategory[] {
	if (typeof window === 'undefined') {
		return [...DEFAULT_AMBIENT_PHOTO_CATEGORIES];
	}

	try {
		const raw = window.localStorage.getItem(LEGACY_AMBIENT_PHOTO_CATEGORIES_KEY);
		if (!raw) {
			return [...DEFAULT_AMBIENT_PHOTO_CATEGORIES];
		}

		const parsed = JSON.parse(raw) as string[];
		const filtered = parsed.filter(isAmbientPhotoCategory);
		return filtered.length > 0 ? filtered : [...DEFAULT_AMBIENT_PHOTO_CATEGORIES];
	} catch {
		return [...DEFAULT_AMBIENT_PHOTO_CATEGORIES];
	}
}

export function getDefaultPreferences(): DisplayPreferences {
	return {
		user: {
			name: '',
			setupComplete: false
		},
		appearance: {
			theme: 'dark',
			showAmbientCaption: true,
			highContrastClock: true
		},
		home: {
			showSummaryCards: false
		},
		ambient: {
			categories: [...DEFAULT_AMBIENT_PHOTO_CATEGORIES],
			motionEnabled: true,
			photoDurationMinutes: 4,
			fadeDurationSeconds: 4
		},
		weather: {
			zip: DEFAULT_ZIP,
			units: 'imperial',
			showSunTimes: true
		},
		homeAssistant: {
			baseUrl: 'http://homeassistant.local:8123',
			tokenHint: '',
			tokenConfigured: false,
			showOnHome: true
		},
		calendar: {
			provider: 'mock',
			googleConnected: false,
			agendaWindowDays: 3,
			showEventNotes: true
		},
		assistant: {
			interactionMode: 'browser-mic',
			autoSendTranscript: true,
			defaultModel: 'llama3.2:3b',
			showPartialTranscript: true
		},
		voice: {
			entryMode: 'push-to-talk',
			microphoneEnabled: true,
			speakerEnabled: true,
			sleepMode: false,
			allowPushToTalkWhileSleeping: true,
			wakeWordEnabled: false,
			wakeWordPhrase: 'Hey display',
			echoCancellation: true,
			noiseSuppression: true,
			autoGainControl: true,
			silenceTimeoutSeconds: 2
		},
		backend: {
			ollamaBaseUrl: 'http://llm-server:11434',
			requestTimeoutSeconds: 45,
			showConnectionHealthOnHome: true
		},
		kiosk: {
			preferHttpsForMic: true,
			keepScreenAwake: true,
			reduceAmbientMotion: false,
			dimDockInAmbient: true
		},
		developer: {
			showDebugPanels: false,
			enableCalendarModule: false,
			weatherDemoMode: 'default',
			calendarDemoMode: 'default',
			mockTranscription: true
		}
	};
}

function migrateLegacyPreferences(): DisplayPreferences {
	const defaults = getDefaultPreferences();
	return {
		...defaults,
		ambient: {
			...defaults.ambient,
			categories: getLegacyCategories()
		},
		weather: {
			...defaults.weather,
			zip: getLegacyZip()
		}
	};
}

export function sanitizePreferences(value: unknown): DisplayPreferences {
	const defaults = getDefaultPreferences();
	const input = (value ?? {}) as Partial<DisplayPreferences>;
	const ambientCategories = (input.ambient?.categories ?? []).filter(isAmbientPhotoCategory);

	return {
		user: {
			name: typeof input.user?.name === 'string' ? input.user.name.slice(0, 64) : defaults.user.name,
			setupComplete: sanitizeBoolean(input.user?.setupComplete, defaults.user.setupComplete)
		},
		appearance: {
			theme: sanitizeTheme(input.appearance?.theme, defaults.appearance.theme),
			showAmbientCaption: sanitizeBoolean(
				input.appearance?.showAmbientCaption,
				defaults.appearance.showAmbientCaption
			),
			highContrastClock: sanitizeBoolean(
				input.appearance?.highContrastClock,
				defaults.appearance.highContrastClock
			)
		},
		home: {
			showSummaryCards: sanitizeBoolean(
				input.home?.showSummaryCards,
				defaults.home.showSummaryCards
			)
		},
		ambient: {
			categories:
				ambientCategories.length > 0 ? ambientCategories : [...defaults.ambient.categories],
			motionEnabled: sanitizeBoolean(input.ambient?.motionEnabled, defaults.ambient.motionEnabled),
			photoDurationMinutes: sanitizeNumber(
				input.ambient?.photoDurationMinutes,
				defaults.ambient.photoDurationMinutes,
				1,
				15
			),
			fadeDurationSeconds: sanitizeNumber(
				input.ambient?.fadeDurationSeconds,
				defaults.ambient.fadeDurationSeconds,
				2,
				12
			)
		},
		weather: {
			zip: isValidZip(input.weather?.zip ?? '') ? (input.weather?.zip as string) : defaults.weather.zip,
			units: input.weather?.units === 'metric' ? 'metric' : defaults.weather.units,
			showSunTimes: sanitizeBoolean(input.weather?.showSunTimes, defaults.weather.showSunTimes)
		},
		homeAssistant: {
			baseUrl:
				typeof input.homeAssistant?.baseUrl === 'string' && input.homeAssistant.baseUrl.trim()
					? input.homeAssistant.baseUrl.trim()
					: defaults.homeAssistant.baseUrl,
			tokenHint:
				typeof input.homeAssistant?.tokenHint === 'string'
					? input.homeAssistant.tokenHint.trim()
					: defaults.homeAssistant.tokenHint,
			tokenConfigured: sanitizeBoolean(
				input.homeAssistant?.tokenConfigured,
				defaults.homeAssistant.tokenConfigured
			),
			showOnHome: sanitizeBoolean(input.homeAssistant?.showOnHome, defaults.homeAssistant.showOnHome)
		},
		calendar: {
			provider: input.calendar?.provider === 'google' ? 'google' : 'mock',
			googleConnected: sanitizeBoolean(input.calendar?.googleConnected, defaults.calendar.googleConnected),
			agendaWindowDays: sanitizeNumber(
				input.calendar?.agendaWindowDays,
				defaults.calendar.agendaWindowDays,
				1,
				14
			),
			showEventNotes: sanitizeBoolean(
				input.calendar?.showEventNotes,
				defaults.calendar.showEventNotes
			)
		},
		assistant: {
			interactionMode: sanitizeInteractionMode(
				input.assistant?.interactionMode,
				defaults.assistant.interactionMode
			),
			autoSendTranscript: sanitizeBoolean(
				input.assistant?.autoSendTranscript,
				defaults.assistant.autoSendTranscript
			),
			defaultModel:
				typeof input.assistant?.defaultModel === 'string' && input.assistant.defaultModel.trim()
					? input.assistant.defaultModel.trim()
					: defaults.assistant.defaultModel,
			showPartialTranscript: sanitizeBoolean(
				input.assistant?.showPartialTranscript,
				defaults.assistant.showPartialTranscript
			)
		},
		voice: {
			entryMode: sanitizeEntryMode(input.voice?.entryMode, defaults.voice.entryMode),
			microphoneEnabled: sanitizeBoolean(
				input.voice?.microphoneEnabled,
				defaults.voice.microphoneEnabled
			),
			speakerEnabled: sanitizeBoolean(
				input.voice?.speakerEnabled,
				defaults.voice.speakerEnabled
			),
			sleepMode: sanitizeBoolean(input.voice?.sleepMode, defaults.voice.sleepMode),
			allowPushToTalkWhileSleeping: sanitizeBoolean(
				input.voice?.allowPushToTalkWhileSleeping,
				defaults.voice.allowPushToTalkWhileSleeping
			),
			wakeWordEnabled: sanitizeBoolean(input.voice?.wakeWordEnabled, defaults.voice.wakeWordEnabled),
			wakeWordPhrase:
				typeof input.voice?.wakeWordPhrase === 'string' && input.voice.wakeWordPhrase.trim()
					? input.voice.wakeWordPhrase.trim()
					: defaults.voice.wakeWordPhrase,
			echoCancellation: sanitizeBoolean(
				input.voice?.echoCancellation,
				defaults.voice.echoCancellation
			),
			noiseSuppression: sanitizeBoolean(
				input.voice?.noiseSuppression,
				defaults.voice.noiseSuppression
			),
			autoGainControl: sanitizeBoolean(
				input.voice?.autoGainControl,
				defaults.voice.autoGainControl
			),
			silenceTimeoutSeconds: sanitizeNumber(
				input.voice?.silenceTimeoutSeconds,
				defaults.voice.silenceTimeoutSeconds,
				1,
				8
			)
		},
		backend: {
			ollamaBaseUrl:
				typeof input.backend?.ollamaBaseUrl === 'string' && input.backend.ollamaBaseUrl.trim()
					? input.backend.ollamaBaseUrl.trim()
					: defaults.backend.ollamaBaseUrl,
			requestTimeoutSeconds: sanitizeNumber(
				input.backend?.requestTimeoutSeconds,
				defaults.backend.requestTimeoutSeconds,
				10,
				120
			),
			showConnectionHealthOnHome: sanitizeBoolean(
				input.backend?.showConnectionHealthOnHome,
				defaults.backend.showConnectionHealthOnHome
			)
		},
		kiosk: {
			preferHttpsForMic: sanitizeBoolean(
				input.kiosk?.preferHttpsForMic,
				defaults.kiosk.preferHttpsForMic
			),
			keepScreenAwake: sanitizeBoolean(
				input.kiosk?.keepScreenAwake,
				defaults.kiosk.keepScreenAwake
			),
			reduceAmbientMotion: sanitizeBoolean(
				input.kiosk?.reduceAmbientMotion,
				defaults.kiosk.reduceAmbientMotion
			),
			dimDockInAmbient: sanitizeBoolean(
				input.kiosk?.dimDockInAmbient,
				defaults.kiosk.dimDockInAmbient
			)
		},
		developer: {
			showDebugPanels: sanitizeBoolean(
				input.developer?.showDebugPanels,
				defaults.developer.showDebugPanels
			),
			enableCalendarModule: sanitizeBoolean(
				input.developer?.enableCalendarModule,
				defaults.developer.enableCalendarModule
			),
			weatherDemoMode: isDemoMode(input.developer?.weatherDemoMode ?? '')
				? (input.developer?.weatherDemoMode as DemoMode)
				: defaults.developer.weatherDemoMode,
			calendarDemoMode: isDemoMode(input.developer?.calendarDemoMode ?? '')
				? (input.developer?.calendarDemoMode as DemoMode)
				: defaults.developer.calendarDemoMode,
			mockTranscription: sanitizeBoolean(
				input.developer?.mockTranscription,
				defaults.developer.mockTranscription
			)
		}
	};
}

export function getSavedPreferences(): DisplayPreferences {
	if (typeof window === 'undefined') {
		return getDefaultPreferences();
	}

	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			const migrated = migrateLegacyPreferences();
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
			return migrated;
		}

		return sanitizePreferences(JSON.parse(raw));
	} catch {
		return migrateLegacyPreferences();
	}
}

export function savePreferences(preferences: DisplayPreferences): DisplayPreferences {
	const sanitized = sanitizePreferences(preferences);

	if (typeof window !== 'undefined') {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
		window.localStorage.setItem(LEGACY_ZIP_KEY, sanitized.weather.zip);
		window.localStorage.setItem(
			LEGACY_AMBIENT_PHOTO_CATEGORIES_KEY,
			JSON.stringify(sanitized.ambient.categories)
		);
	}

	return sanitized;
}

export function updatePreferences(
	updater: (preferences: DisplayPreferences) => DisplayPreferences
): DisplayPreferences {
	return savePreferences(updater(getSavedPreferences()));
}

export function getSavedZip(): string {
	return getSavedPreferences().weather.zip;
}

export function saveZip(zip: string): string {
	return updatePreferences((preferences) => ({
		...preferences,
		weather: {
			...preferences.weather,
			zip: isValidZip(sanitizeZip(zip)) ? sanitizeZip(zip) : preferences.weather.zip
		}
	})).weather.zip;
}

export function getSavedAmbientPhotoCategories(): AmbientPhotoCategory[] {
	return getSavedPreferences().ambient.categories;
}

export function saveAmbientPhotoCategories(
	categories: AmbientPhotoCategory[]
): AmbientPhotoCategory[] {
	return updatePreferences((preferences) => ({
		...preferences,
		ambient: {
			...preferences.ambient,
			categories: categories.filter(isAmbientPhotoCategory)
		}
	})).ambient.categories;
}
