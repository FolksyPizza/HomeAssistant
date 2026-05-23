<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { isValidZip, sanitizeZip } from '$lib/services/preferences';

	export let value = '';
	export let label = 'ZIP code';
	export let helper = 'This ZIP is used for the forecast across the display.';
	export let buttonLabel = 'Save ZIP';

	const dispatch = createEventDispatcher<{ save: { zip: string } }>();

	let draft = value;
	let touched = false;

	$: if (value !== draft) {
		draft = value;
	}

	$: normalized = sanitizeZip(draft);
	$: canSave = isValidZip(normalized);
	$: showValidation = touched && normalized.length > 0 && !canSave;
	$: feedback = showValidation
		? 'ZIP codes should be 5 digits.'
		: canSave
			? 'Ready to save.'
			: 'Enter a 5-digit ZIP code.';

	function handleInput(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		draft = target.value;
	}

	function handleBlur(): void {
		touched = true;
		draft = normalized;
	}

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		touched = true;
		draft = normalized;
		if (!canSave) {
			return;
		}

		dispatch('save', { zip: normalized });
	}
</script>

<form class="zip-form" on:submit={handleSubmit}>
	<label>
		<span>{label}</span>
		<input
			value={draft}
			on:input={handleInput}
			on:blur={handleBlur}
			maxlength="5"
			inputmode="numeric"
			pattern="[0-9]{5}"
			placeholder="10583"
			aria-invalid={showValidation}
		/>
	</label>
	<div class="actions">
		<button type="submit" disabled={!canSave}>{buttonLabel}</button>
		<div class:invalid={showValidation} class="feedback">{feedback}</div>
	</div>
	<p>{helper}</p>
</form>

<style>
	.zip-form {
		display: grid;
		gap: 0.9rem;
	}

	label {
		display: grid;
		gap: 0.55rem;
	}

	span,
	p {
		margin: 0;
	}

	span {
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	input {
		width: 100%;
		padding: 1rem 1.05rem;
		border-radius: 1rem;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--surface-strong) 70%, transparent);
		color: var(--text-primary);
	}

	input[aria-invalid='true'] {
		border-color: rgba(255, 165, 156, 0.58);
	}

	.actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}

	button {
		width: fit-content;
		padding: 0.95rem 1.05rem;
		border-radius: 999px;
		border: 1px solid var(--border-soft);
		background: color-mix(in srgb, var(--accent-soft) 36%, transparent);
		color: var(--text-primary);
		font-weight: 700;
	}

	button:disabled {
		opacity: 0.52;
		cursor: not-allowed;
	}

	.feedback {
		font-size: 0.84rem;
		color: var(--text-muted);
	}

	.feedback.invalid {
		color: #ffc3b7;
	}

	p {
		line-height: 1.55;
		color: var(--text-secondary);
	}

	@media (max-width: 560px) {
		.actions {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
