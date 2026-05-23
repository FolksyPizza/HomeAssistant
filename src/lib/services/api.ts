import type {
	AppRuntimeConfig,
	CalendarResponse,
	CalendarEvent,
	DemoMode,
	HomeAssistantResponse,
	ResourceState,
	StatusResponse,
	WeatherResponse
} from '$lib/types';

function buildUrl(path: string, params: Record<string, string | undefined>): string {
	const url = new URL(path, 'http://localhost');

	for (const [key, value] of Object.entries(params)) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}

	return `${url.pathname}${url.search}`;
}

async function readJson<T>(
	fetcher: typeof fetch,
	path: string,
	params: Record<string, string | undefined> = {}
): Promise<T> {
	const response = await fetcher(buildUrl(path, params));

	if (!response.ok) {
		throw new Error(`Request failed with ${response.status}`);
	}

	return (await response.json()) as T;
}

export function isWeatherEmpty(data: WeatherResponse): boolean {
	return data.forecast.length === 0;
}

export function isCalendarEmpty(data: CalendarResponse): boolean {
	return data.events.length === 0;
}

export async function fetchWeather(
	fetcher: typeof fetch,
	zip: string,
	mode?: DemoMode
): Promise<WeatherResponse> {
	return readJson<WeatherResponse>(fetcher, '/api/weather', {
		mode: mode && mode !== 'default' ? mode : undefined,
		zip
	});
}

export async function fetchCalendar(fetcher: typeof fetch, mode?: DemoMode): Promise<CalendarResponse> {
	return readJson<CalendarResponse>(fetcher, '/api/calendar', {
		mode: mode && mode !== 'default' ? mode : undefined
	});
}

export async function fetchGoogleCalendar(fetcher: typeof fetch): Promise<CalendarResponse & { connected: boolean; email?: string; error?: string }> {
	return readJson<CalendarResponse & { connected: boolean; email?: string; error?: string }>(fetcher, '/api/calendar/google');
}

export async function createCalendarEvent(
	fetcher: typeof fetch,
	input: {
		title: string;
		startsAt: string;
		endsAt: string;
		location?: string;
		note?: string;
		color?: string;
	}
): Promise<CalendarEvent> {
	const response = await fetcher('/api/calendar', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message || `Calendar create failed with ${response.status}`);
	}

	return ((await response.json()) as { event: CalendarEvent }).event;
}

export async function updateCalendarEvent(
	fetcher: typeof fetch,
	id: string,
	input: {
		title: string;
		startsAt: string;
		endsAt: string;
		location?: string;
		note?: string;
		color?: string;
	}
): Promise<CalendarEvent> {
	const response = await fetcher(`/api/calendar/${id}`, {
		method: 'PATCH',
		headers: {
			'content-type': 'application/json'
		},
		body: JSON.stringify(input)
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message || `Calendar update failed with ${response.status}`);
	}

	return ((await response.json()) as { event: CalendarEvent }).event;
}

export async function deleteCalendarEvent(fetcher: typeof fetch, id: string): Promise<void> {
	const response = await fetcher(`/api/calendar/${id}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message || `Calendar delete failed with ${response.status}`);
	}
}

export async function fetchStatus(fetcher: typeof fetch): Promise<StatusResponse> {
	return readJson<StatusResponse>(fetcher, '/api/status');
}

export async function fetchHomeAssistant(fetcher: typeof fetch): Promise<HomeAssistantResponse> {
	return readJson<HomeAssistantResponse>(fetcher, '/api/home-assistant');
}

export async function fetchRuntimeConfig(fetcher: typeof fetch): Promise<AppRuntimeConfig> {
	return readJson<AppRuntimeConfig>(fetcher, '/api/runtime');
}

export async function loadResource<T>(
	loader: () => Promise<T>,
	isEmpty: (data: T) => boolean
): Promise<ResourceState<T>> {
	try {
		const data = await loader();
		return isEmpty(data)
			? { status: 'empty', message: 'Nothing to show right now.' }
			: { status: 'success', data };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		return { status: 'error', error: message };
	}
}
