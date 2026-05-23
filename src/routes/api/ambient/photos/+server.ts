import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAmbientPhotoManifest } from '$lib/server/ambient-photos';

export const GET: RequestHandler = async () => {
	try {
		return json(await getAmbientPhotoManifest());
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown ambient photo error';
		return json({ message }, { status: 500 });
	}
};
