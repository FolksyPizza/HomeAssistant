<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import AssistantTranscriptPanel from '$components/AssistantTranscriptPanel.svelte';
	import AsyncState from '$components/AsyncState.svelte';
	import ConnectionBadge from '$components/ConnectionBadge.svelte';
	import DockNav from '$components/DockNav.svelte';
	import {
		fetchAssistantHealth,
		submitAssistantPrompt,
		submitAssistantVoiceTurn,
		transcribeAssistantAudio
	} from '$lib/services/assistant';
	import {
		browserMicAvailable,
		browserSpeechSynthesisAvailable,
		browserSpeechRecognitionAvailable,
		recordBrowserClip,
		speakInBrowser,
		stopBrowserSpeech,
		type BrowserRecordingResult
	} from '$lib/services/browser-voice';
	import { getSavedPreferences, updatePreferences } from '$lib/services/preferences';
	import type { AssistantHealth, NavItem, ResourceState } from '$lib/types';

	const navItems: NavItem[] = [
		{ label: 'Home', href: '/', description: 'Clock', icon: '⌂' },
		{ label: 'Weather', href: '/weather', description: 'Forecast', icon: '☁' },
		{ label: 'Calendar', href: '/calendar', description: 'Agenda', icon: '☷' },
		{ label: 'Assistant', href: '/assistant', description: 'Talk', icon: '◉' },
		{ label: 'Settings', href: '/settings', description: 'Display', icon: '⚙' }
	];

	let preferences = getSavedPreferences();
	let healthState: ResourceState<AssistantHealth> = { status: 'loading' };
	let assistantState = preferences.voice.sleepMode ? 'Sleeping' : 'Ready';
	let transcript = '';
	let partialTranscript = '';
	let submittedPrompt = '';
	let assistantResponse = '';
	let prompt = '';
	let selectedModel = preferences.assistant.defaultModel;
	let browserRecorderStop: (() => Promise<BrowserRecordingResult>) | null = null;
	let browserRecording = false;
	let voiceBusy = false;
	let piWakeWordArmed = false;
	let piVoiceController: AbortController | null = null;

	function syncPreferences(): void {
		preferences = getSavedPreferences();
		selectedModel = preferences.assistant.defaultModel;
	}

	async function refreshHealth(): Promise<void> {
		syncPreferences();
		healthState = { status: 'loading' };
		try {
			const data = await fetchAssistantHealth(fetch, preferences.backend.ollamaBaseUrl);
			healthState = { status: 'success', data };
		} catch (error) {
			healthState = { status: 'error', error: error instanceof Error ? error.message : 'Assistant unavailable.' };
		}
	}

	function toggleSleepMode(): void {
		preferences = updatePreferences((c) => ({ ...c, voice: { ...c.voice, sleepMode: !c.voice.sleepMode } }));
		if (preferences.voice.sleepMode) { stopWakeWordLoop(); stopBrowserSpeech(); }
		assistantState = preferences.voice.sleepMode ? 'Sleeping' : 'Ready';
	}

	async function speakAssistantResponseInBrowser(response: string): Promise<void> {
		if (!preferences.voice.speakerEnabled || preferences.assistant.interactionMode !== 'browser-mic' || !browserSpeechSynthesisAvailable()) return;
		try { await speakInBrowser(response); } catch (error) {
			assistantResponse = error instanceof Error ? `${response}\n\n${error.message}` : response;
		}
	}

	async function submitPromptValue(nextPrompt: string, transcriptValue?: string): Promise<void> {
		stopBrowserSpeech();
		submittedPrompt = nextPrompt;
		transcript = transcriptValue ?? nextPrompt;
		partialTranscript = '';
		prompt = '';
		assistantState = 'Sending';
		try {
			const result = await submitAssistantPrompt(fetch, {
				prompt: nextPrompt,
				transcript: transcriptValue,
				model: selectedModel,
				baseUrl: preferences.backend.ollamaBaseUrl
			});
			assistantResponse = result.response;
			selectedModel = result.model;
			assistantState = preferences.voice.sleepMode ? 'Sleeping' : 'Ready';
			void speakAssistantResponseInBrowser(result.response);
		} catch (error) {
			assistantResponse = error instanceof Error ? error.message : 'The assistant could not respond.';
			assistantState = 'Error';
		}
	}

	async function sendPrompt(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const nextPrompt = prompt.trim();
		if (nextPrompt) await submitPromptValue(nextPrompt);
	}

	function voiceUnavailableReason(): string | null {
		if (!preferences.voice.microphoneEnabled) return 'Microphone disabled';
		if (preferences.voice.sleepMode && !preferences.voice.allowPushToTalkWhileSleeping) return 'Assistant sleeping';
		return null;
	}

	async function startBrowserRecording(): Promise<void> {
		const reason = voiceUnavailableReason();
		if (reason) { assistantState = reason; return; }
		assistantResponse = ''; transcript = ''; partialTranscript = '';
		assistantState = 'Listening'; browserRecording = true;
		try {
			const recording = await recordBrowserClip((v) => { partialTranscript = preferences.assistant.showPartialTranscript ? v : ''; });
			browserRecorderStop = recording.stop;
		} catch (error) {
			browserRecording = false; browserRecorderStop = null; assistantState = 'Error';
			assistantResponse = error instanceof Error ? error.message : 'Browser microphone access failed.';
		}
	}

	async function stopBrowserRecording(): Promise<void> {
		if (!browserRecorderStop) { browserRecording = false; return; }
		const stop = browserRecorderStop;
		browserRecorderStop = null; browserRecording = false; assistantState = 'Transcribing';
		try {
			const clip = await stop();
			const result = await transcribeAssistantAudio(fetch, { audio: clip.audio, filename: 'browser-mic.webm', browserTranscriptHint: clip.browserTranscriptHint });
			transcript = result.transcript;
			partialTranscript = preferences.assistant.showPartialTranscript ? result.partialTranscript || clip.partialTranscript || '' : '';
			if (preferences.assistant.autoSendTranscript && result.transcript.trim()) {
				await submitPromptValue(result.transcript, result.transcript);
			} else {
				prompt = result.transcript;
				assistantState = preferences.voice.sleepMode ? 'Sleeping' : 'Ready';
			}
		} catch (error) {
			assistantState = 'Error';
			assistantResponse = error instanceof Error ? error.message : 'Recording could not be processed.';
		}
	}

	async function toggleBrowserVoice(): Promise<void> {
		if (browserRecording) { await stopBrowserRecording(); return; }
		await startBrowserRecording();
	}

	async function runPiVoiceTurn(entryMode: 'push-to-talk' | 'wake-word', signal?: AbortSignal): Promise<void> {
		const reason = entryMode === 'wake-word'
			? (!preferences.voice.microphoneEnabled ? 'Microphone disabled' : preferences.voice.sleepMode ? 'Sleeping' : null)
			: voiceUnavailableReason();
		if (reason) { assistantState = reason; return; }
		voiceBusy = true; stopBrowserSpeech(); assistantResponse = ''; transcript = '';
		partialTranscript = entryMode === 'wake-word' ? `Waiting for "${preferences.voice.wakeWordPhrase}"…` : 'Listening on Pi…';
		assistantState = entryMode === 'wake-word' ? 'Armed' : 'Listening';
		try {
			const result = await submitAssistantVoiceTurn(fetch, {
				entryMode, wakeWordPhrase: preferences.voice.wakeWordPhrase,
				silenceTimeoutSeconds: preferences.voice.silenceTimeoutSeconds,
				maxListenSeconds: entryMode === 'wake-word' ? 25 : 30,
				model: selectedModel, baseUrl: preferences.backend.ollamaBaseUrl,
				speakResponse: preferences.voice.speakerEnabled, signal
			});
			transcript = result.capture.transcript; partialTranscript = '';
			submittedPrompt = result.turn.submittedPrompt; assistantResponse = result.turn.response;
			selectedModel = result.turn.model;
			assistantState = preferences.voice.sleepMode ? 'Sleeping' : 'Ready';
		} catch (error) {
			if (signal?.aborted) return;
			assistantState = 'Error';
			assistantResponse = error instanceof Error ? error.message : 'Pi-local voice failed.';
		} finally { voiceBusy = false; }
	}

	async function runPiPushToTalk(): Promise<void> { if (!voiceBusy) await runPiVoiceTurn('push-to-talk'); }

	async function startWakeWordLoop(): Promise<void> {
		if (piWakeWordArmed || voiceBusy) return;
		piWakeWordArmed = true;
		while (piWakeWordArmed) {
			const controller = new AbortController();
			piVoiceController = controller;
			await runPiVoiceTurn('wake-word', controller.signal);
			piVoiceController = null;
			if (!piWakeWordArmed || assistantState === 'Error') { piWakeWordArmed = false; break; }
		}
	}

	function stopWakeWordLoop(): void {
		piWakeWordArmed = false; piVoiceController?.abort(); piVoiceController = null; voiceBusy = false;
		if (assistantState !== 'Error') assistantState = preferences.voice.sleepMode ? 'Sleeping' : 'Ready';
		partialTranscript = '';
	}

	function toggleWakeWordLoop(): void {
		if (piWakeWordArmed) { stopWakeWordLoop(); return; }
		void startWakeWordLoop();
	}

	function handleModelChange(event: Event): void {
		const val = (event.currentTarget as HTMLSelectElement).value;
		selectedModel = val;
		preferences = updatePreferences((c) => ({ ...c, assistant: { ...c.assistant, defaultModel: val } }));
	}

	onMount(() => { void refreshHealth(); });
	onDestroy(() => { stopWakeWordLoop(); stopBrowserSpeech(); });

	$: browserMicSupported = browserMicAvailable();
	$: browserSpeechSupported = browserSpeechSynthesisAvailable();
	$: browserSpeechHints = browserSpeechRecognitionAvailable();
	$: browserVoiceDisabled = voiceBusy || preferences.assistant.interactionMode !== 'browser-mic' || !browserMicSupported || voiceUnavailableReason() !== null;
	$: piVoiceDisabled = voiceBusy || preferences.assistant.interactionMode !== 'pi-local' || (preferences.voice.entryMode === 'wake-word' ? !preferences.voice.microphoneEnabled || preferences.voice.sleepMode : voiceUnavailableReason() !== null);
