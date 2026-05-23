import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRuntimeConfig } from '$lib/server/runtime';

export const GET: RequestHandler = async () => {
	return json(getRuntimeConfig());
};
