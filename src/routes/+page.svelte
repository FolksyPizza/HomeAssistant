<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import AmbientClock from '$components/AmbientClock.svelte';
	import DockNav from '$components/DockNav.svelte';
	import {
		fetchWeather,
		isWeatherEmpty,
		loadResource
	} from '$lib/services/api';
	import { getSavedPreferences, updatePreferences } from '$lib/services/preferences';
	import type { NavItem, ResourceState, WeatherResponse } from '$lib/types';
	import { formatClock, formatShortDate } from '$lib/utils/format';

	const navItems: NavItem[] = [
		{ label: 'Home', href: '/', description: 'Clock', icon: '⌂' },
		{ label: 'Weather', href: '/weather', description: 'Forecast', icon: '☁' },
		{ label: 'Calendar', href: '/calendar', description: 'Agenda', icon: '☷' },
		{ label: 'Assistant', href: '/assistant', description: 'Talk', icon: '◉' },
		{ label: 'Settings', href: '/settings', description: 'Display', icon: '⚙' }
	];

	let now = new Date();
	let clockHandle: number | undefined;
	let weatherState: ResourceState<WeatherResponse> = { status: 'loading' };
	let preferences = getSavedPreferences();

	// Nav auto-hide
	let navVisible = false;
	let navHideTimer: number | undefined;

	function showNav(): void {
		navVisible = true;
		if (navHideTimer) clearTimeout(navHideTimer);
		navHideTimer = window.setTimeout(() => {
			navVisible = false;
		}, 4000);
	}

	function toggleSleepMode(): void {
		preferences = updatePreferences((current) => ({
			...current,
			voice: { ...current.voice, sleepMode: !current.voice.sleepMode }
		}));
	}

	onMount(() => {
		clockHandle = window.setInterval(() => { now = new Date(); }, 1000);

		loadResource(
			() => fetchWeather(fetch, preferences.weather.zip, preferences.developer.weatherDemoMode),
			isWeatherEmpty
		).then((result) => { weatherState = result; });
	});

	onDestroy(() => {
		if (clockHandle) clearInterval(clockHandle);
		if (navHideTimer) clearTimeout(navHideTimer);
	});

	$: temperature = weatherState.status === 'success' ? weatherState.data.current.temperature : undefined;
	$: weatherIcon = weatherState.status === 'success' ? weatherState.data.current.icon : undefined;

	function getGreeting(date: Date): string {
		const h = date.getHours();
		const name = preferences.user.name;
		const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
		return name ? `${salutation}, ${name}` : salutation;
	}
</script>

<svelte:head>
	<title>Smart Display</title>
</svelte:head>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="nest-shell" on:click={showNav}>

	<!-- Top-right controls -->
	<div class="top-controls">
		<button
			class="icon-btn"
			class:active={preferences.voice.sleepMode}
			type="button"
			title={preferences.voice.sleepMode ? 'Wake assistant' : 'Sleep mode'}
			on:click|stopPropagation={toggleSleepMode}
		>
			{preferences.voice.sleepMode ? '☽' : '☼'}
		</button>
		<a class="icon-btn" href="/settings" on:click|stopPropagation title="Settings">⚙</a>
	</div>

	<!-- Bottom-left clock + weather overlay -->
	<div class="clock-overlay">
		<p class="greeting">{getGreeting(now)}</p>
		<AmbientClock
			shortDay={formatShortDate(now)}
			time={formatClock(now)}
			{temperature}
			{weatherIcon}
		/>
	</div>

	<!-- Auto-hide dock nav -->
	<div class="dock-overlay" class:dock-visible={navVisible}>
		<DockNav items={navItems} />
	</div>

	<!-- Dock toggle arrow -->
	<button
		class="dock-toggle"
		class:dock-open={navVisible}
		type="button"
		aria-label={navVisible ? 'Close navigation' : 'Open navigation'}
		on:click|stopPropagation={navVisible ? () => { navVisible = false; if (navHideTimer) clearTimeout(navHideTimer); } : showNav}
	>
		<svg viewBox="0 0 18 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<path d="M1.5 8.5 9 1.5l7.5 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>
	</button>
</div>

<style>
	.nest-shell {
		position: fixed;
		inset: 0;
		overflow: hidden;
		cursor: default;
	}

	/* Top-right controls */
	.top-controls {
		position: absolute;
		top: 1.1rem;
		right: 1.1rem;
		z-index: 20;
		display: flex;
		gap: 0.4rem;
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: var(--radius);
		background: rgba(0, 0, 0, 0.36);
		border: 1px solid rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(10px);
		color: rgba(255, 255, 255, 0.82);
		font-size: 1rem;
		text-decoration: none;
		cursor: pointer;
		transition: background 150ms ease;
	}

	.icon-btn:hover,
	.icon-btn:focus-visible {
		background: rgba(0, 0, 0, 0.52);
		outline: none;
	}

	.icon-btn.active {
		background: rgba(138, 180, 255, 0.2);
		border-color: rgba(138, 180, 255, 0.32);
		color: #8ab4ff;
	}

	/* Bottom-left clock */
	.clock-overlay {
		position: absolute;
		bottom: 2.8rem;
		left: 2rem;
		z-index: 20;
	}

	.greeting {
		margin: 0 0 0.3rem;
		font-size: 0.9rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.65);
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
		letter-spacing: 0.01em;
	}

	/* Auto-hide dock */
	.dock-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 30;
		transform: translateY(100%);
		transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
		pointer-events: none;
		background: var(--nav-surface);
		border-top: 1px solid var(--border-soft);
		backdrop-filter: blur(16px);
	}

	.dock-overlay.dock-visible {
		transform: translateY(0);
		pointer-events: auto;
	}

	/* Dock toggle arrow */
	.dock-toggle {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 31;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.2rem;
		height: 1.6rem;
		padding: 0;
		background: rgba(0, 0, 0, 0.28);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: none;
		border-radius: var(--radius) var(--radius) 0 0;
		backdrop-filter: blur(10px);
		color: rgba(255, 255, 255, 0.5);
		cursor: pointer;
		transition: color 150ms ease, background 150ms ease;
	}

	.dock-toggle svg {
		width: 18px;
		height: 10px;
		transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.dock-toggle.dock-open svg {
		transform: rotate(180deg);
	}

	.dock-toggle:hover,
	.dock-toggle:focus-visible {
		color: rgba(255, 255, 255, 0.88);
		background: rgba(0, 0, 0, 0.44);
		outline: none;
	}
</style>
