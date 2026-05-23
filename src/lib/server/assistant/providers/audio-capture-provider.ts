import { getRuntimeConfig } from '$lib/server/runtime';
import type { ServiceConnection } from '$lib/types';

export interface AudioCaptureProvider {
	id: string;
	label: string;
	describe(): ServiceConnection;
}

class BrowserMicCaptureProvider implements AudioCaptureProvider {
	id = 'browser-mic';
	label = 'Browser microphone';

	describe(): ServiceConnection {
		const runtime = getRuntimeConfig();
		return {
			id: this.id,
			label: this.label,
			target: runtime.featureFlags.browserMicTesting ? 'https browser mic' : 'disabled',
			state: runtime.featureFlags.browserMicTesting ? 'online' : 'degraded',
			detail: runtime.featureFlags.browserMicTesting
				? 'Push-to-talk browser microphone testing is available.'
				: 'Browser microphone testing is disabled.'
		};
	}
}

export function getAudioCaptureProviders(): AudioCaptureProvider[] {
	return [new BrowserMicCaptureProvider()];
}
