import { supabase } from './supabaseClient';
import type { Account } from '../types/account';

export type Result<T> = { data: T; error: null } | { data: null; error: Error };

const ACCOUNT_COLUMNS = 'id,handle' as const;

const ERROR_MESSAGES = Object.freeze({
  notFound: 'Account not found.',
  unexpected: 'Unexpected error — please try again.',
});

const POSTGREST_ERROR_CODES = Object.freeze({
  noRows: 'PGRST116',
});

type PostgrestErrorLike = {
  code?: unknown;
  message?: unknown;
};

function isPostgrestErrorLike(value: unknown): value is PostgrestErrorLike {
  return typeof value === 'object' && value !== null;
}

function toReadableError(operation: string, err: unknown): Error {
  if (isPostgrestErrorLike(err) && err.code === POSTGREST_ERROR_CODES.noRows) {
    return new Error(ERROR_MESSAGES.notFound);
  }

  if (err instanceof Error) {
    const message = err.message.trim();
    return new Error(message.length > 0 ? message : `${operation} failed.`);
  }

  if (isPostgrestErrorLike(err) && typeof err.message === 'string' && err.message.trim().length > 0) {
    return new Error(err.message);
  }

  return new Error(`${operation} failed.`);
}

export async function fetchMyAccount(): Promise<Result<Account>> {
  const { data, error } = await supabase.from('accounts').select(ACCOUNT_COLUMNS).single();

  if (error) return { data: null, error: toReadableError('Loading account', error) };
  if (!data) return { data: null, error: new Error(ERROR_MESSAGES.unexpected) };

  return { data, error: null };
}
