export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'smart-display-theme';

export function getPreferredTheme(): Theme {
	if (typeof window === 'undefined') {
		return 'dark';
	}

	try {
		const rawPreferences = window.localStorage.getItem('smart-display-preferences-v2');
		if (rawPreferences) {
			const parsed = JSON.parse(rawPreferences) as {
				appearance?: {
					theme?: Theme;
				};
			};
			if (parsed.appearance?.theme === 'dark' || parsed.appearance?.theme === 'light') {
				return parsed.appearance.theme;
			}
		}
	} catch {
		// Fall through to legacy theme storage.
	}

	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored === 'dark' || stored === 'light') {
		return stored;
	}

	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') {
		return;
	}

	document.documentElement.dataset.theme = theme;
	if (typeof window !== 'undefined') {
		window.localStorage.setItem(STORAGE_KEY, theme);
		window.dispatchEvent(new CustomEvent('smart-display-theme-change', { detail: theme }));
	}
}

export function toggleTheme(theme: Theme): Theme {
	return theme === 'dark' ? 'light' : 'dark';
}
