<script lang="ts">
	import { onMount } from 'svelte';
	import AmbientBackdrop from '$components/AmbientBackdrop.svelte';
	import AsyncState from '$components/AsyncState.svelte';
	import CardShell from '$components/CardShell.svelte';
	import ConnectionBadge from '$components/ConnectionBadge.svelte';
	import DockNav from '$components/DockNav.svelte';
	import ThemeToggle from '$components/ThemeToggle.svelte';
	import { fetchHomeAssistant, fetchRuntimeConfig } from '$lib/services/api';
	import { getSavedPreferences, updatePreferences } from '$lib/services/preferences';
	import type { AppRuntimeConfig, HomeAssistantResponse, NavItem, ResourceState } from '$lib/types';

	const navItems: NavItem[] = [
		{ label: 'Home', href: '/', description: 'Clock', icon: '⌂' },
		{ label: 'Weather', href: '/weather', description: 'Forecast', icon: '☁' },
		{ label: 'Assistant', href: '/assistant', description: 'Talk', icon: '◉' },
		{ label: 'Settings', href: '/settings', description: 'Display', icon: '⚙' }
	];

	let preferences = getSavedPreferences();
	let homeAssistantState: ResourceState<HomeAssistantResponse> = { status: 'loading' };
	let runtime: AppRuntimeConfig | null = null;

	function syncPreferences(): void {
		preferences = getSavedPreferences();
	}

	async function refresh(): Promise<void> {
		syncPreferences();
		homeAssistantState = { status: 'loading' };
		try {
			const [nextHomeAssistant, nextRuntime] = await Promise.all([
				fetchHomeAssistant(fetch),
				fetchRuntimeConfig(fetch)
			]);
			homeAssistantState = { status: 'success', data: nextHomeAssistant };
			runtime = nextRuntime;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown Home Assistant error';
			homeAssistantState = { status: 'error', error: message };
		}
	}

	function toggleHomeAssistantHomeVisibility(): void {
		preferences = updatePreferences((current) => ({
			...current,
			homeAssistant: {
				...current.homeAssistant,
				showOnHome: !current.homeAssistant.showOnHome
			}
		}));
	}

	onMount(() => {
		void refresh();
	});
</script>

<svelte:head>
	<title>Home Assistant | Smart Display</title>
</svelte:head>

<AmbientBackdrop
	motionScale={preferences.kiosk.reduceAmbientMotion || !preferences.ambient.motionEnabled ? 0 : 0.03}
/>

<div class="screen-shell">
	<div class="screen-frame">
		<header class="screen-header">
			<div>
				<p class="screen-eyebrow">Home Assistant</p>
				<h1 class="screen-title">Home overview</h1>
				<p class="screen-intro">See connection status and a quick view of your home in one place.</p>
			</div>
			<div class="screen-header-actions">
				<button class="overlay-button" type="button" on:click={toggleHomeAssistantHomeVisibility}>
					{preferences.homeAssistant.showOnHome ? 'Hide from home' : 'Show on home'}
				</button>
				<ThemeToggle />
			</div>
		</header>

		<main class="screen-main panel-grid panel-grid--main-side">
			<section class="panel-grid">
				{#if homeAssistantState.status === 'loading'}
					<CardShell title="Connection" eyebrow="Home Assistant">
						<AsyncState variant="loading" title="Checking Home Assistant" message="Looking for the configured hub and any available entities." />
					</CardShell>
				{:else if homeAssistantState.status === 'error'}
					<CardShell title="Connection" eyebrow="Home Assistant">
						<AsyncState variant="error" title="Home Assistant unavailable" message={homeAssistantState.error} />
					</CardShell>
				{:else if homeAssistantState.status === 'success'}
					<CardShell title="Connection" eyebrow="Home Assistant">
						<div class="panel-stack">
							<ConnectionBadge
								label={homeAssistantState.data.connected ? 'Connected' : homeAssistantState.data.configured ? 'Configured' : 'Setup needed'}
								state={homeAssistantState.data.connected ? 'online' : 'degraded'}
								detail={homeAssistantState.data.baseUrl || 'No Home Assistant URL configured yet'}
							/>
							<p class="copy">{homeAssistantState.data.summary}</p>
							<div class="area-grid">
								{#each homeAssistantState.data.areas as area}
									<div class="area-card">
										<strong>{area.name}</strong>
										<span>{area.summary}</span>
									</div>
								{/each}
							</div>
						</div>
					</CardShell>

					<CardShell title="Home summary" eyebrow="At a glance">
						<div class="entity-grid">
							{#each homeAssistantState.data.entities as entity}
								<article class="entity-card">
									<div>
										<h3>{entity.label}</h3>
										<p>{entity.id}</p>
									</div>
									<div class="entity-state">
										<strong>{entity.state}</strong>
										{#if entity.secondary}<span>{entity.secondary}</span>{/if}
									</div>
								</article>
							{/each}
						</div>
					</CardShell>
				{:else}
					<CardShell title="Connection" eyebrow="Home Assistant">
						<AsyncState variant="empty" title="No Home Assistant data" message="No Home Assistant entities are available yet." />
					</CardShell>
				{/if}
			</section>

			<section class="panel-grid">
				<CardShell title="Settings" eyebrow="Saved here">
					<div class="info-grid">
						<div class="info-row">
							<span>Configured URL</span>
							<strong>{preferences.homeAssistant.baseUrl}</strong>
						</div>
						<div class="info-row">
							<span>Token status</span>
							<strong>{runtime?.homeAssistant.configured ? 'Connected on the server' : preferences.homeAssistant.tokenConfigured ? 'Saved in settings' : 'Not configured'}</strong>
						</div>
						<div class="info-row">
							<span>Home summary</span>
							<strong>{preferences.homeAssistant.showOnHome ? 'Visible on home' : 'Hidden from home'}</strong>
						</div>
					</div>
				</CardShell>

				<CardShell title="Connection" eyebrow="How it signs in">
					<p class="copy">
						Server-side sign-in handles secure access to Home Assistant. Use Settings to keep the display address and token aligned with your home.
					</p>
				</CardShell>
			</section>
		</main>

		<footer class="screen-footer">
			<DockNav items={navItems} />
		</footer>
	</div>
</div>

<style>
	.panel-stack,
	.info-grid,
	.area-grid,
	.entity-grid {
		display: grid;
		gap: 0.8rem;
	}

	.copy,
	h3,
	p {
		margin: 0;
	}

	.copy {
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.area-grid {
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
	}

	.area-card,
	.entity-card,
	.info-row {
		padding: 1rem;
		border-radius: 1.2rem;
		background: color-mix(in srgb, var(--surface-strong) 66%, transparent);
		border: 1px solid var(--border-soft);
	}

	.area-card strong,
	.area-card span,
	.info-row span,
	.info-row strong,
	.entity-state strong,
	.entity-state span {
		display: block;
	}

	.area-card span,
	.entity-card p,
	.entity-state span,
	.info-row span {
		color: var(--text-secondary);
	}

	.entity-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.entity-card h3 {
		font-size: 1rem;
	}

	.entity-card p {
		margin-top: 0.25rem;
		font-size: 0.82rem;
	}

	.entity-state {
		text-align: right;
	}

	.entity-state strong {
		font-size: 1.02rem;
		color: var(--text-primary);
	}

	.info-row span {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.info-row strong {
		margin-top: 0.35rem;
		word-break: break-word;
		color: var(--text-primary);
	}
</style>
