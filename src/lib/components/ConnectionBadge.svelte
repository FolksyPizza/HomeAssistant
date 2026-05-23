<script lang="ts">
	import type { ConnectionState } from '$lib/types';

	export let label = '';
	export let state: ConnectionState = 'degraded';
	export let detail = '';
</script>

<div class={`connection-badge ${state}`}>
	<span class="dot" aria-hidden="true"></span>
	<div class="copy">
		<strong>{label}</strong>
		{#if detail}<small>{detail}</small>{/if}
	</div>
</div>

<style>
	.connection-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.75rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-strong) 72%, transparent);
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background: var(--warn);
		box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--warn) 18%, transparent);
	}

	.online .dot {
		background: var(--success);
		box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--success) 18%, transparent);
	}

	.offline .dot {
		background: var(--danger);
		box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--danger) 18%, transparent);
	}

	.copy {
		display: grid;
		gap: 0.15rem;
	}

	strong,
	small {
		display: block;
	}

	strong {
		font-size: 0.86rem;
		letter-spacing: -0.01em;
	}

	small {
		font-size: 0.73rem;
		color: var(--text-muted);
		max-width: 28ch;
	}
</style>
