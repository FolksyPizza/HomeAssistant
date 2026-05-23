<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ConnectionBadge from '$components/ConnectionBadge.svelte';
	import DockNav from '$components/DockNav.svelte';
	import PhotoCategorySelector from '$components/PhotoCategorySelector.svelte';
	import SettingsField from '$components/SettingsField.svelte';
	import ThemeToggle from '$components/ThemeToggle.svelte';
	import ZipCodeField from '$components/ZipCodeField.svelte';
	import {
		ambientPhotoCategories,
		ambientPhotoCategoryLabels,
		defaultAmbientPhotoCategories
	} from '$lib/data/ambient-photos';
	import { fetchRuntimeConfig } from '$lib/services/api';
	import { fetchAssistantHealth } from '$lib/services/assistant';
	import {
		getSavedPreferences,
		savePreferences,
		saveZip,
		updatePreferences
	} from '$lib/services/preferences';
	import { applyTheme } from '$lib/services/theme';
	import type { AppRuntimeConfig, AssistantHealth, NavItem } from '$lib/types';

	interface SetupConfigResponse {
		googleCalendar: {
			clientId: string;
			clientSecretConfigured: boolean;
			redirectUri: string;
		};
	}

	const navItems: NavItem[] = [
		{ label: 'Home', href: '/', description: 'Clock', icon: '⌂' },
		{ label: 'Weather', href: '/weather', description: 'Forecast', icon: '☁' },
		{ label: 'Calendar', href: '/calendar', description: 'Agenda', icon: '☷' },
		{ label: 'Assistant', href: '/assistant', description: 'Talk', icon: '◉' },
		{ label: 'Settings', href: '/settings', description: 'Display', icon: '⚙' }
	];

	let preferences = getSavedPreferences();
	let runtime: AppRuntimeConfig | null = null;
	let assistantHealth: AssistantHealth | null = null;
	let zipMessage = '';
	let homeAssistantUrlDraft = preferences.homeAssistant.baseUrl;
	let homeAssistantTokenDraft = preferences.homeAssistant.tokenHint;
	let ollamaUrlDraft = preferences.backend.ollamaBaseUrl;
	let modelDraft = preferences.assistant.defaultModel;
	let nameDraft = preferences.user.name;
	let googleCalendarEmail = '';
	let googleCalendarConnected = preferences.calendar.googleConnected;
	let googleDisconnecting = false;
	let googleClientId = '';
	let googleClientSecret = '';
	let googleClientSecretConfigured = false;
	let googleRedirectUri = '';
	let googleConfigSaving = false;
	let googleConfigMessage = '';
	let googleConfigError = '';

	function persist(): void {
		preferences = savePreferences(preferences);
		applyTheme(preferences.appearance.theme);
	}

	function handleZipSave(event: CustomEvent<{ zip: string }>): void {
		const savedZip = saveZip(event.detail.zip);
		preferences = updatePreferences((c) => ({ ...c, weather: { ...c.weather, zip: savedZip } }));
		zipMessage = `Updated for ZIP ${savedZip}.`;
	}

	function saveName(): void {
		preferences = updatePreferences((c) => ({ ...c, user: { ...c.user, name: nameDraft.trim() } }));
	}

	function saveHomeAssistantConfig(): void {
		preferences = updatePreferences((c) => ({
			...c,
			homeAssistant: {
				...c.homeAssistant,
				baseUrl: homeAssistantUrlDraft.trim() || c.homeAssistant.baseUrl,
				tokenHint: homeAssistantTokenDraft.trim(),
				tokenConfigured: Boolean(homeAssistantTokenDraft.trim()) || c.homeAssistant.tokenConfigured
			}
		}));
	}

	function saveOllamaUrl(): void {
		preferences = updatePreferences((c) => ({ ...c, backend: { ...c.backend, ollamaBaseUrl: ollamaUrlDraft.trim() || c.backend.ollamaBaseUrl } }));
		void refreshRuntime();
	}

	function saveModel(): void {
		preferences = updatePreferences((c) => ({ ...c, assistant: { ...c.assistant, defaultModel: modelDraft.trim() || c.assistant.defaultModel } }));
	}

	function saveVoiceEntryMode(event: Event): void {
		const val = (event.currentTarget as HTMLSelectElement).value;
		const entryMode: 'push-to-talk' | 'wake-word' = val === 'wake-word' ? 'wake-word' : 'push-to-talk';
		preferences = updatePreferences((c) => ({ ...c, voice: { ...c.voice, entryMode, wakeWordEnabled: entryMode === 'wake-word' } }));
	}

	function getDefaultGoogleRedirectUri(): string {
		return typeof window === 'undefined'
			? ''
			: `${window.location.origin}/api/calendar/oauth/callback`;
	}

	function mapCalendarError(code: string | null): string {
		switch (code) {
			case 'not_configured':
				return 'Enter and save your Google OAuth client ID and client secret first.';
			case 'access_denied':
				return 'Google Calendar access was denied.';
			case 'token_exchange_failed':
				return 'Google rejected the OAuth token exchange. Check the client secret and redirect URI.';
			case 'no_code':
				return 'Google did not return an authorization code.';
			case 'server_error':
				return 'The server could not finish the Google Calendar connection.';
			default:
				return code ? `Google Calendar error: ${code}` : '';
		}
	}

	async function loadSetupConfig(): Promise<void> {
		try {
			const response = await fetch('/api/setup/config');
			if (!response.ok) {
				throw new Error('Could not load saved Google Calendar settings.');
			}

			const config = (await response.json()) as SetupConfigResponse;
			googleClientId = config.googleCalendar.clientId;
			googleClientSecretConfigured = config.googleCalendar.clientSecretConfigured;
			googleRedirectUri = config.googleCalendar.redirectUri || getDefaultGoogleRedirectUri();
		} catch {
			googleRedirectUri = googleRedirectUri || getDefaultGoogleRedirectUri();
		}
	}

	async function saveGoogleCalendarConfig(showSavedMessage = true): Promise<boolean> {
		googleConfigSaving = true;
		googleConfigError = '';
		if (showSavedMessage) {
			googleConfigMessage = '';
		}

		try {
			const response = await fetch('/api/setup/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					googleCalendar: {
						clientId: googleClientId.trim(),
						clientSecret: googleClientSecret.trim(),
						redirectUri: googleRedirectUri.trim() || getDefaultGoogleRedirectUri()
					}
				})
			});

			if (!response.ok) {
				const error = (await response.json().catch(() => ({}))) as { message?: string };
				throw new Error(error.message || 'Could not save Google Calendar settings.');
			}

			const saved = (await response.json()) as SetupConfigResponse;
			googleClientId = saved.googleCalendar.clientId;
			googleClientSecret = '';
			googleClientSecretConfigured = saved.googleCalendar.clientSecretConfigured;
			googleRedirectUri = saved.googleCalendar.redirectUri || getDefaultGoogleRedirectUri();
			if (showSavedMessage) {
				googleConfigMessage = 'Google Calendar settings saved on this device.';
			}
			await refreshRuntime();
			return true;
		} catch (error) {
			googleConfigError =
				error instanceof Error ? error.message : 'Could not save Google Calendar settings.';
			return false;
		} finally {
			googleConfigSaving = false;
		}
	}

	async function connectGoogleCalendar(): Promise<void> {
		googleConfigError = '';
		googleConfigMessage = '';

		if (!googleClientId.trim()) {
			googleConfigError = 'Enter your Google OAuth client ID first.';
			return;
		}

		if (!googleClientSecret.trim() && !googleClientSecretConfigured) {
			googleConfigError = 'Enter your Google OAuth client secret first.';
			return;
		}

		const saved = await saveGoogleCalendarConfig(false);
		if (!saved) return;

		window.location.href = '/api/calendar/oauth/start?from=/settings';
	}

	async function disconnectGoogleCalendar(): Promise<void> {
		if (!confirm('Disconnect Google Calendar?')) return;
		googleDisconnecting = true;
		try {
			await fetch('/api/calendar/google', { method: 'DELETE' });
			googleCalendarConnected = false;
			googleCalendarEmail = '';
			preferences = updatePreferences((c) => ({
				...c,
				calendar: { ...c.calendar, provider: 'mock', googleConnected: false }
			}));
		} catch {
			googleConfigError = 'Could not disconnect Google Calendar.';
		} finally {
			googleDisconnecting = false;
		}
	}

	async function checkGoogleCalendarStatus(): Promise<void> {
		try {
			const response = await fetch('/api/calendar/google');
			if (!response.ok) {
				googleCalendarConnected = false;
				googleCalendarEmail = '';
				preferences = updatePreferences((c) => ({
					...c,
					calendar: { ...c.calendar, googleConnected: false }
				}));
				return;
			}

			const data = (await response.json()) as { connected: boolean; email?: string };
			googleCalendarConnected = Boolean(data.connected);
			googleCalendarEmail = data.email || '';
			preferences = updatePreferences((c) => ({
				...c,
				calendar: {
					...c.calendar,
					provider: data.connected ? 'google' : c.calendar.provider,
					googleConnected: Boolean(data.connected)
				}
			}));
		} catch {
			googleCalendarConnected = false;
			googleCalendarEmail = '';
		}
	}

	async function refreshRuntime(): Promise<void> {
		preferences = getSavedPreferences();
		nameDraft = preferences.user.name;
		homeAssistantUrlDraft = preferences.homeAssistant.baseUrl;
		homeAssistantTokenDraft = preferences.homeAssistant.tokenHint;
		ollamaUrlDraft = preferences.backend.ollamaBaseUrl;
		modelDraft = preferences.assistant.defaultModel;
		runtime = await fetchRuntimeConfig(fetch);
		try {
			assistantHealth = await fetchAssistantHealth(fetch, preferences.backend.ollamaBaseUrl);
		} catch {
			assistantHealth = null;
		}
	}

	onMount(() => {
		void (async () => {
			await refreshRuntime();
			await loadSetupConfig();
			await checkGoogleCalendarStatus();

			const params = new URLSearchParams(window.location.search);
			if (params.get('calendar_connected') === '1') {
				googleConfigMessage = 'Google Calendar connected.';
				await checkGoogleCalendarStatus();
			}

			const calendarError = params.get('calendar_error');
			if (calendarError) {
				googleConfigError = mapCalendarError(calendarError);
			}

			if (params.get('calendar_connected') === '1' || calendarError) {
				window.history.replaceState({}, '', '/settings');
			}
		})();
	});
