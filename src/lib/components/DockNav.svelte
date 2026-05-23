<script lang="ts">
	import { page } from '$app/stores';
	import type { NavItem } from '$lib/types';

	export let items: NavItem[] = [];
</script>

<nav class="dock" aria-label="Primary navigation">
	{#each items as item}
		<a
			class:active={$page.url.pathname === item.href}
			class="dock-item"
			href={item.href}
			aria-current={$page.url.pathname === item.href ? 'page' : undefined}
		>
			<span class="icon">{item.icon}</span>
			<span class="label">{item.label}</span>
		</a>
	{/each}
</nav>

<style>
	.dock {
		display: flex;
		align-items: stretch;
		height: 3.5rem;
	}

	.dock-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2rem;
		text-decoration: none;
		color: var(--nav-item-text);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		border-top: 2px solid transparent;
		transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
		background: transparent;
	}

	.dock-item:hover {
		color: var(--text-primary);
		background: var(--nav-item-hover);
	}

	.dock-item.active {
		color: var(--accent);
		border-top-color: var(--accent);
	}

	.icon {
		font-size: 1.1rem;
		line-height: 1;
	}

	.label {
		line-height: 1;
	}
</style>
