import { env } from '$env/dynamic/private';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SETUP_CONFIG_PATH = join(process.cwd(), 'data', 'setup-config.json');

export interface SetupConfig {
	googleCalendar: {
		clientId: string;
		clientSecret: string;
		redirectUri: string;
	};
}

export interface SetupConfigClientPayload {
	googleCalendar: {
		clientId: string;
		clientSecretConfigured: boolean;
		redirectUri: string;
	};
}

function getDefaultSetupConfig(): SetupConfig {
	return {
		googleCalendar: {
			clientId: '',
			clientSecret: '',
			redirectUri: ''
		}
	};
}

function sanitizeString(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function sanitizeSetupConfig(value: unknown): SetupConfig {
	const input = (value ?? {}) as Partial<SetupConfig>;
	return {
		googleCalendar: {
			clientId: sanitizeString(input.googleCalendar?.clientId, 512),
			clientSecret: sanitizeString(input.googleCalendar?.clientSecret, 512),
			redirectUri: sanitizeString(input.googleCalendar?.redirectUri, 1024)
		}
	};
}

export function getSetupConfig(): SetupConfig {
	try {
		const raw = readFileSync(SETUP_CONFIG_PATH, 'utf-8');
		return sanitizeSetupConfig(JSON.parse(raw));
	} catch {
		return getDefaultSetupConfig();
	}
}

export async function saveSetupConfig(config: SetupConfig): Promise<SetupConfig> {
	const sanitized = sanitizeSetupConfig(config);
	await mkdir(join(process.cwd(), 'data'), { recursive: true });
	await writeFile(SETUP_CONFIG_PATH, JSON.stringify(sanitized, null, 2), 'utf-8');
	return sanitized;
}

export async function updateSetupConfig(
	updater: (current: SetupConfig) => SetupConfig
): Promise<SetupConfig> {
	const current = getSetupConfig();
	return saveSetupConfig(updater(current));
}

export function getSetupConfigClientPayload(): SetupConfigClientPayload {
	const config = getSetupConfig();
	return {
		googleCalendar: {
			clientId: config.googleCalendar.clientId,
			clientSecretConfigured: Boolean(config.googleCalendar.clientSecret),
			redirectUri: config.googleCalendar.redirectUri
		}
	};
}

export function getGoogleCalendarOAuthConfig(origin: string): {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	configured: boolean;
} {
	const setupConfig = getSetupConfig();
	const clientId = env.GOOGLE_CLIENT_ID?.trim() || setupConfig.googleCalendar.clientId;
	const clientSecret =
		env.GOOGLE_CLIENT_SECRET?.trim() || setupConfig.googleCalendar.clientSecret;
	const redirectUri =
		env.GOOGLE_REDIRECT_URI?.trim() ||
		setupConfig.googleCalendar.redirectUri ||
		`${origin}/api/calendar/oauth/callback`;

	return {
		clientId,
		clientSecret,
		redirectUri,
		configured: Boolean(clientId && clientSecret)
	};
}
