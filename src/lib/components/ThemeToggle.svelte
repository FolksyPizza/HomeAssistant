<script lang="ts">
	import { onMount } from 'svelte';
	import { updatePreferences } from '$lib/services/preferences';
	import { applyTheme, getPreferredTheme, toggleTheme, type Theme } from '$lib/services/theme';

	let theme: Theme = 'dark';
	let handleThemeChange: ((event: Event) => void) | undefined;

	onMount(() => {
		theme = getPreferredTheme();
		applyTheme(theme);

		handleThemeChange = (event: Event) => {
			const next = (event as CustomEvent<Theme>).detail;
			if (next === 'dark' || next === 'light') {
				theme = next;
			}
		};

		window.addEventListener('smart-display-theme-change', handleThemeChange as EventListener);

		return () => {
			if (handleThemeChange) {
				window.removeEventListener(
					'smart-display-theme-change',
					handleThemeChange as EventListener
				);
			}
		};
	});

	function handleToggle(): void {
		theme = toggleTheme(theme);
		updatePreferences((current) => ({
			...current,
			appearance: {
				...current.appearance,
				theme
			}
		}));
		applyTheme(theme);
	}
</script>

<button class="theme-toggle" type="button" on:click={handleToggle} aria-label="Toggle theme">
	<span aria-hidden="true" class="icon">
		{#if theme === 'dark'}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
				<path d="M12 3v2.5" />
				<path d="M12 18.5V21" />
				<path d="M4.93 4.93l1.77 1.77" />
				<path d="M17.3 17.3l1.77 1.77" />
				<path d="M3 12h2.5" />
				<path d="M18.5 12H21" />
				<path d="M4.93 19.07l1.77-1.77" />
				<path d="M17.3 6.7l1.77-1.77" />
				<circle cx="12" cy="12" r="4.2" />
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
				<path d="M20.8 15.4A8.7 8.7 0 0 1 8.6 3.2a8.9 8.9 0 1 0 12.2 12.2Z" />
			</svg>
		{/if}
	</span>
	<span class="label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--overlay-border);
		border-radius: 999px;
		background: var(--overlay-panel-bg);
		color: var(--overlay-panel-text-strong);
		box-shadow: var(--shadow-soft);
		backdrop-filter: blur(16px);
		transition:
			transform 180ms ease,
			border-color 180ms ease,
			background 180ms ease;
	}

	.theme-toggle:hover,
	.theme-toggle:focus-visible {
		transform: translateY(-1px);
		border-color: var(--overlay-border-strong);
		background: var(--overlay-panel-bg-strong);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 1.3rem;
		height: 1.3rem;
	}

	svg {
		width: 100%;
		height: 100%;
	}

	.label {
		font-size: 0.92rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	@media (max-width: 720px) {
		.label {
			display: none;
		}

		.theme-toggle {
			padding-inline: 0.95rem;
		}
	}
</style>
