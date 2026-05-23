<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getSavedPreferences, isValidZip, sanitizeZip, updatePreferences } from '$lib/services/preferences';

	interface SetupConfigResponse {
		googleCalendar: {
			clientId: string;
			clientSecretConfigured: boolean;
			redirectUri: string;
		};
	}

	let step = 1;
	const TOTAL_STEPS = 4;

	let preferences = getSavedPreferences();

	// Step 1 – Name
	let name = preferences.user.name || '';

	// Step 2 – ZIP
	let zip = preferences.weather.zip || '';
	let zipError = '';

	// Step 3 – Google Calendar
	let calendarConnecting = false;
	let calendarSaving = false;
	let calendarMessage = '';
	let calendarError = '';
	let googleClientId = '';
	let googleClientSecret = '';
	let googleClientSecretConfigured = false;
	let googleRedirectUri = '';

	function next(): void {
		if (step < TOTAL_STEPS) step++;
		else finish();
	}

	function back(): void {
		if (step > 1) step--;
	}

	function handleNameNext(): void {
		updatePreferences((current) => ({ ...current, user: { ...current.user, name: name.trim() } }));
		next();
	}

	function handleZipNext(): void {
		const cleaned = sanitizeZip(zip);
		if (!isValidZip(cleaned)) {
			zipError = 'Enter a valid 5-digit US ZIP code.';
			return;
		}
		zipError = '';
		updatePreferences((current) => ({ ...current, weather: { ...current.weather, zip: cleaned } }));
		next();
	}

	function getDefaultRedirectUri(): string {
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
			if (!response.ok) return;

			const config = (await response.json()) as SetupConfigResponse;
			googleClientId = config.googleCalendar.clientId;
			googleClientSecretConfigured = config.googleCalendar.clientSecretConfigured;
			googleRedirectUri = config.googleCalendar.redirectUri || getDefaultRedirectUri();
		} catch {
			googleRedirectUri = googleRedirectUri || getDefaultRedirectUri();
		}
	}

	async function saveGoogleCalendarConfig(): Promise<boolean> {
		calendarSaving = true;
		calendarError = '';
		calendarMessage = '';

		try {
			const response = await fetch('/api/setup/config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					googleCalendar: {
						clientId: googleClientId.trim(),
						clientSecret: googleClientSecret.trim(),
						redirectUri: googleRedirectUri.trim() || getDefaultRedirectUri()
					}
				})
			});

			if (!response.ok) {
				const error = (await response.json().catch(() => ({}))) as { message?: string };
				throw new Error(error.message || 'Setup config save failed');
			}

			const saved = (await response.json()) as SetupConfigResponse;
			googleClientId = saved.googleCalendar.clientId;
			googleClientSecret = '';
			googleClientSecretConfigured = saved.googleCalendar.clientSecretConfigured;
			googleRedirectUri = saved.googleCalendar.redirectUri || getDefaultRedirectUri();
			calendarMessage = 'Google Calendar settings saved on this device.';
			return true;
		} catch (error) {
			calendarError =
				error instanceof Error ? error.message : 'Could not save Google Calendar settings.';
			return false;
		} finally {
			calendarSaving = false;
		}
	}

	async function connectGoogleCalendar(): Promise<void> {
		calendarError = '';
		calendarMessage = '';

		if (!googleClientId.trim()) {
			calendarError = 'Enter your Google OAuth client ID first.';
			return;
		}

		if (!googleClientSecret.trim() && !googleClientSecretConfigured) {
			calendarError = 'Enter your Google OAuth client secret first.';
			return;
		}

		calendarConnecting = true;
		try {
			const saved = await saveGoogleCalendarConfig();
			if (!saved) return;
			window.location.href = '/api/calendar/oauth/start?from=setup';
		} finally {
			calendarConnecting = false;
		}
	}

	async function skipCalendar(): Promise<void> {
		const hasDraft =
			Boolean(googleClientId.trim()) ||
			Boolean(googleClientSecret.trim()) ||
			Boolean(googleRedirectUri.trim());

		if (hasDraft) {
			await saveGoogleCalendarConfig();
		}

		next();
	}

	function finish(): void {
		updatePreferences((current) => ({ ...current, user: { ...current.user, setupComplete: true } }));
		void goto('/');
	}

	onMount(() => {
		void loadSetupConfig();

		const params = new URLSearchParams(window.location.search);
		const requestedStep = Number(params.get('step'));
		if (Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= TOTAL_STEPS) {
			step = requestedStep;
		}

		const calendarConnected = params.get('calendar_connected') === '1';
		const calendarErrorCode = params.get('calendar_error');

		if (calendarConnected) {
			calendarMessage = 'Google Calendar connected.';
			step = 4;
			preferences = updatePreferences((current) => ({
				...current,
				calendar: { ...current.calendar, provider: 'google', googleConnected: true }
			}));
		}

		if (calendarErrorCode) {
			step = 3;
			calendarError = mapCalendarError(calendarErrorCode);
		}

		if (calendarConnected || calendarErrorCode || params.get('step')) {
			window.history.replaceState({}, '', '/setup');
		}
	});

	$: dots = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);
</script>

<svelte:head><title>Setup | Smart Display</title></svelte:head>

