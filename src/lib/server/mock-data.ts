import type {
	CalendarResponse,
	DemoMode,
	WeatherResponse
} from '$lib/types';

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeIsoTime(hour: number, minute: number): string {
	const value = new Date();
	value.setHours(hour, minute, 0, 0);
	return value.toISOString();
}

const ZIP_LABELS: Record<string, string> = {
	'10001': 'New York, NY',
	'10583': 'Scarsdale, NY',
	'11201': 'Brooklyn, NY',
	'02139': 'Cambridge, MA',
	'30301': 'Atlanta, GA',
	'33101': 'Miami, FL',
	'60601': 'Chicago, IL',
	'73301': 'Austin, TX',
	'80202': 'Denver, CO',
	'85004': 'Phoenix, AZ',
	'90001': 'Los Angeles, CA',
	'94103': 'San Francisco, CA',
	'98101': 'Seattle, WA'
};

function resolveLocation(zip: string): string {
	return ZIP_LABELS[zip] ? `${ZIP_LABELS[zip]} · ${zip}` : `ZIP ${zip}`;
}

function makeWeather(zip: string): WeatherResponse {
	const now = new Date();
	const sunrise = new Date(now);
	sunrise.setHours(6, 41, 0, 0);
	const sunset = new Date(now);
	sunset.setHours(19, 18, 0, 0);
	const zipSeed = zip
		.split('')
		.reduce((total, digit) => total + Number(digit), 0);
	const temperatureOffset = (zipSeed % 9) - 4;
	const humidity = 40 + (zipSeed % 28);
	const precipitation = 4 + (zipSeed % 36);
	const currentTemp = 68 + temperatureOffset;
	const high = currentTemp + 4;
	const low = currentTemp - 10;

	return {
		location: resolveLocation(zip),
		zip,
		updatedAt: new Date().toISOString(),
		aqi: 34,
		sunrise: sunrise.toISOString(),
		sunset: sunset.toISOString(),
		dailySummary: 'Cooler air settles in later with a clear evening and low rain risk.',
		alerts: [],
		current: {
			temperature: currentTemp,
			feelsLike: currentTemp + 2,
			condition: 'Partly Cloudy',
			summary: `${resolveLocation(zip)} looks comfortable with a light breeze and clear visibility.`,
			high,
			low,
			humidity,
			wind: '6 mph NW',
			icon: 'cloud'
		},
		forecast: [
			{ day: 'Sat', condition: 'Clear', high: high - 1, low: low - 2, icon: 'sun', precipitationChance: precipitation },
			{ day: 'Sun', condition: 'Light Rain', high: high - 4, low: low - 3, icon: 'rain', precipitationChance: precipitation + 18 },
			{ day: 'Mon', condition: 'Bright', high: high - 2, low: low - 1, icon: 'sun', precipitationChance: precipitation + 6 },
			{ day: 'Tue', condition: 'Cloudy', high: high - 5, low: low, icon: 'cloud', precipitationChance: precipitation + 10 }
		]
	};
}

function makeCalendar(): CalendarResponse {
	return {
		focusDay: new Date().toISOString(),
		providerLabel: 'Agenda',
		nextOpenSlot: '2:15 PM to 5:45 PM',
		syncStatus: 'Saved on this display',
		updatedAt: new Date().toISOString(),
		events: [
			{
				id: 'standup',
				title: 'Design review',
				startsAt: makeIsoTime(9, 30),
				endsAt: makeIsoTime(10, 15),
				location: 'Studio display lab',
				note: 'Review placement, spacing, and theme behavior.',
				color: '#7dd3fc',
				createdBy: 'seed'
			},
			{
				id: 'delivery',
				title: 'Filament delivery window',
				startsAt: makeIsoTime(13, 0),
				endsAt: makeIsoTime(14, 0),
				location: 'Front porch',
				note: 'PLA refill and nozzle kit.',
				color: '#f9a8d4',
				createdBy: 'seed'
			},
			{
				id: 'focus',
				title: 'Quiet build session',
				startsAt: makeIsoTime(18, 30),
				endsAt: makeIsoTime(20, 0),
				location: 'Office',
				note: 'Prototype refinements and printer calibration.',
				color: '#86efac',
				createdBy: 'seed'
			}
		]
	};
}

function assertMode(mode: DemoMode): void {
	if (mode === 'error') {
		throw new Error('Mock service intentionally returned an error state.');
	}
}

export function getMode(searchParams: URLSearchParams): DemoMode {
	const raw = searchParams.get('mode');
	return raw === 'empty' || raw === 'error' ? raw : 'default';
}

function getZip(searchParams: URLSearchParams): string {
	const candidate = searchParams.get('zip')?.trim() ?? '';
	return /^\d{5}$/.test(candidate) ? candidate : '10001';
}

export function getWeatherZip(searchParams: URLSearchParams): string {
	return getZip(searchParams);
}

export async function getMockWeather(mode: DemoMode, zip: string): Promise<WeatherResponse> {
	await delay(480);
	assertMode(mode);

	if (mode === 'empty') {
		return {
			...makeWeather(zip),
			forecast: []
		};
	}

	return makeWeather(zip);
}

export async function getMockCalendar(mode: DemoMode): Promise<CalendarResponse> {
	await delay(620);
	assertMode(mode);

	if (mode === 'empty') {
		return {
			focusDay: new Date().toISOString(),
			providerLabel: 'Agenda',
			nextOpenSlot: 'Open',
			syncStatus: 'Saved on this display',
			updatedAt: new Date().toISOString(),
			events: []
		};
	}

	return makeCalendar();
}
