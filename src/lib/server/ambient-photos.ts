import { env } from '$env/dynamic/private';
import {
	ambientPhotoCategories,
	bundledAmbientFallbackId,
	bundledAmbientPhotos
} from '$lib/data/ambient-photos';
import type {
	AmbientPhoto,
	AmbientPhotoCategory,
	AmbientPhotoManifestResponse,
	AmbientPhotoSourceKind
} from '$lib/types';
import { isAmbientPhotoDisplayQuality } from '$lib/utils/ambient-photos';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_AMBIENT_PHOTO_DIR = path.resolve(process.cwd(), 'static/photos/curated');
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const localFileRegistry = new Map<string, { filePath: string; mimeType: string }>();

function sanitizeCategories(categories: string[] | string | undefined): AmbientPhotoCategory[] {
	const raw = Array.isArray(categories) ? categories : categories ? [categories] : [];
	const filtered = raw.filter((entry): entry is AmbientPhotoCategory =>
		ambientPhotoCategories.includes(entry as AmbientPhotoCategory)
	);

	return filtered.length > 0 ? filtered : ['landscapes'];
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function titleFromFilename(filename: string): string {
	return path
		.basename(filename, path.extname(filename))
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function mimeTypeForFile(filename: string): string {
	switch (path.extname(filename).toLowerCase()) {
		case '.png':
			return 'image/png';
		case '.webp':
			return 'image/webp';
		case '.avif':
			return 'image/avif';
		default:
			return 'image/jpeg';
	}
}

function getFallbackPhoto(): AmbientPhoto {
	return (
		bundledAmbientPhotos.find((photo) => photo.id === bundledAmbientFallbackId) ??
		bundledAmbientPhotos[0]
	);
}

function filterDisplayQualityPhotos(photos: AmbientPhoto[]): AmbientPhoto[] {
	return photos.filter((photo) =>
		photo.width && photo.height ? isAmbientPhotoDisplayQuality(photo) : true
	);
}

function resolveAmbientPhotoSource(): AmbientPhotoSourceKind {
	const source = env.AMBIENT_PHOTO_SOURCE?.trim();
	return source === 'local-directory' || source === 'remote' ? source : 'bundled';
}

function getAmbientPhotoDirectory(): string {
	return env.AMBIENT_PHOTO_DIR?.trim() || DEFAULT_AMBIENT_PHOTO_DIR;
}

async function exists(target: string): Promise<boolean> {
	try {
		await access(target);
		return true;
	} catch {
		return false;
	}
}

async function loadBundledAmbientPhotos(): Promise<AmbientPhotoManifestResponse> {
	const photos = filterDisplayQualityPhotos(bundledAmbientPhotos);

	return {
		source: 'bundled',
		photos,
		categories: ambientPhotoCategories,
		fallback: getFallbackPhoto()
	};
}

async function loadLocalDirectoryAmbientPhotos(): Promise<AmbientPhotoManifestResponse> {
	const directory = getAmbientPhotoDirectory();
	const manifestPath = path.join(directory, 'manifest.json');
	localFileRegistry.clear();

	let photos: AmbientPhoto[] = [];

	if (await exists(manifestPath)) {
		const raw = await readFile(manifestPath, 'utf8');
		const manifest = JSON.parse(raw) as {
			photos?: Array<{
				id?: string;
				file: string;
				category?: string;
				categories?: string[];
				title?: string;
				width?: number;
				height?: number;
				location?: string;
				photographerCredit?: string;
				creditUrl?: string;
				sourceUrl?: string;
			}>;
		};

		photos = (manifest.photos ?? []).map((photo) => {
			const id = photo.id ?? toSlug(photo.file);
			const filePath = path.join(directory, photo.file);
			localFileRegistry.set(id, {
				filePath,
				mimeType: mimeTypeForFile(photo.file)
			});

			return {
				id,
				src: `/api/ambient/photos/file/${id}`,
				categories: sanitizeCategories(photo.categories ?? photo.category),
				title: photo.title ?? titleFromFilename(photo.file),
				width: photo.width,
				height: photo.height,
				location: photo.location,
				photographerCredit: photo.photographerCredit,
				creditUrl: photo.creditUrl,
				sourceUrl: photo.sourceUrl
			};
		});
	} else {
		const files = await readdir(directory);
		photos = files
			.filter((file) => SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
			.sort()
			.map((file) => {
				const id = toSlug(file);
				const filePath = path.join(directory, file);
				localFileRegistry.set(id, {
					filePath,
					mimeType: mimeTypeForFile(file)
				});

				return {
					id,
					src: `/api/ambient/photos/file/${id}`,
					categories: ['landscapes'],
					title: titleFromFilename(file),
					width: undefined,
					height: undefined
				};
			});
	}

	if (photos.length === 0) {
		return loadBundledAmbientPhotos();
	}

	return {
		source: 'local-directory',
		photos: filterDisplayQualityPhotos(photos),
		categories: ambientPhotoCategories,
		fallback: getFallbackPhoto()
	};
}

async function loadRemoteAmbientPhotos(): Promise<AmbientPhotoManifestResponse> {
	const manifestUrl = env.AMBIENT_PHOTO_REMOTE_MANIFEST_URL?.trim();

	if (!manifestUrl) {
		return loadBundledAmbientPhotos();
	}

	const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
	if (!response.ok) {
		throw new Error(`Remote photo manifest returned ${response.status}`);
	}

	const payload = (await response.json()) as Partial<AmbientPhotoManifestResponse>;
	if (!payload.photos?.length) {
		return loadBundledAmbientPhotos();
	}

	return {
		source: 'remote',
		photos: filterDisplayQualityPhotos(
			payload.photos.map((photo) => ({
				id: photo.id ?? toSlug(photo.src ?? photo.title ?? 'ambient-photo'),
				src: photo.src ?? getFallbackPhoto().src,
				categories: sanitizeCategories(photo.categories),
				title: photo.title ?? 'Ambient Photo',
				width: photo.width,
				height: photo.height,
				location: photo.location,
				photographerCredit: photo.photographerCredit,
				creditUrl: photo.creditUrl,
				sourceUrl: photo.sourceUrl
			}))
		),
		categories: ambientPhotoCategories,
		fallback: getFallbackPhoto()
	};
}

export async function getAmbientPhotoManifest(): Promise<AmbientPhotoManifestResponse> {
	switch (resolveAmbientPhotoSource()) {
		case 'local-directory':
			return loadLocalDirectoryAmbientPhotos();
		case 'remote':
			return loadRemoteAmbientPhotos();
		default:
			return loadBundledAmbientPhotos();
	}
}

export async function getLocalAmbientPhotoFile(
	id: string
): Promise<{ file: Uint8Array; mimeType: string } | null> {
	if (!localFileRegistry.has(id)) {
		await loadLocalDirectoryAmbientPhotos();
	}

	const entry = localFileRegistry.get(id);
	if (!entry) {
		return null;
	}

	return {
		file: await readFile(entry.filePath),
		mimeType: entry.mimeType
	};
}
