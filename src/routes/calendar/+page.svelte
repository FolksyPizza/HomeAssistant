<script lang="ts">
	import { onMount } from 'svelte';
	import AsyncState from '$components/AsyncState.svelte';
	import DockNav from '$components/DockNav.svelte';
	import {
		createCalendarEvent,
		deleteCalendarEvent,
		fetchCalendar,
		fetchGoogleCalendar,
		isCalendarEmpty,
		loadResource,
		updateCalendarEvent
	} from '$lib/services/api';
	import { getSavedPreferences } from '$lib/services/preferences';
	import type { CalendarEvent, CalendarResponse, NavItem, ResourceState } from '$lib/types';
	import { formatEventTime, formatRelativeTime, formatShortDate } from '$lib/utils/format';

	const navItems: NavItem[] = [
		{ label: 'Home', href: '/', description: 'Clock', icon: '⌂' },
		{ label: 'Weather', href: '/weather', description: 'Forecast', icon: '☁' },
		{ label: 'Calendar', href: '/calendar', description: 'Agenda', icon: '☷' },
		{ label: 'Assistant', href: '/assistant', description: 'Talk', icon: '◉' },
		{ label: 'Settings', href: '/settings', description: 'Display', icon: '⚙' }
	];

	type EventForm = {
		title: string;
		startsAt: string;
		endsAt: string;
		location: string;
		note: string;
		color: string;
	};

	const defaultColor = '#8ab4ff';

	let preferences = getSavedPreferences();
	let calendarState: ResourceState<CalendarResponse> = { status: 'loading' };
	let editingId: string | null = null;
	let showForm = false;
	let formMessage = '';
	let formError = '';
	let formBusy = false;
	let form: EventForm = createDefaultForm();

	function getCreatedByLabel(source: CalendarEvent['createdBy']): string {
		if (source === 'assistant') return 'Assistant';
		if (source === 'manual') return 'Added here';
		return 'Saved';
	}

	function createDefaultForm(): EventForm {
		const start = new Date();
		start.setMinutes(0, 0, 0);
		start.setHours(start.getHours() + 1);
		const end = new Date(start);
		end.setHours(end.getHours() + 1);
		return {
			title: '',
			startsAt: toLocalInputValue(start.toISOString()),
			endsAt: toLocalInputValue(end.toISOString()),
			location: '',
			note: '',
			color: defaultColor
		};
	}

	function toLocalInputValue(value: string): string {
		const date = new Date(value);
		return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
	}

	function fromLocalInputValue(value: string): string {
		return new Date(value).toISOString();
	}

	async function refresh(): Promise<void> {
		calendarState = { status: 'loading' };
		if (preferences.calendar.provider === 'google') {
			try {
				const result = await fetchGoogleCalendar(fetch);
				if (!result.connected) {
					calendarState = { status: 'error', error: 'Google Calendar not connected. Connect in Settings.' };
				} else if (result.error) {
					calendarState = { status: 'error', error: result.error };
				} else if (result.events.length === 0) {
					calendarState = { status: 'empty', message: 'No upcoming Google Calendar events.' };
				} else {
					calendarState = { status: 'success', data: result };
				}
			} catch (error) {
				calendarState = { status: 'error', error: error instanceof Error ? error.message : 'Failed to load Google Calendar.' };
			}
		} else {
			calendarState = await loadResource(() => fetchCalendar(fetch), isCalendarEmpty);
		}
	}

	function beginCreate(): void {
		editingId = null;
		form = createDefaultForm();
		formMessage = '';
		formError = '';
		showForm = true;
	}

	function beginEdit(event: CalendarEvent): void {
		editingId = event.id;
		form = {
			title: event.title,
			startsAt: toLocalInputValue(event.startsAt),
			endsAt: toLocalInputValue(event.endsAt),
			location: event.location,
			note: event.note ?? '',
			color: event.color
		};
		formMessage = '';
		formError = '';
		showForm = true;
	}

	async function saveEvent(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		formBusy = true;
		formMessage = '';
		formError = '';
		try {
			const payload = {
				title: form.title,
				startsAt: fromLocalInputValue(form.startsAt),
				endsAt: fromLocalInputValue(form.endsAt),
				location: form.location,
				note: form.note,
				color: form.color
			};
			if (editingId) {
				await updateCalendarEvent(fetch, editingId, payload);
				formMessage = 'Event updated.';
			} else {
				await createCalendarEvent(fetch, payload);
				formMessage = 'Event added.';
			}
			await refresh();
			showForm = false;
			editingId = null;
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Unable to save event.';
		} finally {
			formBusy = false;
		}
	}

	async function removeEvent(id: string): Promise<void> {
		if (!confirm('Delete this event?')) return;
		formError = '';
		try {
			await deleteCalendarEvent(fetch, id);
			if (editingId === id) showForm = false;
			await refresh();
		} catch (error) {
			formError = error instanceof Error ? error.message : 'Unable to delete event.';
		}
	}

	onMount(() => { void refresh(); });
