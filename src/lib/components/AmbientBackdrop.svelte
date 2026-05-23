<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import {
		AMBIENT_PHOTO_DURATION_MS,
		AMBIENT_PHOTO_FADE_DURATION_MS,
		AMBIENT_PHOTO_MOTION_DURATION_MS,
		AMBIENT_PHOTO_MOTION_SCALE
	} from '$lib/config/ambient-photos';
	import { bundledAmbientPhotos } from '$lib/data/ambient-photos';
	import {
		fetchAmbientPhotoManifest,
		filterAmbientPhotos,
		getBundledFallbackPhoto,
		getUsableAmbientPhoto,
		preloadAmbientPhoto
	} from '$lib/services/ambient-photos';
	import { getSavedAmbientPhotoCategories } from '$lib/services/preferences';
	import type { AmbientPhoto, AmbientPhotoManifestResponse } from '$lib/types';

	type LayerName = 'primary' | 'secondary';

	interface LayerState {
		name: LayerName;
		photo: AmbientPhoto;
		visible: boolean;
		motionClass: 'motion-a' | 'motion-b';
	}

	export let intervalMs = AMBIENT_PHOTO_DURATION_MS;
	export let fadeDurationMs = AMBIENT_PHOTO_FADE_DURATION_MS;
	export let motionDurationMs = AMBIENT_PHOTO_MOTION_DURATION_MS;
	export let motionScale = AMBIENT_PHOTO_MOTION_SCALE;

	const bundledFallback = getBundledFallbackPhoto();

	let manifest: AmbientPhotoManifestResponse = {
		source: 'bundled',
		photos: bundledAmbientPhotos,
		categories: ['nature', 'landscapes', 'landmarks', 'cities'],
		fallback: bundledFallback
	};
	let playlist: AmbientPhoto[] = filterAmbientPhotos(bundledAmbientPhotos, getSavedAmbientPhotoCategories());
	let currentIndex = 0;
	let activeLayer: LayerName = 'primary';
	let queuedPhoto: { photo: AmbientPhoto; index: number } | null = null;
	let remainingIndices: number[] = [];
	let rotationTimer: number | undefined;
	let transitionTimer: number | undefined;
	let isDestroyed = false;
	let isTransitioning = false;

	let primaryLayer: LayerState = {
		name: 'primary',
		photo: playlist[0] ?? bundledFallback,
		visible: true,
		motionClass: 'motion-a'
	};
	let secondaryLayer: LayerState = {
		name: 'secondary',
		photo: primaryLayer.photo,
		visible: false,
		motionClass: 'motion-b'
	};

	function getActiveLayer(): LayerState {
		return activeLayer === 'primary' ? primaryLayer : secondaryLayer;
	}

	function getHiddenLayer(): LayerState {
		return activeLayer === 'primary' ? secondaryLayer : primaryLayer;
	}

	function setLayerState(name: LayerName, next: Partial<LayerState>): void {
		if (name === 'primary') {
			primaryLayer = { ...primaryLayer, ...next };
			return;
		}

		secondaryLayer = { ...secondaryLayer, ...next };
	}

	function resolvePlaylist(photos: AmbientPhoto[]): AmbientPhoto[] {
		const selected = getSavedAmbientPhotoCategories();
		const filtered = filterAmbientPhotos(photos, selected);
		return filtered.length > 0 ? filtered : filterAmbientPhotos(bundledAmbientPhotos, []);
	}

	function shuffleIndices(indices: number[]): number[] {
		const shuffled = [...indices];
		for (let index = shuffled.length - 1; index > 0; index -= 1) {
			const swapIndex = Math.floor(Math.random() * (index + 1));
			[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
		}

		return shuffled;
	}

	function refillRemainingIndices(excludeIndex: number): void {
		remainingIndices = shuffleIndices(
			Array.from({ length: playlist.length }, (_, index) => index).filter(
				(index) => index !== excludeIndex
			)
		);
	}

	function clearTimers(): void {
		if (rotationTimer) {
			clearTimeout(rotationTimer);
			rotationTimer = undefined;
		}

		if (transitionTimer) {
			clearTimeout(transitionTimer);
			transitionTimer = undefined;
		}
	}

	function scheduleRotation(): void {
		if (rotationTimer) {
			clearTimeout(rotationTimer);
			rotationTimer = undefined;
		}

		if (playlist.length < 2) {
			return;
		}

		rotationTimer = window.setTimeout(() => {
			void transitionToNextPhoto();
		}, intervalMs);
	}

	async function prepareQueuedPhoto(): Promise<void> {
		if (playlist.length < 2) {
			queuedPhoto = null;
			return;
		}

		queuedPhoto = await findNextUsablePhoto();
	}

	async function findNextUsablePhoto(): Promise<{ photo: AmbientPhoto; index: number }> {
		if (playlist.length < 2) {
			return { photo: playlist[0] ?? manifest.fallback, index: 0 };
		}

		if (remainingIndices.length === 0) {
			refillRemainingIndices(currentIndex);
		}

		const attemptedIndices: number[] = [];

		while (remainingIndices.length > 0) {
			const candidateIndex = remainingIndices.shift();
			if (candidateIndex === undefined) {
				continue;
			}

			attemptedIndices.push(candidateIndex);
			const candidate = playlist[candidateIndex];
			if (!candidate) {
				continue;
			}

			try {
				const dimensions = await preloadAmbientPhoto(candidate.src);
				if (getUsableAmbientPhoto(candidate, dimensions)) {
					return { photo: candidate, index: candidateIndex };
				}
			} catch {
				continue;
			}
		}

		for (const candidateIndex of attemptedIndices) {
			if (candidateIndex !== currentIndex) {
				remainingIndices.push(candidateIndex);
			}
		}

		await preloadAmbientPhoto(manifest.fallback.src).catch(() => undefined);
		return { photo: manifest.fallback, index: 0 };
	}

	async function findUsablePhotoAtIndex(index: number): Promise<{ photo: AmbientPhoto; index: number } | null> {
		const candidate = playlist[index];
		if (!candidate) {
			return null;
		}

		try {
			const dimensions = await preloadAmbientPhoto(candidate.src);
			if (getUsableAmbientPhoto(candidate, dimensions)) {
				return { photo: candidate, index };
			}
		} catch {
			return null;
		}

		return null;
	}

	async function transitionToNextPhoto(): Promise<void> {
		if (isTransitioning || playlist.length < 2) {
			return;
		}

		isTransitioning = true;
		if (!queuedPhoto || queuedPhoto.index === currentIndex) {
			await prepareQueuedPhoto();
		}
		const next = queuedPhoto ?? (await findNextUsablePhoto());

		if (isDestroyed) {
			return;
		}

		const currentLayerName = activeLayer;
		const incomingLayerName: LayerName = currentLayerName === 'primary' ? 'secondary' : 'primary';
		const currentMotionClass = currentLayerName === 'primary' ? primaryLayer.motionClass : secondaryLayer.motionClass;

		setLayerState(incomingLayerName, {
			photo: next.photo,
			visible: false,
			motionClass: currentMotionClass === 'motion-a' ? 'motion-b' : 'motion-a'
		});

		await tick();

		requestAnimationFrame(() => {
			setLayerState(incomingLayerName, { visible: true });
			setLayerState(currentLayerName, { visible: false });
		});

		transitionTimer = window.setTimeout(() => {
			activeLayer = incomingLayerName;
			currentIndex = next.index;
			queuedPhoto = null;
			isTransitioning = false;
			void prepareQueuedPhoto();
			scheduleRotation();
		}, fadeDurationMs + 80);
	}

	async function initializeLayers(): Promise<void> {
		const initialCandidates = shuffleIndices(
			Array.from({ length: playlist.length }, (_, index) => index)
		);
		const initialIndex = initialCandidates[0] ?? 0;

		if (playlist.length > 1) {
			remainingIndices = initialCandidates.slice(1);
		} else {
			remainingIndices = [];
		}

		const firstPhoto = (await findUsablePhotoAtIndex(initialIndex)) ?? (await findNextUsablePhoto());
		if (isDestroyed) {
			return;
		}

		currentIndex = firstPhoto.index;
		refillRemainingIndices(currentIndex);
		primaryLayer = {
			name: 'primary',
			photo: firstPhoto.photo,
			visible: true,
			motionClass: 'motion-a'
		};
		secondaryLayer = {
			name: 'secondary',
			photo: firstPhoto.photo,
			visible: false,
			motionClass: 'motion-b'
		};
		activeLayer = 'primary';
		queuedPhoto = null;
	}

	async function loadManifest(): Promise<void> {
		try {
			manifest = await fetchAmbientPhotoManifest(fetch);
		} catch {
			manifest = {
				source: 'bundled',
				photos: bundledAmbientPhotos,
				categories: ['nature', 'landscapes', 'landmarks', 'cities'],
				fallback: bundledFallback
			};
		}

		playlist = resolvePlaylist(manifest.photos);
		if (playlist.length === 0) {
			playlist = [manifest.fallback];
		}

		await initializeLayers();
		await prepareQueuedPhoto();
		scheduleRotation();
	}

	onMount(() => {
		void loadManifest();
	});

	onDestroy(() => {
		isDestroyed = true;
		clearTimers();
	});
</script>

<div
	class="backdrop"
	aria-hidden="true"
	style={`--ambient-fade-duration: ${fadeDurationMs}ms; --ambient-motion-duration: ${motionDurationMs}ms; --ambient-motion-end-scale: ${1 + motionScale};`}
>
	<img
		class:visible={primaryLayer.visible}
		class={`scene ${primaryLayer.motionClass}`}
		src={primaryLayer.photo.src}
		alt=""
		draggable="false"
		fetchpriority="high"
	/>
	<img
		class:visible={secondaryLayer.visible}
		class={`scene ${secondaryLayer.motionClass}`}
		src={secondaryLayer.photo.src}
		alt=""
		draggable="false"
	/>
	<div class="veil"></div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: #091019;
	}

	.scene {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center center;
		opacity: 0;
		transform: scale(1.006) translate3d(0, 0, 0);
		transform-origin: center center;
		filter: saturate(1.01) contrast(1.02) brightness(0.96);
		transition: opacity var(--ambient-fade-duration) cubic-bezier(0.22, 1, 0.36, 1);
		will-change: opacity, transform;
		backface-visibility: hidden;
		image-rendering: auto;
	}

	.scene.visible {
		opacity: 1;
	}

	.motion-a {
		animation: drift-a var(--ambient-motion-duration) ease-in-out infinite alternate;
	}

	.motion-b {
		animation: drift-b var(--ambient-motion-duration) ease-in-out infinite alternate;
	}

	.veil {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at center, var(--ambient-veil-center), transparent 38%),
			radial-gradient(circle at top left, var(--ambient-veil-edge), transparent 26%),
			radial-gradient(circle at top center, color-mix(in srgb, var(--ambient-veil-edge) 46%, transparent), transparent 42%),
			linear-gradient(
				to top,
				rgba(0, 0, 0, 0.72) 0%,
				rgba(0, 0, 0, 0.44) 22%,
				rgba(0, 0, 0, 0.08) 48%,
				transparent 68%
			);
	}

	@keyframes drift-a {
		from {
			transform: scale(1.006) translate3d(0, 0, 0);
		}
		to {
			transform: scale(var(--ambient-motion-end-scale)) translate3d(-0.35%, -0.18%, 0);
		}
	}

	@keyframes drift-b {
		from {
			transform: scale(1.006) translate3d(0, 0, 0);
		}
		to {
			transform: scale(var(--ambient-motion-end-scale)) translate3d(0.28%, -0.16%, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scene {
			animation: none;
			transform: scale(1.004);
		}
	}

</style>
