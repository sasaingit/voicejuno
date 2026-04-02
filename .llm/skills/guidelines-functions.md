# Functions & Control Flow

### Small and Focused

One responsibility per function. Separate calculation from orchestration.

```typescript
// Good: pure utility, used by hook
export function buildEntryTitle(recordedAtIso: string): string {
  const timestamp = formatEntryTimestamp(recordedAtIso);
  if (timestamp.length === 0) return TITLE.prefix;
  return `${TITLE.prefix}${TITLE.separator}${timestamp}`;
}

// Good: hook orchestrates using the utility
const title = buildEntryTitle(recordedAt);
const { error } = await createEntry.create({ title, transcript, recorded_at: recordedAt });
```

### Early Returns

Guard first, calculate second. No deep nesting.

```typescript
// Good
const handleRecordButtonClick = useCallback(async () => {
  if (recorderState === 'RECORDING') {
    // ...handle stop
    return;
  }
  if (recorderState !== 'IDLE') return;
  // ...handle start
}, [recorderState]);

// Bad
const handleRecordButtonClick = useCallback(async () => {
  if (recorderState === 'RECORDING') {
    // ...handle stop
  } else {
    if (recorderState === 'IDLE') {
      // ...handle start
    }
  }
}, [recorderState]);
```

### No Hidden Side Effects

If a function does I/O, state updates, or API calls, make it explicit in the name or placement.

```typescript
// Good: names tell you what they do
handleRecordButtonClick()   // event handler — expects side effects
createEntry()               // CRUD operation — writes to DB
mapSpeechError()            // pure transform — no side effects

// Bad: hidden side effect inside a "pure" function
function formatTranscript(text: string) {
  analytics.track('transcript_formatted');  // unexpected side effect
  return text.trim();
}
```

### Compose Small Helpers

Prefer composing helpers over one large function.

```typescript
// Good: small reusable pieces
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
```

### Async/Await Over Promises

Always use `async/await` instead of `.then()` chains. It reads top-to-bottom, makes error handling straightforward, and avoids nesting.

```typescript
// Good: async/await
async function registerPasskey() {
  const startResult = await startWebauthnRegister();
  if (startResult.error) throw startResult.error;

  const credential = await navigator.credentials.create({ publicKey });
  const finishResult = await finishWebauthnRegister({ credential, challengeId });
  if (finishResult.error) throw finishResult.error;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw new Error(error.message);
}

// Bad: promise chains
function registerPasskey() {
  return startWebauthnRegister()
    .then((startResult) => {
      if (startResult.error) throw startResult.error;
      return navigator.credentials.create({ publicKey });
    })
    .then((credential) => finishWebauthnRegister({ credential, challengeId }))
    .then((finishResult) => {
      if (finishResult.error) throw finishResult.error;
      return supabase.auth.setSession({ access_token, refresh_token });
    });
}
```

### Callback Memoization

Use `useCallback` when you need a stable function identity (for dependency arrays, memoized children, or performance-sensitive code). Don’t memoize by default.

When you do memoize, include all dependencies in the dependency array.

```typescript
// Good: memoized with correct deps
const handleRetry = useCallback(() => {
  resetUi();
  setRecorderState(user ? 'IDLE' : 'SIGNED_OUT');
}, [resetUi, user]);
```

### React Behavior (Hooks & Rendering)

- Avoid unnecessary `useEffect`. Prefer event-driven actions over lifecycle-driven effects.
- Keep rendering logic simple and predictable. Extract small components for loading, error, and empty states.
- Only use `useMemo` / `useCallback` when there is a clear reason (stability requirements or measurable performance wins).
