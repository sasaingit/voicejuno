import { supabase } from './supabaseClient';
import type { Entry, EntryCreate, EntryPatch } from '../types/entry';

const ENTRY_COLUMNS = 'id,user_id,title,transcript,recorded_at,created_at,updated_at' as const;

const ERROR_MESSAGES = Object.freeze({
  invalidId: 'Invalid entry id.',
  invalidRecordedAt: 'Invalid recorded_at timestamp.',
  invalidCreateInput: 'Title and transcript are required.',
  invalidPatch: 'Nothing to update.',
  unexpected: 'Unexpected error — please try again.',
});

function assertNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidIsoTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function toReadableError(operation: string, err: unknown): Error {
  if (err instanceof Error) {
    const message = err.message.trim();
    return new Error(message.length > 0 ? message : `${operation} failed.`);
  }

  return new Error(`${operation} failed.`);
}

export async function listEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .order('recorded_at', { ascending: false })
    .limit(100);

  if (error) throw toReadableError('Loading entries', error);
  return data ?? [];
}

export async function createEntry(input: EntryCreate): Promise<Entry> {
  if (!assertNonEmptyString(input.title) || !assertNonEmptyString(input.transcript)) {
    throw new Error(ERROR_MESSAGES.invalidCreateInput);
  }
  if (!assertNonEmptyString(input.recorded_at) || !isValidIsoTimestamp(input.recorded_at)) {
    throw new Error(ERROR_MESSAGES.invalidRecordedAt);
  }

  const { data, error } = await supabase
    .from('entries')
    .insert({
      title: input.title,
      transcript: input.transcript,
      recorded_at: input.recorded_at,
    })
    .select(ENTRY_COLUMNS)
    .single();

  if (error) throw toReadableError('Creating entry', error);
  if (!data) throw new Error(ERROR_MESSAGES.unexpected);
  return data;
}

export async function updateEntry(id: string, patch: EntryPatch): Promise<Entry> {
  if (!assertNonEmptyString(id)) {
    throw new Error(ERROR_MESSAGES.invalidId);
  }

  const nextPatch: EntryPatch = {
    ...(patch.title !== undefined ? { title: patch.title } : null),
    ...(patch.transcript !== undefined ? { transcript: patch.transcript } : null),
  };

  if (Object.keys(nextPatch).length === 0) {
    throw new Error(ERROR_MESSAGES.invalidPatch);
  }

  const { data, error } = await supabase
    .from('entries')
    .update(nextPatch)
    .eq('id', id)
    .select(ENTRY_COLUMNS)
    .single();

  if (error) throw toReadableError('Updating entry', error);
  if (!data) throw new Error(ERROR_MESSAGES.unexpected);
  return data;
}

export async function deleteEntry(id: string): Promise<void> {
  if (!assertNonEmptyString(id)) {
    throw new Error(ERROR_MESSAGES.invalidId);
  }

  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw toReadableError('Deleting entry', error);
}
