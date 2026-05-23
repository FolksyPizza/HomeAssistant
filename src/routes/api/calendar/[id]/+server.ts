import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteAgendaEvent,
	type AgendaEventInput,
	updateAgendaEvent
} from '$lib/server/agenda-store';

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const body = (await request.json()) as AgendaEventInput;
		const event = await updateAgendaEvent(params.id, body);
		return json({ event });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown calendar error';
		return json({ message }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		await deleteAgendaEvent(params.id);
		return new Response(null, { status: 204 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown calendar error';
		return json({ message }, { status: 404 });
	}
};
