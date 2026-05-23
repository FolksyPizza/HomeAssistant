import {
	AMBIENT_PHOTO_MAX_ASPECT_RATIO,
	AMBIENT_PHOTO_MIN_HEIGHT,
	AMBIENT_PHOTO_MIN_MEGAPIXELS,
	AMBIENT_PHOTO_MIN_WIDTH,
	AMBIENT_PHOTO_MIN_ASPECT_RATIO
} from '$lib/config/ambient-photos';
import type { AmbientPhoto } from '$lib/types';

export interface AmbientPhotoDimensions {
	width: number;
	height: number;
}

export function getAmbientPhotoDimensions(photo: AmbientPhoto): AmbientPhotoDimensions | null {
	if (!photo.width || !photo.height) {
		return null;
	}

	return {
		width: photo.width,
		height: photo.height
	};
}

export function meetsAmbientPhotoResolution(dimensions: AmbientPhotoDimensions): boolean {
	return dimensions.width >= AMBIENT_PHOTO_MIN_WIDTH && dimensions.height >= AMBIENT_PHOTO_MIN_HEIGHT;
}

export function getAmbientPhotoAspectRatio(dimensions: AmbientPhotoDimensions): number {
	return dimensions.width / dimensions.height;
}

export function getAmbientPhotoMegapixels(dimensions: AmbientPhotoDimensions): number {
	return dimensions.width * dimensions.height / 1_000_000;
}

export function meetsAmbientPhotoComposition(dimensions: AmbientPhotoDimensions): boolean {
	const aspectRatio = getAmbientPhotoAspectRatio(dimensions);
	return (
		aspectRatio >= AMBIENT_PHOTO_MIN_ASPECT_RATIO &&
		aspectRatio <= AMBIENT_PHOTO_MAX_ASPECT_RATIO &&
		getAmbientPhotoMegapixels(dimensions) >= AMBIENT_PHOTO_MIN_MEGAPIXELS
	);
}

export function isAmbientPhotoDisplayQuality(
	photo: AmbientPhoto,
	dimensions?: AmbientPhotoDimensions | null
): boolean {
	const resolved = dimensions ?? getAmbientPhotoDimensions(photo);
	return resolved ? meetsAmbientPhotoResolution(resolved) && meetsAmbientPhotoComposition(resolved) : true;
}
