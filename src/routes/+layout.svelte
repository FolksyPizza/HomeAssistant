<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import '@fontsource-variable/manrope';
	import AmbientBackdrop from '$components/AmbientBackdrop.svelte';
	import { applyTheme, getPreferredTheme } from '$lib/services/theme';
	import { getSavedPreferences } from '$lib/services/preferences';
	import '../styles.css';

	// Page order for swipe navigation
	const ROUTES = ['/', '/weather', '/calendar', '/assistant', '/settings'];
	const SETUP_ROUTE = '/setup';

	let touchStartX = 0;
	let touchStartY = 0;
	let preferences = getSavedPreferences();

	function handleTouchStart(e: TouchEvent): void {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent): void {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		if (Math.abs(dx) < 72 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
		const currentPath = $page.url.pathname;
		const idx = ROUTES.indexOf(currentPath);
		if (idx === -1) return;
		if (dx < 0 && idx < ROUTES.length - 1) void goto(ROUTES[idx + 1]);
		else if (dx > 0 && idx > 0) void goto(ROUTES[idx - 1]);
	}

	function navPrev(): void {
		const idx = ROUTES.indexOf($page.url.pathname);
		if (idx > 0) void goto(ROUTES[idx - 1]);
	}

	function navNext(): void {
		const idx = ROUTES.indexOf($page.url.pathname);
		if (idx !== -1 && idx < ROUTES.length - 1) void goto(ROUTES[idx + 1]);
	}

	$: currentIdx = ROUTES.indexOf($page.url.pathname);
	$: hasPrev = currentIdx > 0;
	$: hasNext = currentIdx !== -1 && currentIdx < ROUTES.length - 1;
	$: onSetup = $page.url.pathname === SETUP_ROUTE;

	onMount(() => {
		applyTheme(getPreferredTheme());
		preferences = getSavedPreferences();
		// First-run: redirect to setup wizard if not complete
		if (!preferences.user.setupComplete && $page.url.pathname !== SETUP_ROUTE) {
			void goto(SETUP_ROUTE);
		}
	});
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="swipe-root"
	on:touchstart={handleTouchStart}
	on:touchend={handleTouchEnd}
>
	<!-- Persistent ambient photo backdrop — never unmounts on route change -->
	<AmbientBackdrop
		intervalMs={preferences.ambient.photoDurationMinutes * 60000}
		fadeDurationMs={preferences.ambient.fadeDurationSeconds * 1000}
		motionScale={preferences.kiosk.reduceAmbientMotion || !preferences.ambient.motionEnabled ? 0 : 0.03}
	/>

	<slot />

	<!-- Edge nav arrows — hidden on setup wizard -->
	{#if !onSetup}
		{#if hasPrev}
			<button class="edge-arrow edge-arrow--left" type="button" on:click={navPrev} aria-label="Previous page">
				<svg viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
					<path d="M8.5 1.5 1.5 9l7 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		{/if}
		{#if hasNext}
			<button class="edge-arrow edge-arrow--right" type="button" on:click={navNext} aria-label="Next page">
				<svg viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
					<path d="M1.5 1.5 8.5 9l-7 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
		{/if}
	{/if}
</div>

<style>
	.swipe-root {
		min-height: 100vh;
		touch-action: pan-y;
		position: relative;
	}

	.edge-arrow {
		position: fixed;
		top: 50%;
		transform: translateY(-50%);
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 3.6rem;
		padding: 0;
		background: rgba(0, 0, 0, 0.22);
		border: 1px solid rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(8px);
		color: rgba(255, 255, 255, 0.55);
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease, opacity 150ms ease;
		opacity: 0.7;
	}

	.edge-arrow--left {
		left: 0;
		border-radius: 0 var(--radius) var(--radius) 0;
		border-left: none;
	}

	.edge-arrow--right {
		right: 0;
		border-radius: var(--radius) 0 0 var(--radius);
		border-right: none;
	}

	.edge-arrow svg {
		width: 10px;
		height: 18px;
		flex-shrink: 0;
	}

	.edge-arrow:hover,
	.edge-arrow:focus-visible {
		color: rgba(255, 255, 255, 0.9);
		background: rgba(0, 0, 0, 0.44);
		opacity: 1;
		outline: none;
	}

	:global([data-theme='light']) .edge-arrow {
		background: rgba(255, 255, 255, 0.5);
		border-color: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.45);
	}

	:global([data-theme='light']) .edge-arrow:hover {
		background: rgba(255, 255, 255, 0.82);
		color: rgba(0, 0, 0, 0.75);
	}
</style>
