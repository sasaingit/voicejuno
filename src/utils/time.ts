const TIME = Object.freeze({
  secondsPerMinute: 60,
  padLength: 2,
});

const ENTRY_TIMEZONE = 'Australia/Melbourne' as const;

function toLowerNoSpaces(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

export function formatEntryTimestamp(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';

  const dateParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: ENTRY_TIMEZONE,
    day: 'numeric',
    month: 'short',
  }).formatToParts(date);

  const day = dateParts.find((part) => part.type === 'day')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  if (!day || !month) return '';

  const timeParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: ENTRY_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const hour = timeParts.find((part) => part.type === 'hour')?.value;
  const minute = timeParts.find((part) => part.type === 'minute')?.value;
  const dayPeriod = timeParts.find((part) => part.type === 'dayPeriod')?.value;
  if (!hour || !minute || !dayPeriod) return '';

  return `${day} ${month} ${hour}:${minute}${toLowerNoSpaces(dayPeriod)}`;
}

export function formatTimer(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safeSeconds / TIME.secondsPerMinute);
  const seconds = safeSeconds % TIME.secondsPerMinute;

  return `${String(minutes).padStart(TIME.padLength, '0')}:${String(seconds).padStart(TIME.padLength, '0')}`;
}
