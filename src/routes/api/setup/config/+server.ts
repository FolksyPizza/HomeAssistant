import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getSetupConfig,
	getSetupConfigClientPayload,
	saveSetupConfig,
	sanitizeSetupConfig
} from '$lib/server/setup-config';

export const GET: RequestHandler = async () => {
	return json(getSetupConfigClientPayload());
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			googleCalendar?: {
				clientId?: string;
				clientSecret?: string;
				redirectUri?: string;
				clearClientSecret?: boolean;
			};
		};

		const current = getSetupConfig();
		const nextSecret = body.googleCalendar?.clearClientSecret
			? ''
			: typeof body.googleCalendar?.clientSecret === 'string' &&
				  body.googleCalendar.clientSecret.trim().length > 0
				? body.googleCalendar.clientSecret.trim()
				: current.googleCalendar.clientSecret;

		const saved = await saveSetupConfig(
			sanitizeSetupConfig({
				googleCalendar: {
					clientId: body.googleCalendar?.clientId ?? current.googleCalendar.clientId,
					clientSecret: nextSecret,
					redirectUri: body.googleCalendar?.redirectUri ?? current.googleCalendar.redirectUri
				}
			})
		);

		return json({
			googleCalendar: {
				clientId: saved.googleCalendar.clientId,
				clientSecretConfigured: Boolean(saved.googleCalendar.clientSecret),
				redirectUri: saved.googleCalendar.redirectUri
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown setup config error';
		return json({ message }, { status: 400 });
	}
};
