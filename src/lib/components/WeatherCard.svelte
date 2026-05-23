<script lang="ts">
	import AsyncState from '$components/AsyncState.svelte';
	import CardShell from '$components/CardShell.svelte';
	import type { ResourceState, WeatherIcon, WeatherResponse } from '$lib/types';

	export let state: ResourceState<WeatherResponse>;

	function iconPath(icon: WeatherIcon): string {
		switch (icon) {
			case 'sun':
				return 'M12 4.5V2m0 20v-2.5m7.5-7.5H22M2 12h2.5m12.8 5.3 1.8 1.8M4.9 4.9 6.7 6.7m10.6 0 1.8-1.8M4.9 19.1l1.8-1.8M12 17.1a5.1 5.1 0 1 0 0-10.2 5.1 5.1 0 0 0 0 10.2Z';
			case 'rain':
				return 'M7 18.5a2.3 2.3 0 0 1 0-4.6h.5A5.7 5.7 0 0 1 18.4 11a3.6 3.6 0 0 1-.4 7.2H7Zm2.5 3-1 1.8m5-1.8-1 1.8m5-1.8-1 1.8';
			case 'storm':
				return 'M7 18.5a2.3 2.3 0 0 1 0-4.6h.5A5.7 5.7 0 0 1 18.4 11a3.6 3.6 0 0 1-.4 7.2H7Zm5-7-2 4h2l-1 4 4-5h-2l2-3z';
			case 'moon':
				return 'M18.8 14.8A7.2 7.2 0 0 1 9.2 5.2a7.7 7.7 0 1 0 9.6 9.6Z';
			default:
				return 'M7 18.5a2.3 2.3 0 0 1 0-4.6h.5A5.7 5.7 0 0 1 18.4 11a3.6 3.6 0 0 1-.4 7.2H7Z';
		}
	}
</script>

<CardShell title="Weather" eyebrow="Forecast">
	{#if state.status === 'loading'}
		<AsyncState
			variant="loading"
			title="Checking the sky"
			message="Fetching the current conditions and a short forecast."
		/>
	{:else if state.status === 'error'}
		<AsyncState
			variant="error"
			title="Weather unavailable"
			message={state.error}
		/>
	{:else if state.status === 'empty'}
		<AsyncState
			variant="empty"
			title="No forecast data"
			message={state.message ?? 'No forecast is available right now.'}
		/>
	{:else}
		<div class="weather">
			<div class="current">
				<div class="condition-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
						<path d={iconPath(state.data.current.icon)} />
					</svg>
				</div>
				<div class="current-copy">
					<p class="location">{state.data.location}</p>
					<p class="zip">ZIP {state.data.zip}</p>
					<div class="temperature">{state.data.current.temperature}°</div>
					<p class="condition">{state.data.current.condition}</p>
					<p class="summary">{state.data.current.summary}</p>
				</div>
			</div>

			<div class="metrics">
				<div>
					<span>Feels like</span>
					<strong>{state.data.current.feelsLike}°</strong>
				</div>
				<div>
					<span>Humidity</span>
					<strong>{state.data.current.humidity}%</strong>
				</div>
				<div>
					<span>Wind</span>
					<strong>{state.data.current.wind}</strong>
				</div>
				<div>
					<span>Range</span>
					<strong>{state.data.current.low}° / {state.data.current.high}°</strong>
				</div>
				<div>
					<span>Air quality</span>
					<strong>AQI {state.data.aqi}</strong>
				</div>
				<div>
					<span>Sunrise</span>
					<strong>{new Date(state.data.sunrise).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</strong>
				</div>
			</div>

			<div class="forecast">
				{#each state.data.forecast as day}
					<div class="forecast-pill">
						<p>{day.day}</p>
						<strong>{day.high}°</strong>
						<span>{day.condition}</span>
					</div>
				{/each}
			</div>

			{#if state.data.alerts.length > 0}
				<div class="alerts">
					{#each state.data.alerts as alert}
						<div class="alert-pill">{alert}</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</CardShell>

<style>
	.weather {
		display: grid;
		gap: 1.4rem;
	}

	.current {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1rem;
		align-items: center;
	}

	.condition-icon {
		display: grid;
		place-items: center;
		width: 5.25rem;
		height: 5.25rem;
		border-radius: 1.5rem;
		background: color-mix(in srgb, var(--accent-soft) 40%, transparent);
		color: var(--accent);
		border: 1px solid var(--border-soft);
	}

	svg {
		width: 2.5rem;
		height: 2.5rem;
	}

	.current-copy {
		display: grid;
		gap: 0.25rem;
	}

	.location,
	.zip,
	.condition,
	.summary {
		margin: 0;
	}

	.location {
		font-size: 0.88rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--text-muted);
	}

	.zip {
		margin-top: 0.15rem;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.temperature {
		font-size: clamp(2.75rem, 4.2vw, 4rem);
		font-weight: 800;
		line-height: 0.9;
		letter-spacing: -0.08em;
	}

	.condition {
		font-size: 1.02rem;
		color: var(--text-primary);
	}

	.summary {
		color: var(--text-secondary);
		line-height: 1.5;
		max-width: 36ch;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.metrics div,
	.forecast-pill {
		padding: 0.95rem 1rem;
		border-radius: 1.15rem;
		background: color-mix(in srgb, var(--surface-strong) 62%, transparent);
		border: 1px solid var(--border-soft);
	}

	.metrics span,
	.forecast-pill span,
	.forecast-pill p {
		display: block;
		margin: 0;
		font-size: 0.84rem;
		color: var(--text-muted);
	}

	.metrics strong,
	.forecast-pill strong {
		display: block;
		margin-top: 0.3rem;
		font-size: 1rem;
		color: var(--text-primary);
	}

	.forecast {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.forecast-pill p {
		margin-bottom: 0.4rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.alerts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.alert-pill {
		padding: 0.7rem 0.9rem;
		border-radius: 999px;
		background: rgba(255, 178, 138, 0.16);
		border: 1px solid rgba(255, 178, 138, 0.3);
		color: #ffd9c6;
		font-size: 0.84rem;
	}

	@media (max-width: 640px) {
		.metrics,
		.forecast {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
