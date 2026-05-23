<script lang="ts">
	import CardShell from '$components/CardShell.svelte';

	export let microphoneState = 'Idle';
	export let transcript = '';
	export let partialTranscript = '';
	export let prompt = '';
	export let response = '';
	export let asleep = false;
</script>

<CardShell title="Session" eyebrow="Assistant">
	<div class="assistant-panel">
		<div class="state-row">
			<div>
				<span class="label">Microphone</span>
				<strong>{microphoneState}</strong>
			</div>
			<div>
				<span class="label">Privacy</span>
				<strong>{asleep ? 'Sleep mode' : 'Listening available'}</strong>
			</div>
		</div>

		<div class="stack">
			<div class="panel">
				<span class="label">Transcript</span>
				<p>{transcript || 'No transcript yet.'}</p>
			</div>
			<div class="panel">
				<span class="label">Live speech / status</span>
				<p>{partialTranscript || 'Waiting for input…'}</p>
			</div>
			<div class="panel">
				<span class="label">Submitted prompt</span>
				<p>{prompt || 'Nothing submitted yet.'}</p>
			</div>
			<div class="panel response">
				<span class="label">Assistant response</span>
				<p>{response || 'Responses from Ollama will appear here.'}</p>
			</div>
		</div>
	</div>
</CardShell>

<style>
	.assistant-panel {
		display: grid;
		gap: 1rem;
	}

	.state-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.state-row > div,
	.panel {
		padding: 0.95rem 1rem;
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--surface-strong) 66%, transparent);
		border: 1px solid var(--border-soft);
	}

	.stack {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
	}

	.label,
	strong,
	p {
		margin: 0;
		display: block;
	}

	.label {
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	strong {
		margin-top: 0.35rem;
		font-size: 1rem;
		color: var(--text-primary);
	}

	p {
		margin-top: 0.45rem;
		line-height: 1.55;
		color: var(--text-secondary);
		white-space: pre-wrap;
	}

	.response {
		grid-column: 1 / -1;
	}

	@media (max-width: 760px) {
		.state-row,
		.stack {
			grid-template-columns: 1fr;
		}
	}
</style>
