import type { CalendarEvent, CalendarResponse } from '$lib/types';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

interface AgendaStorePayload {
	events: CalendarEvent[];
}

export interface AgendaEventInput {
	title: string;
	startsAt: string;
	endsAt: string;
	location?: string;
	note?: string;
	color?: string;
	createdBy?: CalendarEvent['createdBy'];
}

const AGENDA_DIR = path.resolve(process.cwd(), 'data');
const AGENDA_FILE = path.join(AGENDA_DIR, 'agenda.json');
const DEFAULT_EVENT_COLOR = '#8ab4ff';

function makeSeedDate(offsetDays: number, hour: number, minute: number): string {
	const date = new Date();
	date.setHours(hour, minute, 0, 0);
	date.setDate(date.getDate() + offsetDays);
	return date.toISOString();
}

function seedAgendaEvents(): CalendarEvent[] {
	return [
		{
			id: 'design-review',
			title: 'Display design review',
			startsAt: makeSeedDate(0, 9, 30),
			endsAt: makeSeedDate(0, 10, 15),
			location: 'Studio desk',
			note: 'Review clock spacing, ambient photo timing, and theme behavior.',
			color: '#7dd3fc',
			createdBy: 'seed'
		},
		{
			id: 'delivery-window',
			title: 'Filament delivery window',
			startsAt: makeSeedDate(0, 13, 0),
			endsAt: makeSeedDate(0, 14, 0),
			location: 'Front porch',
			note: 'PLA refill and nozzle kit.',
			color: '#f9a8d4',
			createdBy: 'seed'
		},
		{
			id: 'quiet-build-session',
			title: 'Quiet build session',
			startsAt: makeSeedDate(1, 18, 30),
			endsAt: makeSeedDate(1, 20, 0),
			location: 'Office',
			note: 'Prototype refinements and printer calibration.',
			color: '#86efac',
			createdBy: 'seed'
		}
	];
}

function sanitizeText(value: string | undefined, fallback = ''): string {
	return typeof value === 'string' ? value.trim() || fallback : fallback;
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
	return [...events].sort(
		(a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
	);
}

function buildResponse(events: CalendarEvent[]): CalendarResponse {
	const sorted = sortEvents(events);
	return {
		focusDay: new Date().toISOString(),
		providerLabel: 'Agenda',
		nextOpenSlot: resolveNextOpenSlot(sorted),
		syncStatus: 'Saved on this display',
		updatedAt: new Date().toISOString(),
		events: sorted
	};
}

function resolveNextOpenSlot(events: CalendarEvent[]): string {
	if (events.length === 0) {
		return 'Wide open';
	}

	const nextEvent = events.find((event) => new Date(event.startsAt).getTime() > Date.now());
	if (!nextEvent) {
		return 'Open after today';
	}

	return `${new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(nextEvent.endsAt))} onward`;
}

function validateEventInput(input: AgendaEventInput): AgendaEventInput {
	const title = sanitizeText(input.title);
	const startsAt = sanitizeText(input.startsAt);
	const endsAt = sanitizeText(input.endsAt);

	if (!title) {
		throw new Error('Event title is required.');
	}

	const start = new Date(startsAt);
	const end = new Date(endsAt);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
		throw new Error('Start and end time must be valid dates.');
	}

	if (end.getTime() <= start.getTime()) {
		throw new Error('Event end time must be after the start time.');
	}

	return {
		title,
		startsAt: start.toISOString(),
		endsAt: end.toISOString(),
		location: sanitizeText(input.location, 'Home'),
		note: sanitizeText(input.note),
		color: sanitizeText(input.color, DEFAULT_EVENT_COLOR),
		createdBy: input.createdBy ?? 'manual'
	};
}

async function ensureAgendaFile(): Promise<void> {
	await mkdir(AGENDA_DIR, { recursive: true });

	try {
		await readFile(AGENDA_FILE, 'utf8');
	} catch {
		const payload: AgendaStorePayload = {
			events: seedAgendaEvents()
		};
		await writeFile(AGENDA_FILE, JSON.stringify(payload, null, 2));
	}
}

async function readAgendaStore(): Promise<AgendaStorePayload> {
	await ensureAgendaFile();
	const raw = await readFile(AGENDA_FILE, 'utf8');
	const payload = JSON.parse(raw) as Partial<AgendaStorePayload>;

	return {
		events: Array.isArray(payload.events) ? sortEvents(payload.events) : seedAgendaEvents()
	};
}

async function writeAgendaStore(payload: AgendaStorePayload): Promise<void> {
	await ensureAgendaFile();
	await writeFile(
		AGENDA_FILE,
		JSON.stringify({ events: sortEvents(payload.events) }, null, 2)
	);
}

export async function getAgendaResponse(): Promise<CalendarResponse> {
	const payload = await readAgendaStore();
	return buildResponse(payload.events);
}

export async function createAgendaEvent(input: AgendaEventInput): Promise<CalendarEvent> {
	const payload = await readAgendaStore();
	const eventInput = validateEventInput(input);
	const event: CalendarEvent = {
		id: crypto.randomUUID(),
		title: eventInput.title,
		startsAt: eventInput.startsAt,
		endsAt: eventInput.endsAt,
		location: eventInput.location || 'Home',
		note: eventInput.note || undefined,
		color: eventInput.color || DEFAULT_EVENT_COLOR,
		createdBy: eventInput.createdBy ?? 'manual'
	};

	payload.events.push(event);
	await writeAgendaStore(payload);
	return event;
}

export async function updateAgendaEvent(
	id: string,
	input: AgendaEventInput
): Promise<CalendarEvent> {
	const payload = await readAgendaStore();
	const index = payload.events.findIndex((event) => event.id === id);
	if (index === -1) {
		throw new Error('Agenda event not found.');
	}

	const eventInput = validateEventInput(input);
	const updated: CalendarEvent = {
		...payload.events[index],
		title: eventInput.title,
		startsAt: eventInput.startsAt,
		endsAt: eventInput.endsAt,
		location: eventInput.location || 'Home',
		note: eventInput.note || undefined,
		color: eventInput.color || DEFAULT_EVENT_COLOR,
		createdBy: payload.events[index].createdBy === 'assistant' ? 'assistant' : 'manual'
	};

	payload.events[index] = updated;
	await writeAgendaStore(payload);
	return updated;
}

export async function deleteAgendaEvent(id: string): Promise<void> {
	const payload = await readAgendaStore();
	const nextEvents = payload.events.filter((event) => event.id !== id);
	if (nextEvents.length === payload.events.length) {
		throw new Error('Agenda event not found.');
	}

	await writeAgendaStore({ events: nextEvents });
}
