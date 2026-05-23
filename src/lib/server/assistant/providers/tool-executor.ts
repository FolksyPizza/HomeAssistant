import { createAgendaEvent } from '$lib/server/agenda-store';
import type { AssistantToolExecution } from '$lib/types';

interface ParsedCalendarIntent {
	title: string;
	startsAt: string;
	endsAt: string;
}

function stripCommandPreamble(prompt: string): string {
	return prompt
		.replace(/^(please\s+)?(add|create|schedule)\s+(an?\s+)?(agenda|calendar)\s+event\s*/i, '')
		.replace(/^(please\s+)?(add|create|schedule)\s*/i, '')
		.trim();
}

function resolveDayReference(prompt: string): Date {
	const now = new Date();
	const lower = prompt.toLowerCase();
	const base = new Date(now);
	base.setSeconds(0, 0);

	if (lower.includes('tomorrow')) {
		base.setDate(base.getDate() + 1);
		return base;
	}

	if (lower.includes('today')) {
		return base;
	}

	const absoluteDateMatch = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
	if (absoluteDateMatch) {
		const parsed = new Date(`${absoluteDateMatch[1]}T12:00:00`);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
	for (const [index, weekday] of weekdays.entries()) {
		if (lower.includes(weekday)) {
			const delta = (index - now.getDay() + 7) % 7 || 7;
			base.setDate(base.getDate() + delta);
			return base;
		}
	}

	return base;
}

function resolveTimeReference(prompt: string): { hour: number; minute: number } | null {
	const match = prompt.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
	if (!match) {
		return null;
	}

	let hour = Number(match[1]);
	const minute = Number(match[2] ?? '0');
	const meridiem = match[3]?.toLowerCase();

	if (Number.isNaN(hour) || Number.isNaN(minute)) {
		return null;
	}

	if (meridiem === 'pm' && hour < 12) {
		hour += 12;
	}

	if (meridiem === 'am' && hour === 12) {
		hour = 0;
	}

	return { hour, minute };
}

function resolveDurationMinutes(prompt: string): number {
	const match = prompt.match(/\bfor\s+(\d+)\s*(minute|minutes|min|hour|hours|hr|hrs)\b/i);
	if (!match) {
		return 60;
	}

	const amount = Number(match[1]);
	const unit = match[2].toLowerCase();
	if (unit.startsWith('hour') || unit.startsWith('hr')) {
		return amount * 60;
	}

	return amount;
}

function resolveTitle(prompt: string): string {
	const namedMatch = prompt.match(/\b(?:called|named)\s+(.+)$/i);
	if (namedMatch?.[1]) {
		return namedMatch[1].trim();
	}

	const simplified = stripCommandPreamble(prompt)
		.replace(/\b(today|tomorrow|on\s+20\d{2}-\d{2}-\d{2})\b/gi, '')
		.replace(
			/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
			''
		)
		.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
		.replace(/\bfor\s+\d+\s*(minute|minutes|min|hour|hours|hr|hrs)\b/gi, '')
		.trim();

	return simplified || 'New event';
}

function parseCalendarIntent(prompt: string): ParsedCalendarIntent | null {
	const lower = prompt.toLowerCase();
	if (
		!/(add|create|schedule)/i.test(prompt) ||
		!/(calendar|agenda|event)/i.test(prompt)
	) {
		return null;
	}

	const time = resolveTimeReference(prompt);
	if (!time) {
		return null;
	}

	const day = resolveDayReference(lower);
	day.setHours(time.hour, time.minute, 0, 0);
	const durationMinutes = resolveDurationMinutes(prompt);
	const endsAt = new Date(day);
	endsAt.setMinutes(endsAt.getMinutes() + durationMinutes);

	return {
		title: resolveTitle(prompt),
		startsAt: day.toISOString(),
		endsAt: endsAt.toISOString()
	};
}

export async function executeAssistantTool(
	prompt: string
): Promise<AssistantToolExecution | null> {
	const calendarIntent = parseCalendarIntent(prompt);
	if (!calendarIntent) {
		return null;
	}

	const event = await createAgendaEvent({
		title: calendarIntent.title,
		startsAt: calendarIntent.startsAt,
		endsAt: calendarIntent.endsAt,
		createdBy: 'assistant'
	});

	const startsAtLabel = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(event.startsAt));

	return {
		id: event.id,
		label: 'Calendar event created',
		state: 'completed',
		summary: `Added "${event.title}" for ${startsAtLabel}.`
	};
}
