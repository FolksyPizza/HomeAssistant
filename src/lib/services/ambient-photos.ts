import { bundledAmbientFallbackId, bundledAmbientPhotos } from '$lib/data/ambient-photos';
import type {
	AmbientPhoto,
	AmbientPhotoCategory,
	AmbientPhotoManifestResponse
} from '$lib/types';
import {
	getAmbientPhotoDimensions,
	isAmbientPhotoDisplayQuality,
	type AmbientPhotoDimensions
} from '$lib/utils/ambient-photos';

export function filterAmbientPhotos(
	photos: AmbientPhoto[],
	selectedCategories: AmbientPhotoCategory[]
): AmbientPhoto[] {
	return photos.filter((photo) => {
		const categoryMatch =
			selectedCategories.length === 0 ||
			photo.categories.some((category) => selectedCategories.includes(category));

		return categoryMatch && isAmbientPhotoDisplayQuality(photo);
	});
}

export async function fetchAmbientPhotoManifest(
	fetcher: typeof fetch
): Promise<AmbientPhotoManifestResponse> {
	const response = await fetcher('/api/ambient/photos');

	if (!response.ok) {
		throw new Error(`Ambient photos request failed with ${response.status}`);
	}

	return (await response.json()) as AmbientPhotoManifestResponse;
}

export function getBundledFallbackPhoto(): AmbientPhoto {
	return (
		bundledAmbientPhotos.find((photo) => photo.id === bundledAmbientFallbackId) ??
		bundledAmbientPhotos[0]
	);
}

export function getNextPhotoIndex(currentIndex: number, total: number): number {
	if (total <= 1) {
		return 0;
	}

	return (currentIndex + 1) % total;
}

export function preloadAmbientPhoto(src: string): Promise<AmbientPhotoDimensions> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.decoding = 'async';

		image.onload = async () => {
			try {
				if ('decode' in image) {
					await image.decode();
				}
			} catch {
				// Ignore decode failures and keep the successful onload result.
			}

			resolve({
				width: image.naturalWidth,
				height: image.naturalHeight
			});
		};
		image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
		image.src = src;
	});
}

export function getUsableAmbientPhoto(
	photo: AmbientPhoto,
	dimensions?: AmbientPhotoDimensions | null
): AmbientPhoto | null {
	return isAmbientPhotoDisplayQuality(photo, dimensions ?? getAmbientPhotoDimensions(photo))
		? photo
		: null;
}