</script>

<svelte:head><title>Assistant | Smart Display</title></svelte:head>

<div class="overlay-page">
	<div class="overlay-panel">
		<header class="overlay-header">
			<div>
				<p class="overlay-eyebrow">Assistant</p>
				<h1 class="overlay-title">Talk</h1>
			</div>
			<button class:sleep-active={preferences.voice.sleepMode} class="sleep-btn" type="button" on:click={toggleSleepMode}>
				{preferences.voice.sleepMode ? '☽ Sleeping' : '☼ Awake'}
			</button>
		</header>

		<div class="overlay-body">
			<div class="assistant-layout">
				<!-- Left: transcript + input -->
				<div class="assistant-main">
					<AssistantTranscriptPanel
						microphoneState={assistantState}
						{transcript}
						{partialTranscript}
						prompt={submittedPrompt}
						response={assistantResponse}
						asleep={preferences.voice.sleepMode}
					/>

					<!-- Voice controls -->
					<div class="voice-card">
						<p class="section-label">Voice</p>
						<div class="mode-row">
							<div class="mode-info">
								<span>Mode</span>
								<strong>{preferences.assistant.interactionMode === 'pi-local' ? 'Pi microphone' : 'Browser mic'}</strong>
							</div>
							<div class="mode-info">
								<span>Entry</span>
								<strong>{preferences.voice.entryMode === 'wake-word' ? preferences.voice.wakeWordPhrase : 'Push to talk'}</strong>
							</div>
						</div>

						{#if preferences.assistant.interactionMode === 'browser-mic'}
							<button class="voice-btn" class:recording={browserRecording} type="button" disabled={browserVoiceDisabled && !browserRecording} on:click={toggleBrowserVoice}>
								{browserRecording ? '⏹ Stop recording' : '🎙 Record'}
							</button>
						{:else if preferences.voice.entryMode === 'wake-word'}
							<button class="voice-btn" class:armed={piWakeWordArmed} type="button" disabled={piVoiceDisabled && !piWakeWordArmed} on:click={toggleWakeWordLoop}>
								{piWakeWordArmed ? '◉ Disarm wake word' : `◎ Arm "${preferences.voice.wakeWordPhrase}"`}
							</button>
						{:else}
							<button class="voice-btn" type="button" disabled={piVoiceDisabled} on:click={runPiPushToTalk}>
								🎤 Listen on Pi
							</button>
						{/if}
					</div>

					<!-- Text input -->
					<form class="prompt-form" on:submit={sendPrompt}>
						<textarea bind:value={prompt} rows="3" placeholder="Ask anything… or add a calendar event, check weather, etc."></textarea>
						<button class="btn-primary" type="submit" disabled={voiceBusy || !prompt.trim()}>Send</button>
					</form>
				</div>

				<!-- Right: status -->
				<div class="assistant-side">
					<div class="status-card">
						<p class="section-label">Connection</p>
						{#if healthState.status === 'loading'}
							<AsyncState variant="loading" title="Checking" message="Connecting to assistant…" />
						{:else if healthState.status === 'error'}
							<AsyncState variant="error" title="Offline" message={healthState.error} />
						{:else if healthState.status === 'success'}
							<div class="status-inner">
								<ConnectionBadge label={healthState.data.reachable ? 'Connected' : 'Offline'} state={healthState.data.reachable ? 'online' : 'offline'} detail={healthState.data.baseUrl} />
								<label class="model-field">
									<span>Model</span>
									<select bind:value={selectedModel} on:change={handleModelChange}>
										{#each healthState.data.models as model}
											<option value={model.name}>{model.name}</option>
										{/each}
										{#if !healthState.data.models.find((m) => m.name === selectedModel)}
											<option value={selectedModel}>{selectedModel}</option>
										{/if}
									</select>
								</label>
								<div class="conn-list">
									{#each healthState.data.connections as conn}
										<ConnectionBadge label={conn.label} state={conn.state} detail={`${conn.target}${conn.latencyMs ? ` · ${conn.latencyMs}ms` : ''}`} />
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<footer class="overlay-footer">
			<DockNav items={navItems} />
		</footer>
	</div>
</div>

<style>
	.assistant-layout {
		display: grid;
		grid-template-columns: 1fr minmax(16rem, 22rem);
		gap: 1rem;
		align-items: start;
	}

	.assistant-main, .assistant-side {
		display: grid;
		gap: 0.75rem;
	}

	.voice-card, .status-card {
		padding: 1rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255,255,255,0.03);
		display: grid;
		gap: 0.75rem;
	}

	.section-label {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.13em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mode-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.mode-info {
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255,255,255,0.03);
	}

	.mode-info span {
		display: block;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mode-info strong {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.84rem;
	}

	.voice-btn {
		padding: 0.7rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-soft);
		background: rgba(138,180,255,0.08);
		color: var(--text-primary);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 150ms ease;
	}

	.voice-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.voice-btn.recording { background: rgba(255,100,80,0.18); border-color: rgba(255,100,80,0.4); color: #ff8070; }
	.voice-btn.armed { background: rgba(111,230,163,0.14); border-color: rgba(111,230,163,0.35); color: #6fe6a3; }

	.prompt-form {
		display: grid;
		gap: 0.6rem;
	}

	textarea, select {
		width: 100%;
		padding: 0.75rem 0.9rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255,255,255,0.05);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.9rem;
		resize: vertical;
	}

	.model-field {
		display: grid;
		gap: 0.3rem;
	}

	.model-field span {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.conn-list {
		display: grid;
		gap: 0.5rem;
	}

	.status-inner {
		display: grid;
		gap: 0.75rem;
	}

	.sleep-btn {
		padding: 0.4rem 0.85rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-soft);
		background: rgba(255,255,255,0.05);
		color: var(--text-secondary);
		font-size: 0.84rem;
		cursor: pointer;
	}

	.sleep-btn.sleep-active {
		background: rgba(138,180,255,0.12);
		border-color: rgba(138,180,255,0.3);
		color: var(--accent);
	}

	@media (max-width: 900px) {
		.assistant-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
