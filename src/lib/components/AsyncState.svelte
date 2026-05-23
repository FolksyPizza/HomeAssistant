<script lang="ts">
	export let variant: 'loading' | 'empty' | 'error' = 'loading';
	export let title = '';
	export let message = '';
</script>

<div class={`state state-${variant}`}>
	<div class="state-mark" aria-hidden="true">
		{#if variant === 'loading'}
			<span class="pulse"></span>
		{:else if variant === 'error'}
			<span>!</span>
		{:else}
			<span>•</span>
		{/if}
	</div>
	<div class="state-copy">
		<h3>{title}</h3>
		<p>{message}</p>
	</div>
</div>

<style>
	.state {
		display: flex;
		align-items: center;
		gap: 1rem;
		min-height: 10rem;
		padding: 1.25rem 0.25rem;
		color: var(--text-secondary);
	}

	.state-mark {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent-soft) 38%, transparent);
		border: 1px solid var(--border-soft);
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: 800;
		flex: 0 0 auto;
	}

	.state-copy {
		display: grid;
		gap: 0.35rem;
	}

	h3,
	p {
		margin: 0;
	}

	h3 {
		font-size: 1rem;
		color: var(--text-primary);
	}

	p {
		max-width: 28ch;
		line-height: 1.5;
	}

	.pulse {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1.2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(0.9);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.15);
			opacity: 1;
		}
	}
</style>
