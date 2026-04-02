# Architecture & Separation

### Layer Separation

Keep these clearly separated — don't mix them in the same function:
- **Domain logic**: data transforms, validation, formatting (pure functions)
- **Orchestration**: React hooks that wire state, effects, and callbacks together
- **Infrastructure**: Supabase client, Web Speech API, browser APIs, edge functions
- **Presentation**: components that render UI (props in → UI out)

```
src/utils/              → domain logic (pure calculations)
src/hooks/              → orchestration (state + effects + callbacks)
src/data/               → infrastructure (Supabase client, API calls)
src/components/         → presentation (UI rendering)
src/pages/              → page-level composition
supabase/functions/     → server-side edge functions (Deno)
```

### Hooks as Orchestration

Custom hooks own state management and side-effect coordination. Keep domain logic out of hooks — extract it into pure utility functions.

Hooks typically:
- Coordinate async flows (loading, error, success states)
- Shape data for UI consumption
- Call `src/data/` APIs and translate `Result<T>` into UI-friendly state

```typescript
// Good: pure utility extracted, hook orchestrates
function buildCombinedTranscript(speech: UseSpeechRecognition): string {
  return `${speech.finalTranscript}${speech.interimTranscript}`.trim();
}

export function useHomeRecorder(args: { user: User | null; speech: UseSpeechRecognition }) {
  const combinedTranscript = useMemo(() => buildCombinedTranscript(args.speech), [/* deps */]);
  // ...state + effects + callbacks
}

// Bad: domain logic inline in hook
export function useHomeRecorder(args: { user: User | null; speech: UseSpeechRecognition }) {
  const combinedTranscript = useMemo(
    () => `${args.speech.finalTranscript}${args.speech.interimTranscript}`.trim(),
    [/* deps */]
  );
}
```

### Data Layer Isolation

Keep Supabase operations in `src/data/`. Components and hooks should never import `supabase` directly — they consume API functions that return `Result<T>`.

Data-layer functions should also follow these Supabase query practices:
- Assume Row Level Security (RLS) is enabled. Never rely on client-side checks for authorization.
- Validate inputs before calling Supabase.
- Avoid `select('*')` unless absolutely necessary. Select only required columns.
- Return a consistent `Result<T>` shape and wrap infrastructure errors with readable context.

```typescript
// Good: data layer owns Supabase interaction
// src/data/entries.api.ts
export async function listEntries(): Promise<Result<Entry[]>> {
  const { data, error } = await supabase.from('entries').select(ENTRY_COLUMNS);
  if (error) return { data: null, error: toReadableError('Loading entries', error) };
  return { data: data ?? [], error: null };
}

// Bad: Supabase leaked into component
function EntriesList() {
  const { data } = await supabase.from('entries').select('*'); // infrastructure in UI
}
```

### Edge Function Structure

Supabase edge functions (Deno) follow a consistent pattern: validate input, perform operation, return JSON response with CORS headers.

```typescript
// supabase/functions/my-function/index.ts
import { corsHeaders, jsonResponse, errorResponse } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const body = await req.json();
  // validate, process, respond
  return jsonResponse({ success: true });
});
```

### Frozen Constants

Group related string literals and magic numbers into `Object.freeze()` constants at module scope. This keeps them discoverable and prevents accidental mutation.

```typescript
const COPY = Object.freeze({
  emptyNotSaved: 'Nothing captured — entry not saved.',
  saveSuccess: 'Saved.',
});

const TIMING = Object.freeze({
  timerTickMs: 1000,
  successNoticeMs: 3000,
});
```
