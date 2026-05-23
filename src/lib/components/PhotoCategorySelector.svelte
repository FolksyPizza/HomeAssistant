<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { AmbientPhotoCategory } from '$lib/types';

	export let categories: AmbientPhotoCategory[] = [];
	export let selected: AmbientPhotoCategory[] = [];
	export let labels: Record<AmbientPhotoCategory, string>;
	export let defaults: AmbientPhotoCategory[] = [];

	const dispatch = createEventDispatcher<{ change: { selected: AmbientPhotoCategory[] } }>();

	function emit(next: AmbientPhotoCategory[]): void {
		dispatch('change', { selected: next });
	}

	function toggle(category: AmbientPhotoCategory): void {
		const next = selected.includes(category)
			? selected.filter((entry) => entry !== category)
			: [...selected, category];

		emit(next);
	}

	function selectAll(): void {
		emit([...categories]);
	}

	function clearAll(): void {
		emit([]);
	}

	function restoreDefaults(): void {
		emit([...defaults]);
	}
</script>

<div class="selector">
	<div class="toolbar">
		<button class="utility" type="button" on:click={selectAll}>Select all</button>
		<button class="utility" type="button" on:click={clearAll}>Clear all</button>
		<button class="utility" type="button" on:click={restoreDefaults}>Restore defaults</button>
	</div>

	<div class="category-grid">
		{#each categories as category}
			<button
				type="button"
				class:selected={selected.includes(category)}
				class="category-pill"
				on:click={() => toggle(category)}
			>
				<span>{labels[category] ?? category}</span>
				<small>{selected.includes(category) ? 'Included' : 'Hidden'}</small>
			</button>
		{/each}
	</div>
</div>

<style>
	.selector,
	.category-grid {
		display: grid;
		gap: 0.75rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.utility {
		padding: 0.72rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-strong) 68%, transparent);
		color: var(--text-secondary);
	}

	.category-grid {
		grid-template-columns: repeat(auto-fit, minmax(10.25rem, 1fr));
	}

	.category-pill {
		display: grid;
		gap: 0.28rem;
		padding: 0.95rem 1rem;
		text-align: left;
		border-radius: 1.15rem;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-strong) 64%, transparent);
		color: var(--text-secondary);
		transition:
			transform 160ms ease,
			border-color 160ms ease,
			background 160ms ease;
	}

	.category-pill span {
		font-weight: 700;
		color: inherit;
	}

	.category-pill small {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.category-pill.selected {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--accent-soft) 56%, transparent),
				color-mix(in srgb, var(--surface-strong) 74%, transparent)
			);
		border-color: var(--border-strong);
		color: var(--text-primary);
	}

	.category-pill.selected small {
		color: var(--text-secondary);
	}

	.category-pill:hover,
	.category-pill:focus-visible,
	.utility:hover,
	.utility:focus-visible {
		transform: translateY(-1px);
		border-color: var(--border-strong);
	}
</style>
