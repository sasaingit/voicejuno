import { formatEntryTimestamp } from './time';

const TITLE = Object.freeze({
  prefix: 'Entry',
  separator: ' - ',
});

export function buildEntryTitle(recordedAtIso: string): string {
  const timestamp = formatEntryTimestamp(recordedAtIso);
  if (timestamp.length === 0) return TITLE.prefix;
  return `${TITLE.prefix}${TITLE.separator}${timestamp}`;
}
