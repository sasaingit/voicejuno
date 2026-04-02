# Naming

### Functions

Prefix with intent: `build` for construction, `get` for lookups, `create`/`update`/`delete` for CRUD, `handle` for event callbacks, `map` for transforms.

```typescript
// Good
buildEntryTitle()          // constructs a value
getTokensOrError()         // extracts/returns data
createEntry()              // writes to database
handleRecordButtonClick()  // responds to user action
mapWebauthnError()         // transforms one shape to another

// Bad
entryTitle()               // verb missing — getter or builder?
doEntry()                  // vague action
```

### Hooks

Prefix with `use`. Name after what they manage, not what they return.

```typescript
// Good
useAuth()                  // manages authentication state
useSpeechRecognition()     // manages speech recognition lifecycle
useHomeRecorder()          // orchestrates recording flow
useEntries()               // manages entry list state

// Bad
useData()                  // too vague
useStuff()                 // meaningless
```

### State & Types

- State types: `PascalCase` — `RecorderState`, `SpeechStatus`, `AuthState`
- State values: string literals — `'IDLE' | 'RECORDING' | 'SAVING' | 'ERROR'`
- Domain types: `PascalCase` — `Entry`, `EntryCreate`, `EntryPatch`
- Result type: `Result<T>` for async operations

### Constants

`UPPER_SNAKE_CASE` for frozen config objects. Group related values together.

```typescript
const TIMING = Object.freeze({
  timerTickMs: 1000,
  successNoticeMs: 3000,
});

const ERROR_MESSAGES = Object.freeze({
  invalidId: 'Invalid entry id.',
  unexpected: 'Unexpected error — please try again.',
});
```

### Component Files

- Page components: `<Name>Page.tsx` — `LoginPage.tsx`, `EntriesPage.tsx`
- Feature components: descriptive name — `RecordButton.tsx`, `EntryEditor.tsx`
- Route constants: `routes.constants.ts`
- API modules: `<resource>.api.ts` — `entries.api.ts`
