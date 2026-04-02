# Types & Immutability

### Strict-Friendly TypeScript

- Avoid `any`. Use `unknown` and narrow with type guards.
- Avoid unsafe casts. Prefer validation at boundaries and explicit types for inputs/outputs.

### Domain Types

Prefer explicit domain types over loose objects for database rows, API inputs, hook return values, and component props.

```typescript
// Good: explicit domain types
export type Entry = {
  id: string;
  user_id: string;
  title: string;
  transcript: string;
  recorded_at: string; // ISO
  created_at: string;
  updated_at: string;
};

export type EntryCreate = {
  title: string;
  transcript: string;
  recorded_at: string; // ISO
};

export type EntryPatch = {
  title?: string;
  transcript?: string;
};

// Bad: loose object
const entry: Record<string, unknown> = { ... };
```

### State Types as Unions

Use string literal unions for finite state machines. This makes exhaustive checking possible and state transitions explicit.

```typescript
// Good: explicit state union
export type RecorderState = 'SIGNED_OUT' | 'IDLE' | 'RECORDING' | 'SAVING' | 'ERROR';
export type SpeechStatus = 'idle' | 'recording' | 'error';
export type NoticeType = 'info' | 'success' | 'error';

// Bad: boolean flags
type RecorderState = {
  isRecording: boolean;
  isSaving: boolean;
  hasError: boolean;  // can be true while isRecording is also true?
};
```

### Result Type

Use a discriminated union for async operation results. Both branches are always checked.

```typescript
export type Result<T> = { data: T; error: null } | { data: null; error: Error };
```

### Type-Only Imports

Use `import type` for interfaces and types erased at runtime.

```typescript
import type { Entry, EntryCreate, EntryPatch } from '../types/entry';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
```

### Hook Return Types

Define explicit types for hook return values when the shape is complex or consumed by multiple components.

```typescript
// Good: explicit return type
export type UseSpeechRecognition = {
  isSupported: boolean;
  status: SpeechStatus;
  finalTranscript: string;
  interimTranscript: string;
  errorMessage: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeechRecognition(): UseSpeechRecognition { ... }
```

### Readonly and Immutability

- Use `Object.freeze()` for constant config objects and string maps.
- Favor immutable data transformations over in-place mutation.
- Keep domain logic pure — isolate side effects in hooks and the data layer.

```typescript
// Good: frozen constants
const ERROR_MESSAGES = Object.freeze({
  invalidId: 'Invalid entry id.',
  unexpected: 'Unexpected error — please try again.',
});

// Good: immutable transform
const sorted = [...entries].sort((a, b) =>
  new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
);

// Bad: in-place mutation
entries.sort((a, b) => ...);  // mutates the original array
```

### Satisfies for Type Checking

Use `satisfies` to validate values match a type without widening.

```typescript
// Good: satisfies checks shape without losing literal types
const { error } = await createEntry.create({
  title,
  transcript,
  recorded_at: recordedAt,
} satisfies EntryCreate);
```