</script>

<svelte:head><title>Calendar | Smart Display</title></svelte:head>

<div class="overlay-page">
	<div class="overlay-panel">
		<header class="overlay-header">
			<div>
				<p class="overlay-eyebrow">Calendar</p>
				<h1 class="overlay-title">Agenda</h1>
			</div>
			<button class="add-btn" type="button" on:click={beginCreate}>+ Add</button>
		</header>

		<div class="overlay-body">
			{#if showForm}
				<!-- Event form -->
				<form class="event-form" on:submit={saveEvent}>
					<div class="form-header">
						<h2 class="form-title">{editingId ? 'Edit event' : 'New event'}</h2>
						<button type="button" class="form-close" on:click={() => { showForm = false; }}>✕</button>
					</div>
					<label class="form-field">
						<span>Title</span>
						<input bind:value={form.title} placeholder="Dentist appointment" required />
					</label>
					<div class="form-row">
						<label class="form-field">
							<span>Starts</span>
							<input bind:value={form.startsAt} type="datetime-local" required />
						</label>
						<label class="form-field">
							<span>Ends</span>
							<input bind:value={form.endsAt} type="datetime-local" required />
						</label>
					</div>
					<label class="form-field">
						<span>Location</span>
						<input bind:value={form.location} placeholder="Optional" />
					</label>
					<label class="form-field">
						<span>Notes</span>
						<textarea bind:value={form.note} rows="2" placeholder="Optional note"></textarea>
					</label>
					<label class="form-field accent-row">
						<span>Color</span>
						<input bind:value={form.color} type="color" class="color-input" />
					</label>
					<div class="form-actions">
						<button class="btn-primary" type="submit" disabled={formBusy}>
							{editingId ? 'Save changes' : 'Add event'}
						</button>
						<button class="btn-ghost" type="button" on:click={() => { showForm = false; }}>Cancel</button>
					</div>
					{#if formMessage}<p class="form-msg">{formMessage}</p>{/if}
					{#if formError}<p class="form-msg form-msg--error">{formError}</p>{/if}
				</form>
			{:else}
				<!-- Event list -->
				{#if calendarState.status === 'loading'}
					<AsyncState variant="loading" title="Loading agenda" message="Fetching upcoming events." />
				{:else if calendarState.status === 'error'}
					<AsyncState variant="error" title="Agenda unavailable" message={calendarState.error} />
				{:else if calendarState.status === 'empty'}
					<div class="empty-state">
						<p>No upcoming events.</p>
						<button class="btn-primary" type="button" on:click={beginCreate}>Add your first event</button>
					</div>
				{:else}
					<div class="event-list">
						<div class="list-meta">
							<span>{calendarState.data.events.length} events · {formatShortDate(new Date(calendarState.data.focusDay))}</span>
							{#if calendarState.data.providerLabel}
								<span class="provider-badge">{calendarState.data.providerLabel}</span>
							{/if}
						</div>
						{#each calendarState.data.events as event (event.id)}
							<article class="event-card" style="--accent:{event.color}">
								<div class="event-accent"></div>
								<div class="event-body">
									<div class="event-info">
										<h3>{event.title}</h3>
										{#if event.location}<p class="event-loc">📍 {event.location}</p>{/if}
										<p class="event-time">
											{formatShortDate(new Date(event.startsAt))} · {formatEventTime(event.startsAt)}–{formatEventTime(event.endsAt)}
										</p>
									</div>
									<div class="event-meta">
										<strong class="event-rel">{formatRelativeTime(event.startsAt)}</strong>
										<small>{getCreatedByLabel(event.createdBy)}</small>
									</div>
								</div>
								{#if event.note && preferences.calendar.showEventNotes}
									<p class="event-note">{event.note}</p>
								{/if}
								<div class="event-actions">
									<button type="button" class="btn-ghost btn-sm" on:click={() => beginEdit(event)}>Edit</button>
									<button type="button" class="btn-danger btn-sm" on:click={() => removeEvent(event.id)}>Delete</button>
								</div>
							</article>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<footer class="overlay-footer">
			<DockNav items={navItems} />
		</footer>
	</div>
</div>

<style>
	.add-btn {
		padding: 0.4rem 0.9rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-soft);
		background: rgba(138, 180, 255, 0.12);
		color: var(--accent);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
	}

	.add-btn:hover {
		background: rgba(138, 180, 255, 0.22);
	}

	/* Event list */
	.list-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.provider-badge {
		padding: 0.2rem 0.55rem;
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-soft);
		font-size: 0.72rem;
	}

	.event-list {
		display: grid;
		gap: 0.6rem;
	}

	.event-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.85rem 1rem 0.85rem 1.25rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.03);
	}

	.event-accent {
		position: absolute;
		left: 0;
		top: 0.5rem;
		bottom: 0.5rem;
		width: 3px;
		border-radius: 2px;
		background: var(--accent);
	}

	.event-body {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.event-info h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.event-loc, .event-time, .event-note {
		margin: 0.2rem 0 0;
		font-size: 0.8rem;
		color: var(--text-secondary);
	}

	.event-meta {
		text-align: right;
		flex-shrink: 0;
	}

	.event-rel {
		display: block;
		font-size: 0.84rem;
		color: var(--text-primary);
	}

	small {
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.event-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-sm {
		padding: 0.3rem 0.7rem;
		font-size: 0.78rem;
	}

	.btn-ghost {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		border: 1px solid var(--border-soft);
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.84rem;
		cursor: pointer;
	}

	.btn-ghost:hover { border-color: var(--border-strong); color: var(--text-primary); }

	.btn-danger {
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
		border: 1px solid rgba(255, 100, 80, 0.3);
		background: rgba(255, 100, 80, 0.08);
		color: #ff8070;
		font-size: 0.84rem;
		cursor: pointer;
	}

	.btn-danger:hover { background: rgba(255, 100, 80, 0.18); }

	/* Empty */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		text-align: center;
		color: var(--text-secondary);
	}

	/* Event form */
	.event-form {
		display: grid;
		gap: 0.85rem;
		padding: 1rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.03);
	}

	.form-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.form-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.form-close {
		width: 1.8rem;
		height: 1.8rem;
		border: none;
		background: rgba(255,255,255,0.06);
		border-radius: var(--radius);
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.form-field {
		display: grid;
		gap: 0.35rem;
	}

	.form-field span {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.form-field input,
	.form-field textarea {
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border-soft);
		border-radius: var(--radius);
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-primary);
		font-size: 0.9rem;
		width: 100%;
	}

	.color-input { padding: 0.3rem; min-height: 2.5rem; }

	.form-actions {
		display: flex;
		gap: 0.6rem;
	}

	.form-msg {
		margin: 0;
		font-size: 0.84rem;
		color: var(--text-secondary);
	}

	.form-msg--error { color: #ff8070; }
</style>
