<script lang="ts">
	export let label = '';
	export let help = '';
	export let compact = false;
</script>

<label class:compact class="settings-field">
	<div class="copy">
		<strong>{label}</strong>
		{#if help}<p>{help}</p>{/if}
	</div>
	<div class="control">
		<slot />
	</div>
</label>

<style>
	.settings-field {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: center;
		padding: 1rem 0;
		border-top: 1px solid color-mix(in srgb, var(--border-soft) 80%, transparent);
	}

	.settings-field:first-child {
		padding-top: 0;
		border-top: 0;
	}

	.copy {
		display: grid;
		gap: 0.25rem;
	}

	strong,
	p {
		margin: 0;
	}

	strong {
		font-size: 0.96rem;
		letter-spacing: -0.01em;
	}

	p {
		max-width: 48ch;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.control {
		min-width: min(100%, 16rem);
	}

	.compact {
		grid-template-columns: 1fr;
	}

	.compact .control {
		min-width: 0;
	}

	@media (max-width: 760px) {
		.settings-field {
			grid-template-columns: 1fr;
		}

		.control {
			min-width: 0;
		}
	}
</style>
