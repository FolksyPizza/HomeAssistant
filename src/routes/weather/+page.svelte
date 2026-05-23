<script lang="ts">
	import { onMount } from 'svelte';
	import DockNav from '$components/DockNav.svelte';
	import WeatherCard from '$components/WeatherCard.svelte';
	import ZipCodeField from '$components/ZipCodeField.svelte';
	import { fetchWeather, isWeatherEmpty, loadResource } from '$lib/services/api';
	import {
		getSavedPreferences,
		isValidZip,
		saveZip,
		sanitizeZip,
		updatePreferences
	} from '$lib/services/preferences';
	import type { NavItem, ResourceState, WeatherResponse } from '$lib/types';

	const navItems: NavItem[] = [
		{ label: 'Home', href: '/', description: 'Clock', icon: '⌂' },
		{ label: 'Weather', href: '/weather', description: 'Forecast', icon: '☁' },
		{ label: 'Calendar', href: '/calendar', description: 'Agenda', icon: '☷' },
		{ label: 'Assistant', href: '/assistant', description: 'Talk', icon: '◉' },
		{ label: 'Settings', href: '/settings', description: 'Display', icon: '⚙' }
	];

	let preferences = getSavedPreferences();
	let zip = preferences.weather.zip;
	let zipMessage = '';
	let weatherState: ResourceState<WeatherResponse> = { status: 'loading' };

	async function refresh(): Promise<void> {
		preferences = getSavedPreferences();
		zip = preferences.weather.zip;
		weatherState = { status: 'loading' };
		weatherState = await loadResource(
			() => fetchWeather(fetch, preferences.weather.zip, preferences.developer.weatherDemoMode),
			isWeatherEmpty
		);
	}

	function handleZipSave(event: CustomEvent<{ zip: string }>): void {
		const nextZip = sanitizeZip(event.detail.zip);
		if (!isValidZip(nextZip)) {
			zipMessage = 'Enter a valid 5-digit ZIP code.';
			return;
		}
		const savedZip = saveZip(nextZip);
		preferences = updatePreferences((c) => ({ ...c, weather: { ...c.weather, zip: savedZip } }));
		zip = savedZip;
		zipMessage = `Updated for ZIP ${savedZip}.`;
		void refresh();
	}

	onMount(() => { void refresh(); });
</script>

<svelte:head><title>Weather | Smart Display</title></svelte:head>

<div class="overlay-page">
	<div class="overlay-panel">
		<header class="overlay-header">
			<div>
				<p class="overlay-eyebrow">Weather</p>
				<h1 class="overlay-title">Forecast</h1>
			</div>
		</header>

		<div class="overlay-body">
			<div class="weather-layout">
				<div class="weather-main">
					<WeatherCard state={weatherState} />
				</div>
				<div class="weather-side">
					<div class="info-card">
						<ZipCodeField
							value={zip}
							label="Home ZIP code"
							helper="Used for weather on home screen and this view."
							buttonLabel="Save"
							on:save={handleZipSave}
						/>
						{#if zipMessage}<p class="feedback">{zipMessage}</p>{/if}
					</div>
					<div class="info-card">
						<p class="info-label">Details</p>
						<div class="info-rows">
							<div class="info-row">
								<span>Units</span>
								<strong>{preferences.weather.units === 'imperial' ? 'Imperial (°F)' : 'Metric (°C)'}</strong>
							</div>
							<div class="info-row">
								<span>Sun times</span>
								<strong>{preferences.weather.showSunTimes ? 'Shown' : 'Hidden'}</strong>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<footer class="overlay-footer">
			<DockNav items={navItems} />
		</footer>
	</div>
</div>

<style>
	.weather-layout {
		display: grid;
		grid-template-columns: 1fr minmax(18rem, 24rem);
		gap: 1rem;
		align-items: start;
	}

	.info-card {
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		padding: 1rem 1.1rem;
		margin-bottom: 0.75rem;
	}

	:root[data-theme='light'] .info-card {
		background: rgba(0, 0, 0, 0.03);
	}

	.info-label {
		margin: 0 0 0.75rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.info-rows {
		display: grid;
		gap: 0.5rem;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--border-soft);
	}

	.info-row:last-child { border-bottom: none; }

	.info-row span {
		font-size: 0.84rem;
		color: var(--text-secondary);
	}

	.info-row strong {
		font-size: 0.84rem;
		color: var(--text-primary);
	}

	.feedback {
		margin: 0.5rem 0 0;
		font-size: 0.84rem;
		color: var(--text-secondary);
	}

	@media (max-width: 900px) {
		.weather-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
