import { getMockWeather } from '$lib/server/mock-data';
import type { DemoMode, WeatherResponse } from '$lib/types';

export interface WeatherProvider {
	getForecast(zip: string, mode: DemoMode): Promise<WeatherResponse>;
}

class MockWeatherProvider implements WeatherProvider {
	async getForecast(zip: string, mode: DemoMode): Promise<WeatherResponse> {
		return getMockWeather(mode, zip);
	}
}

export function getWeatherProvider(): WeatherProvider {
	return new MockWeatherProvider();
}
