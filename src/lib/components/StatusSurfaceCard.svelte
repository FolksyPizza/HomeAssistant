<script lang="ts">
	import CardShell from '$components/CardShell.svelte';
	import ConnectionBadge from '$components/ConnectionBadge.svelte';
	import type { StatusCardData } from '$lib/types';

	export let card: StatusCardData;
	export let href: string | null = null;
</script>

<CardShell title={card.title} eyebrow={card.category} {href}>
	<div class="status-surface">
		<ConnectionBadge label={card.state} state={card.state} detail={card.summary} />
		<p class="detail">{card.detail}</p>
		<div class="metrics">
			{#each card.metrics as metric}
				<div class="metric">
					<span>{metric.label}</span>
					<strong>{metric.value}</strong>
					{#if metric.trend}<small>{metric.trend}</small>{/if}
				</div>
			{/each}
		</div>
	</div>
</CardShell>

<style>
	.status-surface {
		display: grid;
		gap: 1rem;
	}

	.detail {
		margin: 0;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.7rem;
	}

	.metric {
		padding: 0.95rem 1rem;
		border-radius: 1.15rem;
		background: color-mix(in srgb, var(--surface-strong) 66%, transparent);
		border: 1px solid var(--border-soft);
	}

	.metric span,
	.metric strong,
	.metric small {
		display: block;
	}

	.metric span {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.metric strong {
		margin-top: 0.35rem;
		font-size: 0.98rem;
		color: var(--text-primary);
		word-break: break-word;
	}

	.metric small {
		margin-top: 0.3rem;
		font-size: 0.76rem;
		color: var(--text-muted);
	}
</style>