</script>

<svelte:head><title>Settings | Smart Display</title></svelte:head>

<div class="overlay-page">
	<div class="overlay-panel">
		<header class="overlay-header">
			<div>
				<p class="overlay-eyebrow">Settings</p>
				<h1 class="overlay-title">Display settings</h1>
			</div>
			<div style="display:flex; gap:0.5rem; align-items:center;">
				<ThemeToggle />
				<button class="wizard-btn" type="button" on:click={() => void goto('/setup')}>Setup wizard</button>
			</div>
		</header>

		<div class="overlay-body">
			<div class="settings-grid">

				<!-- Profile -->
				<section class="settings-section">
					<h2 class="section-heading">Profile</h2>
					<SettingsField label="Your name" help="Used for the greeting on the home screen.">
						<div class="input-row">
							<input bind:value={nameDraft} placeholder="William" maxlength="40" />
							<button class="save-btn" type="button" on:click={saveName}>Save</button>
						</div>
					</SettingsField>
				</section>

				<!-- Google Calendar -->
				<section class="settings-section">
					<h2 class="section-heading">Google Calendar</h2>
					<div class="cal-status" class:connected={googleCalendarConnected}>
						<span class="cal-dot"></span>
						<div>
							<strong>{googleCalendarConnected ? 'Connected' : 'Not connected'}</strong>
							{#if googleCalendarEmail}
								<p class="cal-email">{googleCalendarEmail}</p>
							{:else if runtime?.calendar.googleOauthConfigured}
								<p class="cal-email">OAuth settings saved on this device.</p>
							{:else}
								<p class="cal-email">Save your Google OAuth client settings before connecting.</p>
							{/if}
						</div>
						{#if googleCalendarConnected}
							<button class="disconnect-btn" type="button" disabled={googleDisconnecting} on:click={disconnectGoogleCalendar}>
								{googleDisconnecting ? 'Disconnecting…' : 'Disconnect'}
							</button>
						{/if}
					</div>
					<SettingsField label="OAuth client ID" help="Google OAuth web client ID used for Calendar sign-in.">
						<input bind:value={googleClientId} placeholder="...apps.googleusercontent.com" autocomplete="off" />
					</SettingsField>
					<SettingsField label="OAuth client secret" help="Stored locally on this device. Leave blank to keep the saved secret.">
						<input
							type="password"
							bind:value={googleClientSecret}
							placeholder={googleClientSecretConfigured
								? 'Saved on device. Enter a new secret to replace it.'
								: 'GOCSPX-...'}
							autocomplete="off"
						/>
					</SettingsField>
					<SettingsField label="Redirect URI" help="Add this exact URL to your Google OAuth client configuration.">
						<input
							bind:value={googleRedirectUri}
							placeholder={getDefaultGoogleRedirectUri()}
							autocomplete="off"
						/>
					</SettingsField>
					<div class="cal-action-row">
						<button class="save-btn" type="button" disabled={googleConfigSaving || googleDisconnecting} on:click={() => void saveGoogleCalendarConfig()}>
							{googleConfigSaving ? 'Saving…' : 'Save OAuth config'}
						</button>
						<button class="cal-btn" type="button" disabled={googleConfigSaving || googleDisconnecting} on:click={() => void connectGoogleCalendar()}>
							📅 {googleCalendarConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
						</button>
					</div>
					<p class="cal-hint">
						Authorized redirect URI:
						<code>{googleRedirectUri || runtime?.calendar.googleRedirectUri || getDefaultGoogleRedirectUri()}</code>
					</p>
					{#if googleConfigMessage}<p class="feedback feedback-success">{googleConfigMessage}</p>{/if}
					{#if googleConfigError}<p class="feedback feedback-error">{googleConfigError}</p>{/if}
					<SettingsField label="Calendar source" help="Switch between Google Calendar and the built-in mock.">
						<select bind:value={preferences.calendar.provider} on:change={persist}>
							<option value="google">Google Calendar</option>
							<option value="mock">Built-in (mock)</option>
						</select>
					</SettingsField>
					<SettingsField label="Agenda window" help="How many days ahead to show in the calendar view.">
						<input type="number" min="1" max="14" bind:value={preferences.calendar.agendaWindowDays} on:change={persist} />
					</SettingsField>
					<SettingsField label="Show event notes" help="Display description/notes on calendar events.">
						<input type="checkbox" bind:checked={preferences.calendar.showEventNotes} on:change={persist} />
					</SettingsField>
				</section>

				<!-- Appearance -->
				<section class="settings-section">
					<h2 class="section-heading">Appearance</h2>
					<SettingsField label="Theme" help="Dark or light mode.">
						<select bind:value={preferences.appearance.theme} on:change={persist}>
							<option value="dark">Dark</option>
							<option value="light">Light</option>
						</select>
					</SettingsField>
					<SettingsField label="High-contrast clock" help="Keep the time easy to read from across the room.">
						<input type="checkbox" bind:checked={preferences.appearance.highContrastClock} on:change={persist} />
					</SettingsField>
				</section>

				<!-- Ambient photos -->
				<section class="settings-section">
					<h2 class="section-heading">Ambient photos</h2>
					<SettingsField compact={true} label="Photo categories" help="Which scenes rotate in the background.">
						<PhotoCategorySelector
							categories={ambientPhotoCategories}
							selected={preferences.ambient.categories}
							labels={ambientPhotoCategoryLabels}
							defaults={defaultAmbientPhotoCategories}
							on:change={(e) => {
								preferences = updatePreferences((c) => ({ ...c, ambient: { ...c.ambient, categories: e.detail.selected } }));
							}}
						/>
					</SettingsField>
					<SettingsField label="Ambient motion" help="Gentle drift on the background photo.">
						<input type="checkbox" bind:checked={preferences.ambient.motionEnabled} on:change={persist} />
					</SettingsField>
					<SettingsField label="Photo duration (min)" help="How long each photo stays on screen.">
						<input type="range" min="1" max="10" bind:value={preferences.ambient.photoDurationMinutes} on:change={persist} />
						<span class="range-val">{preferences.ambient.photoDurationMinutes} min</span>
					</SettingsField>
					<SettingsField label="Fade duration (sec)" help="How slowly photos blend into each other.">
						<input type="range" min="2" max="8" bind:value={preferences.ambient.fadeDurationSeconds} on:change={persist} />
						<span class="range-val">{preferences.ambient.fadeDurationSeconds}s</span>
					</SettingsField>
				</section>

				<!-- Weather -->
				<section class="settings-section">
					<h2 class="section-heading">Weather & location</h2>
					<ZipCodeField
						value={preferences.weather.zip}
						label="Home ZIP"
						helper="Used on home screen and the forecast view."
						buttonLabel="Save ZIP"
						on:save={handleZipSave}
					/>
					{#if zipMessage}<p class="feedback">{zipMessage}</p>{/if}
					<SettingsField label="Units" help="Temperature unit preference.">
						<select bind:value={preferences.weather.units} on:change={persist}>
							<option value="imperial">Imperial (°F)</option>
							<option value="metric">Metric (°C)</option>
						</select>
					</SettingsField>
					<SettingsField label="Show sunrise / sunset" help="Show sun times in the forecast.">
						<input type="checkbox" bind:checked={preferences.weather.showSunTimes} on:change={persist} />
					</SettingsField>
				</section>

				<!-- Voice -->
				<section class="settings-section">
					<h2 class="section-heading">Voice & assistant</h2>
					<SettingsField label="Input mode" help="Where the assistant listens from.">
						<select bind:value={preferences.assistant.interactionMode} on:change={persist}>
							<option value="browser-mic">Browser microphone</option>
							<option value="pi-local">Pi-local microphone</option>
						</select>
					</SettingsField>
					<SettingsField label="Entry mode" help="Manual push-to-talk or hands-free wake word.">
						<select bind:value={preferences.voice.entryMode} on:change={saveVoiceEntryMode}>
							<option value="push-to-talk">Push to talk</option>
							<option value="wake-word">Wake word</option>
						</select>
					</SettingsField>
					<SettingsField label="Wake phrase" help="Phrase used for wake-word mode.">
						<input bind:value={preferences.voice.wakeWordPhrase} on:change={persist} />
					</SettingsField>
					<SettingsField label="Microphone" help="Enable or disable microphone access.">
						<input type="checkbox" bind:checked={preferences.voice.microphoneEnabled} on:change={persist} />
					</SettingsField>
					<SettingsField label="Speak responses via Pi" help="Play assistant replies through the Pi speaker (Piper TTS).">
						<input type="checkbox" bind:checked={preferences.voice.speakerEnabled} on:change={persist} />
					</SettingsField>
					<SettingsField label="Auto-send transcript" help="Send speech to assistant as soon as transcription finishes.">
						<input type="checkbox" bind:checked={preferences.assistant.autoSendTranscript} on:change={persist} />
					</SettingsField>
					<SettingsField label="Ollama URL" help="Address of the Ollama server.">
						<input bind:value={ollamaUrlDraft} on:change={saveOllamaUrl} />
					</SettingsField>
					<SettingsField label="Default model" help="Model the assistant starts with.">
						{#if assistantHealth?.models.length}
							<select bind:value={modelDraft} on:change={saveModel}>
								{#each assistantHealth.models as model}
									<option value={model.name}>{model.name}</option>
								{/each}
								{#if !assistantHealth.models.find((m) => m.name === modelDraft)}
									<option value={modelDraft}>{modelDraft}</option>
								{/if}
							</select>
						{:else}
							<input bind:value={modelDraft} on:change={saveModel} placeholder="llama3.2:3b" />
						{/if}
					</SettingsField>
				</section>

				<!-- Home Assistant -->
				<section class="settings-section">
					<h2 class="section-heading">Home Assistant</h2>
					<SettingsField label="Base URL" help="Address of your Home Assistant server.">
						<input bind:value={homeAssistantUrlDraft} on:change={saveHomeAssistantConfig} placeholder="http://homeassistant.local:8123" />
					</SettingsField>
					<SettingsField label="Access token" help="Long-lived access token from Home Assistant.">
						<input bind:value={homeAssistantTokenDraft} placeholder="Paste token" on:change={saveHomeAssistantConfig} />
					</SettingsField>
					<SettingsField label="Show on home screen" help="Show HA summary card on the ambient home page.">
						<input type="checkbox" bind:checked={preferences.homeAssistant.showOnHome} on:change={persist} />
					</SettingsField>
				</section>

				<!-- Display / kiosk -->
				<section class="settings-section">
					<h2 class="section-heading">Display / kiosk</h2>
					<SettingsField label="Keep screen awake" help="Prevent the display from sleeping while the dashboard is open.">
						<input type="checkbox" bind:checked={preferences.kiosk.keepScreenAwake} on:change={persist} />
					</SettingsField>
					<SettingsField label="Reduce motion" help="Make background drift even more subtle.">
						<input type="checkbox" bind:checked={preferences.kiosk.reduceAmbientMotion} on:change={persist} />
					</SettingsField>
					<SettingsField label="Prefer HTTPS for mic" help="Use HTTPS when testing the microphone from a remote browser.">
						<input type="checkbox" bind:checked={preferences.kiosk.preferHttpsForMic} on:change={persist} />
					</SettingsField>
				</section>

				<!-- System info -->
				<section class="settings-section">
					<h2 class="section-heading">System</h2>
					<div class="sys-rows">
						<div class="sys-row">
							<span>Host / port</span>
							<strong>{runtime ? `${runtime.server.host}:${runtime.server.port}` : '…'}</strong>
						</div>
						<div class="sys-row">
							<span>Protocol</span>
							<strong>{runtime?.server.preferredProtocol ?? '…'}</strong>
						</div>
						<div class="sys-row">
							<span>Home Assistant env</span>
							<strong>{runtime?.homeAssistant.configured ? 'Configured' : 'Not configured'}</strong>
						</div>
						<div class="sys-row">
							<span>Google Calendar OAuth</span>
							<strong>{runtime?.calendar.googleOauthConfigured ? 'Configured' : 'Not configured'}</strong>
						</div>
					</div>
					{#if assistantHealth}
						<div class="conn-list">
							{#each assistantHealth.connections as conn}
								<ConnectionBadge label={conn.label} state={conn.state} detail={`${conn.target}${conn.latencyMs ? ` · ${conn.latencyMs}ms` : ''}`} />
							{/each}
						</div>
					{/if}
				</section>

			</div>
		</div>

		<footer class="overlay-footer">
			<DockNav items={navItems} />
		</footer>
	</div>
</div>

<style>
	.settings-grid {
		display: grid;
		gap: 1.5rem;
	}

	.settings-section {
		display: grid;
		gap: 0.6rem;
	}

	.section-heading {
		margin: 0 0 0.3rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--accent);
		border-bottom: 1px solid var(--border-soft);
		padding-bottom: 0.4rem;
	}

	select, input:not([type='checkbox']):not([type='range']) {
		width: 100%;
		padding: 0.72rem 0.85rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.9rem;
	}

	:root[data-theme='light'] select,
	:root[data-theme='light'] input:not([type='checkbox']):not([type='range']) {
		background: rgba(0, 0, 0, 0.04);
	}

	input[type='checkbox'] {
		width: 1.15rem;
		height: 1.15rem;
		accent-color: var(--accent);
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
	}

	.save-btn {
		padding: 0.72rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--accent);
		background: rgba(138, 180, 255, 0.1);
		color: var(--accent);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.save-btn:hover { background: rgba(138, 180, 255, 0.2); }

	.range-val {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.feedback {
		margin: 0.25rem 0 0;
		font-size: 0.84rem;
		color: var(--text-secondary);
	}

	.feedback-success {
		color: #6fe6a3;
	}

	.feedback-error {
		color: #ff8070;
	}

	/* Google Calendar */
	.cal-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255,255,255,0.03);
		margin-bottom: 0.5rem;
	}

	.cal-status.connected {
		border-color: rgba(111, 230, 163, 0.3);
		background: rgba(111, 230, 163, 0.08);
	}

	.cal-status strong { display: block; font-size: 0.9rem; }

	.cal-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ffb878;
		flex-shrink: 0;
	}

	.cal-status.connected .cal-dot {
		background: var(--success);
	}

	.cal-email {
		margin: 0.1rem 0 0;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.cal-action-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.disconnect-btn {
		margin-left: auto;
		padding: 0.4rem 0.8rem;
		border-radius: var(--radius);
		border: 1px solid rgba(255,100,80,0.3);
		background: rgba(255,100,80,0.06);
		color: #ff8070;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.disconnect-btn:hover { background: rgba(255,100,80,0.15); }

	.cal-btn {
		padding: 0.7rem 1.1rem;
		border-radius: var(--radius);
		border: 1px solid rgba(138,180,255,0.3);
		background: rgba(138,180,255,0.1);
		color: var(--text-primary);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		text-align: left;
	}

	.cal-btn:hover { background: rgba(138,180,255,0.18); }
	.cal-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.cal-hint {
		font-size: 0.76rem;
		color: var(--text-muted);
		margin: 0;
	}

	.cal-hint code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		word-break: break-all;
	}

	/* System */
	.sys-rows {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}

	.sys-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-soft);
		background: rgba(255,255,255,0.02);
	}

	.sys-row span { font-size: 0.8rem; color: var(--text-secondary); }
	.sys-row strong { font-size: 0.84rem; color: var(--text-primary); }

	.conn-list { display: grid; gap: 0.5rem; }

	.wizard-btn {
		padding: 0.4rem 0.85rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-soft);
		background: rgba(255,255,255,0.04);
		color: var(--text-secondary);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.wizard-btn:hover { border-color: var(--border-strong); color: var(--text-primary); }
</style>
