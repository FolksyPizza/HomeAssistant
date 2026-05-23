import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMode, getWeatherZip } from '$lib/server/mock-data';
import { getWeatherProvider } from '$lib/server/weather';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const mode = getMode(url.searchParams);
		const zip = getWeatherZip(url.searchParams);
		const data = await getWeatherProvider().getForecast(zip, mode);
		return json(data);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown weather error';
		return json({ message }, { status: 500 });
	}
};
