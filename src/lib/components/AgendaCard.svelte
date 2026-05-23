<script lang="ts">
	import AsyncState from '$components/AsyncState.svelte';
	import CardShell from '$components/CardShell.svelte';
	import type { CalendarResponse, ResourceState } from '$lib/types';
	import { formatEventTime, formatRelativeTime, formatShortDate } from '$lib/utils/format';

	export let state: ResourceState<CalendarResponse>;
</script>

<CardShell title="Agenda" eyebrow="Upcoming">
	{#if state.status === 'loading'}
		<AsyncState
			variant="loading"
			title="Loading agenda"
			message="Preparing today's events and upcoming reminders."
		/>
	{:else if state.status === 'error'}
		<AsyncState variant="error" title="Calendar unavailable" message={state.error} />
	{:else if state.status === 'empty'}
		<AsyncState
			variant="empty"
			title="Free schedule"
			message={state.message ?? 'No events were scheduled for today.'}
		/>
	{:else}
		<div class="agenda">
			<div class="agenda-header">
				<div>
					<p class="label">Focus day</p>
					<h3>{formatShortDate(new Date(state.data.focusDay))}</h3>
				</div>
				<div class="count">{state.data.events.length} items</div>
			</div>

			<div class="agenda-list">
				{#each state.data.events as event}
					<article class="event" style={`--event-accent: ${event.color};`}>
						<div class="event-accent"></div>
						<div class="event-main">
							<div class="event-copy">
								<h4>{event.title}</h4>
								<p>{event.location}</p>
							</div>
							<div class="event-meta">
								<strong>{formatEventTime(event.startsAt)} - {formatEventTime(event.endsAt)}</strong>
								<span>{formatRelativeTime(event.startsAt)}</span>
							</div>
						</div>
						{#if event.note}
							<p class="event-note">{event.note}</p>
						{/if}
					</article>
				{/each}
			</div>
		</div>
	{/if}
</CardShell>

<style>
	.agenda {
		display: grid;
		gap: 1.2rem;
	}

	.agenda-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.3rem 0.1rem 0;
	}

	.label,
	h3,
	h4,
	p {
		margin: 0;
	}

	.label {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	h3 {
		margin-top: 0.3rem;
		font-size: 1.4rem;
		letter-spacing: -0.04em;
	}

	.count {
		padding: 0.65rem 0.9rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface-strong) 72%, transparent);
		border: 1px solid var(--border-soft);
		color: var(--text-secondary);
		font-size: 0.88rem;
	}

	.agenda-list {
		display: grid;
		gap: 0.8rem;
	}

	.event {
		position: relative;
		display: grid;
		gap: 0.65rem;
		padding: 1rem 1rem 1rem 1.15rem;
		border-radius: 1.35rem;
		background: color-mix(in srgb, var(--surface-strong) 62%, transparent);
		border: 1px solid var(--border-soft);
		transition:
			transform 180ms ease,
			border-color 180ms ease;
	}

	.event:hover {
		transform: translateY(-2px);
		border-color: var(--border-strong);
	}

	.event-accent {
		position: absolute;
		inset: 0 auto 0 0;
		width: 0.26rem;
		border-radius: 1rem;
		background: var(--event-accent);
	}

	.event-main {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.event-copy {
		display: grid;
		gap: 0.25rem;
	}

	h4 {
		font-size: 1.04rem;
		letter-spacing: -0.02em;
	}

	.event-copy p,
	.event-note,
	.event-meta span {
		color: var(--text-secondary);
	}

	.event-note {
		line-height: 1.5;
	}

	.event-meta {
		display: grid;
		gap: 0.35rem;
		text-align: right;
		white-space: nowrap;
	}

	.event-meta strong {
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	@media (max-width: 640px) {
		.event-main {
			flex-direction: column;
		}

		.event-meta {
			text-align: left;
		}
	}
</style>
