<script lang="ts">
	import type { WeatherIcon } from '$lib/types';

	export let time = '';
	export let shortDay = '';
	export let temperature: number | undefined = undefined;
	export let weatherIcon: WeatherIcon | undefined = undefined;

	const weatherSymbols: Record<WeatherIcon, string> = {
		sun: '☀',
		cloud: '☁',
		rain: '🌦',
		storm: '⛈',
		moon: '☽'
	};
</script>

<div class="nest-clock">
	<p class="nest-date">{shortDay}</p>
	<div class="nest-time-row">
		<span class="nest-time">{time}</span>
		{#if temperature !== undefined && weatherIcon}
			<span class="nest-weather">
				<span class="weather-icon">{weatherSymbols[weatherIcon]}</span>
				<span class="weather-temp">{temperature}°</span>
			</span>
		{/if}
	</div>
</div>

<style>
	.nest-clock {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.nest-date {
		margin: 0;
		font-size: clamp(1rem, 1.8vw, 1.4rem);
		font-weight: 500;
		color: rgba(255, 255, 255, 0.88);
		letter-spacing: 0.01em;
		text-shadow: 0 1px 8px rgba(0, 0, 0, 0.6);
	}

	.nest-time-row {
		display: flex;
		align-items: baseline;
		gap: 0.6em;
	}

	.nest-time {
		font-size: clamp(4.5rem, 10vw, 7.5rem);
		font-weight: 300;
		line-height: 1;
		letter-spacing: -0.04em;
		color: #fff;
		text-shadow: 0 2px 24px rgba(0, 0, 0, 0.5);
	}

	.nest-weather {
		display: flex;
		align-items: center;
		gap: 0.25em;
		font-size: clamp(1.4rem, 3vw, 2.2rem);
		font-weight: 400;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 1px 10px rgba(0, 0, 0, 0.5);
		margin-bottom: 0.15em;
	}

	.weather-icon {
		font-size: 0.9em;
	}

	.weather-temp {
		font-size: 1em;
		letter-spacing: -0.02em;
	}
</style>
