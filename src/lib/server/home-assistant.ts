import { env } from '$env/dynamic/private';
import { getRuntimeConfig } from '$lib/server/runtime';
import type { HomeAssistantResponse } from '$lib/types';

interface HomeAssistantState {
	entity_id: string;
	state: string;
	attributes?: {
		friendly_name?: string;
		device_class?: string;
		unit_of_measurement?: string;
	};
}

function buildStubResponse(baseUrl: string, configured: boolean, error?: string): HomeAssistantResponse {
	return {
		connected: false,
		baseUrl,
		configured,
		updatedAt: new Date().toISOString(),
		summary: configured
			? 'Home Assistant is set up and ready to connect.'
			: 'Add Home Assistant details to bring your home into the display.',
		areas: [
			{ name: 'Living room', summary: 'Lights, media, climate' },
			{ name: 'Entry', summary: 'Locks, motion, cameras' },
			{ name: 'Bedroom', summary: 'Lights, blinds, scene presets' }
		],
		entities: [
			{ id: 'climate.home', label: 'Climate', state: '72 F', secondary: 'Target 70 F' },
			{ id: 'light.living_room', label: 'Living room lights', state: 'Off', secondary: 'Scene ready' },
			{ id: 'alarm_control_panel.home', label: 'Home mode', state: 'Disarmed', secondary: 'Tap to arm later' }
		],
		error
	};
}

export async function getHomeAssistantSummary(): Promise<HomeAssistantResponse> {
	const runtime = getRuntimeConfig();
	const baseUrl = runtime.homeAssistant.baseUrl || env.HOME_ASSISTANT_BASE_URL?.trim() || '';
	const token = env.HOME_ASSISTANT_TOKEN?.trim();
	const configured = Boolean(baseUrl && token);

	if (!configured) {
		return buildStubResponse(baseUrl, false);
	}

	try {
		const apiRoot = new URL('/api/', baseUrl);
		const ping = await fetch(apiRoot, {
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json'
			},
			signal: AbortSignal.timeout(5000)
		});

		if (!ping.ok) {
			return buildStubResponse(baseUrl, true, `Home Assistant returned ${ping.status}.`);
		}

		const statesResponse = await fetch(new URL('/api/states', baseUrl), {
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json'
			},
			signal: AbortSignal.timeout(8000)
		});

		if (!statesResponse.ok) {
			return buildStubResponse(baseUrl, true, `State sync returned ${statesResponse.status}.`);
		}

		const states = (await statesResponse.json()) as HomeAssistantState[];
		const interesting = states
			.filter((state) => {
				const entityId = state.entity_id;
				return (
					entityId.startsWith('light.') ||
					entityId.startsWith('climate.') ||
					entityId.startsWith('sensor.') ||
					entityId.startsWith('alarm_control_panel.')
				);
			})
			.slice(0, 6);

		return {
			connected: true,
			baseUrl,
			configured: true,
			updatedAt: new Date().toISOString(),
			summary: 'Home Assistant is connected and ready.',
			areas: [
				{ name: 'Connected home', summary: `${states.length} entities discovered` }
			],
			entities: interesting.map((entity) => ({
				id: entity.entity_id,
				label: entity.attributes?.friendly_name || entity.entity_id,
				state:
					entity.attributes?.unit_of_measurement
						? `${entity.state} ${entity.attributes.unit_of_measurement}`
						: entity.state,
				secondary: entity.attributes?.device_class
			}))
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown Home Assistant error';
		return buildStubResponse(baseUrl, true, message);
	}
}
