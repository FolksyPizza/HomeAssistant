export function formatClock(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
}

export function formatDay(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	}).format(date);
}

export function formatShortDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	}).format(date);
}

export function formatEventTime(value: string): string {
	return new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(value));
}

export function formatRelativeTime(value: string): string {
	const now = Date.now();
	const target = new Date(value).getTime();
	const deltaMinutes = Math.round((target - now) / 60000);

	if (Math.abs(deltaMinutes) < 60) {
		return deltaMinutes >= 0 ? `in ${deltaMinutes} min` : `${Math.abs(deltaMinutes)} min ago`;
	}

	const deltaHours = Math.round(deltaMinutes / 60);
	return deltaHours >= 0 ? `in ${deltaHours} hr` : `${Math.abs(deltaHours)} hr ago`;
}

export function getGreeting(date: Date): string {
	const hour = date.getHours();

	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}
