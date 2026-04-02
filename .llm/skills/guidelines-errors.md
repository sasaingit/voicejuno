# Error Handling

### Result Pattern

All async data operations return `Result<T>` — never throw from the data layer. Let the caller decide how to surface the error.

```typescript
export type Result<T> = { data: T; error: null } | { data: null; error: Error };

// Good: returns Result, caller handles
export async function createEntry(input: EntryCreate): Promise<Result<Entry>> {
  if (!assertNonEmptyString(input.title)) {
    return { data: null, error: new Error(ERROR_MESSAGES.invalidCreateInput) };
  }
  const { data, error } = await supabase.from('entries').insert({ ... }).select().single();
  if (error) return { data: null, error: toReadableError('Creating entry', error) };
  return { data, error: null };
}

// Good: caller handles result
const { error } = await createEntry.create({ title, transcript, recorded_at: recordedAt });
if (error) {
  setNotice({ type: 'error', message: error.message });
} else {
  setNotice({ type: 'success', message: COPY.saveSuccess });
}
```

### Fail Fast

Throw on truly invalid state. For expected failures, use the Result pattern instead.

```typescript
// Good: throw for broken invariants (auth hooks)
if (!isWebAuthnSupported()) {
  throw new Error(ERROR_MESSAGES.passkeysUnsupported);
}

// Good: Result for expected data validation failures
if (!assertNonEmptyString(id)) {
  return { data: null, error: new Error(ERROR_MESSAGES.invalidId) };
}
```

### Validate at Boundaries

Validate early at system edges: user input, API request bodies, environment variables.

```typescript
// Good: validate before hitting the database
export async function updateEntry(id: string, patch: EntryPatch): Promise<Result<Entry>> {
  if (!assertNonEmptyString(id)) {
    return { data: null, error: new Error(ERROR_MESSAGES.invalidId) };
  }
  if (Object.keys(patch).length === 0) {
    return { data: null, error: new Error(ERROR_MESSAGES.invalidPatch) };
  }
  // ...proceed with Supabase call
}

// Good: validate env in edge functions
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
```

### Readable Error Messages

Wrap infrastructure errors with human-readable context. Group messages in frozen constants.

```typescript
const ERROR_MESSAGES = Object.freeze({
  invalidId: 'Invalid entry id.',
  invalidCreateInput: 'Title and transcript are required.',
  unexpected: 'Unexpected error — please try again.',
});

function toReadableError(operation: string, err: unknown): Error {
  if (err instanceof Error) {
    const message = err.message.trim();
    return new Error(message.length > 0 ? message : `${operation} failed.`);
  }
  return new Error(`${operation} failed.`);
}
```

### Map Domain-Specific Errors

For external APIs with their own error codes, create dedicated mappers.

```typescript
// Good: WebAuthn errors mapped to user-friendly messages
function mapWebauthnError(e: unknown, context: 'register' | 'login'): Error {
  if (isDomExceptionLike(e)) {
    if (e.name === 'AbortError' || e.name === 'NotAllowedError') {
      return new Error(ERROR_MESSAGES.canceled);
    }
    if (context === 'register' && e.name === 'InvalidStateError') {
      return new Error(ERROR_MESSAGES.passkeyAlreadyExists);
    }
  }
  return e instanceof Error ? e : new Error(ERROR_MESSAGES.network);
}

// Good: Speech API errors mapped
function mapSpeechError(code: string | undefined): string {
  if (code === 'not-allowed') return ERROR_MESSAGES.permissionDenied;
  if (code === 'audio-capture') return ERROR_MESSAGES.micUnavailable;
  if (code === 'no-speech') return ERROR_MESSAGES.noSpeech;
  return ERROR_MESSAGES.generic;
}
```