<div class="setup-screen">
	<div class="setup-card">
		<div class="setup-step-indicator">
			{#each dots as dot}
				<div class="setup-dot" class:active={dot <= step}></div>
			{/each}
		</div>

		{#if step === 1}
			<div class="setup-step">
				<div>
					<h1 class="setup-heading">Welcome</h1>
					<p class="setup-sub">Let's get your display set up. It only takes a minute.</p>
				</div>
				<div class="setup-field">
					<label class="setup-label" for="name">Your name (optional)</label>
					<input
						id="name"
						class="setup-input"
						type="text"
						placeholder="William"
						maxlength="40"
						bind:value={name}
						on:keydown={(event) => event.key === 'Enter' && handleNameNext()}
					/>
					<p class="setup-hint">Used for the greeting on your home screen.</p>
				</div>
				<div class="setup-actions">
					<button class="btn-primary" type="button" on:click={handleNameNext}>Continue →</button>
				</div>
			</div>

		{:else if step === 2}
			<div class="setup-step">
				<div>
					<h1 class="setup-heading">Your location</h1>
					<p class="setup-sub">Enter your ZIP code so we can show the local weather forecast.</p>
				</div>
				<div class="setup-field">
					<label class="setup-label" for="zip">ZIP code</label>
					<input
						id="zip"
						class="setup-input"
						type="text"
						inputmode="numeric"
						placeholder="e.g., 10001"
						maxlength="5"
						bind:value={zip}
						on:input={() => {
							zipError = '';
						}}
						on:keydown={(event) => {
							if (event.key === 'Enter') handleZipNext();
						}}
						autocomplete="off"
					/>
					{#if zipError}<p class="setup-error">{zipError}</p>{/if}
				</div>
				<div class="setup-actions">
					<button class="btn-ghost" type="button" on:click={back}>← Back</button>
					<button class="btn-primary" type="button" on:click={handleZipNext}>Continue →</button>
				</div>
			</div>

		{:else if step === 3}
			<div class="setup-step">
				<div>
					<h1 class="setup-heading">Google Calendar</h1>
					<p class="setup-sub">
						Save your Google OAuth details once on this device, then connect your calendar.
					</p>
				</div>
				<div class="setup-field">
					<label class="setup-label" for="google-client-id">OAuth client ID</label>
					<input
						id="google-client-id"
						class="setup-input"
						type="text"
						placeholder="...apps.googleusercontent.com"
						bind:value={googleClientId}
						autocomplete="off"
					/>
					<p class="setup-hint">Create a Google OAuth web client in Google Cloud Console.</p>
				</div>
				<div class="setup-field">
					<label class="setup-label" for="google-client-secret">OAuth client secret</label>
					<input
						id="google-client-secret"
						class="setup-input"
						type="password"
						placeholder={googleClientSecretConfigured
							? 'Saved on this device. Enter a new secret to replace it.'
							: 'GOCSPX-...'}
						bind:value={googleClientSecret}
						autocomplete="off"
					/>
					<p class="setup-hint">
						{googleClientSecretConfigured
							? 'A client secret is already saved. Leave this blank to keep it.'
							: 'This is stored locally on the Pi so you do not need to re-enter it.'}
					</p>
				</div>
				<div class="setup-field">
					<label class="setup-label" for="google-redirect-uri">Redirect URI</label>
					<input
						id="google-redirect-uri"
						class="setup-input"
						type="text"
						placeholder={getDefaultRedirectUri()}
						bind:value={googleRedirectUri}
						autocomplete="off"
					/>
					<p class="setup-hint">Add this exact URL to the authorized redirect URIs for your OAuth client.</p>
				</div>
				{#if calendarMessage}<p class="setup-success">{calendarMessage}</p>{/if}
				{#if calendarError}<p class="setup-error">{calendarError}</p>{/if}
				<div class="calendar-options">
					<button class="btn-ghost" type="button" disabled={calendarSaving || calendarConnecting} on:click={saveGoogleCalendarConfig}>
						{calendarSaving ? 'Saving…' : 'Save config'}
					</button>
					<button class="cal-connect-btn" type="button" disabled={calendarSaving || calendarConnecting} on:click={connectGoogleCalendar}>
						<span class="cal-icon">📅</span>
						{calendarConnecting ? 'Opening Google…' : 'Save and connect Google Calendar'}
					</button>
				</div>
				<div class="setup-actions">
					<button class="btn-ghost" type="button" on:click={back}>← Back</button>
					<button class="btn-ghost" type="button" disabled={calendarSaving || calendarConnecting} on:click={skipCalendar}>
						Skip for now
					</button>
				</div>
			</div>

		{:else if step === 4}
			<div class="setup-step">
				<div>
					<div class="done-icon">✓</div>
					<h1 class="setup-heading">All set{name ? `, ${name}` : ''}!</h1>
					<p class="setup-sub">
						Your display is ready. You can change any of these settings later from the Settings page.
					</p>
				</div>
				<div class="setup-actions" style="justify-content: center;">
					<button class="btn-primary" type="button" on:click={finish}>Launch display →</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.setup-hint {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.setup-error {
		margin: 0.25rem 0 0;
		font-size: 0.82rem;
		color: #ff8070;
	}

	.setup-success {
		margin: 0;
		font-size: 0.82rem;
		color: #6fe6a3;
	}

	.calendar-options {
		display: grid;
		gap: 0.75rem;
	}

	.cal-connect-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.85rem 1.1rem;
		border-radius: var(--radius);
		border: 1px solid rgba(138, 180, 255, 0.3);
		background: rgba(138, 180, 255, 0.1);
		color: var(--text-primary);
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 150ms ease;
	}

	.cal-connect-btn:hover {
		background: rgba(138, 180, 255, 0.18);
	}

	.cal-connect-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.cal-icon {
		font-size: 1.3rem;
	}

	.done-icon {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: rgba(111, 230, 163, 0.2);
		border: 1px solid rgba(111, 230, 163, 0.4);
		color: #6fe6a3;
		font-size: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
	}
</style>
