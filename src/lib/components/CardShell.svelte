<script lang="ts">
	export let title = '';
	export let eyebrow = '';
	export let padded = true;
	export let href: string | null = null;
</script>

{#if href}
	<a class:unpadded={!padded} class="card-shell interactive" href={href}>
		{#if eyebrow || title}
			<header class="card-header">
				{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
				{#if title}<h2>{title}</h2>{/if}
			</header>
		{/if}
		<div class="card-content">
			<slot />
		</div>
	</a>
{:else}
	<section class:unpadded={!padded} class="card-shell">
		{#if eyebrow || title}
			<header class="card-header">
				{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
				{#if title}<h2>{title}</h2>{/if}
			</header>
		{/if}
		<div class="card-content">
			<slot />
		</div>
	</section>
{/if}

<style>
	.card-shell {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 100%;
		padding: 1.25rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: var(--surface-base);
	}

	.interactive {
		text-decoration: none;
		color: inherit;
		transition: border-color 150ms ease, background 150ms ease;
	}

	.interactive:hover,
	.interactive:focus-visible {
		border-color: var(--border-strong);
		background: var(--surface-strong);
		outline: none;
	}

	.card-header {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
	}

	.card-content {
		display: contents;
	}

	.unpadded {
		padding: 0;
	}
</style>
