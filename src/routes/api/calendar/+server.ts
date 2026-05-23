import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAgendaEvent, getAgendaResponse } from '$lib/server/agenda-store';
import type { AgendaEventInput } from '$lib/server/agenda-store';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const mode = url.searchParams.get('mode');
		if (mode === 'error') {
			throw new Error('Calendar service intentionally returned an error state.');
		}

		const agenda = await getAgendaResponse();
		if (mode === 'empty') {
			return json({
				...agenda,
				events: [],
				nextOpenSlot: 'Wide open'
			});
		}

		return json(agenda);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown calendar error';
		return json({ message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as AgendaEventInput;
		const event = await createAgendaEvent(body);
		return json({ event }, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown calendar error';
		return json({ message }, { status: 400 });
	}
};
