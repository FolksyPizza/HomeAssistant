import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLocalAmbientPhotoFile } from '$lib/server/ambient-photos';

export const GET: RequestHandler = async ({ params }) => {
	const asset = await getLocalAmbientPhotoFile(params.id);

	if (!asset) {
		throw error(404, 'Ambient photo not found');
	}

	return new Response(Buffer.from(asset.file), {
		headers: {
			'content-type': asset.mimeType,
			'cache-control': 'public, max-age=3600'
		}
	});
};
