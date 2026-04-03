# Code Structure — Voice Journaling (voicejuno)

A React + TypeScript voice journaling app powered by Supabase (database, auth, edge functions) and the Web Speech API. Users authenticate with WebAuthn passkeys and record voice entries that are transcribed locally in the browser.

**Stack:** React 18, React Router 6, TypeScript 5, Vite 5, Supabase (PostgreSQL + Auth + Edge Functions), Deno (edge functions), Web Speech API

---

## Directory Structure

```
voicejuno/
├── src/
│   ├── app/                         # App shell & routing
│   │   ├── App.tsx
│   │   ├── RequireAuth.tsx
│   │   ├── routes.tsx
│   │   └── routes.constants.ts
│   ├── pages/                       # Page-level components
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── AppHomePage.tsx
│   │   └── EntriesPage.tsx
│   ├── components/                  # Reusable UI components
│   │   ├── entries/
│   │   │   ├── EntriesList.tsx
│   │   │   └── EntryEditor.tsx
│   │   └── recorder/
│   │       ├── RecordButton.tsx
│   │       ├── Timer.tsx
│   │       └── TranscriptView.tsx
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useEntries.ts
│   │   ├── useHomeRecorder.ts
│   │   ├── useMyProfile.ts
│   │   └── useSpeechRecognition.ts
│   ├── data/                        # API & infrastructure layer
│   │   ├── supabaseClient.ts
│   │   ├── entries.api.ts
│   │   ├── profiles.api.ts
│   │   └── webauthnAuthRepository.ts
│   ├── types/                       # Domain types
│   │   ├── entry.ts
│   │   └── profile.ts
│   ├── utils/                       # Pure utility functions
│   │   ├── time.ts
│   │   └── title.ts
│   ├── styles/
│   │   └── app.css
│   ├── main.tsx
│   ├── config.ts
│   └── vite-env.d.ts
├── supabase/
│   └── functions/                   # Deno edge functions
│       ├── _shared/
│       │   ├── base64url.ts
│       │   ├── env.ts
│       │   ├── http.ts
│       │   ├── jwt.ts
│       │   └── supabaseAdmin.ts
│       ├── auth-webauthn-register-start/
│       ├── auth-webauthn-register-finish/
│       ├── auth-webauthn-login-start/
│       └── auth-webauthn-login-finish/
├── docs/
├── .llm/                            # Coding guidelines for AI agents
│   └── skills/
└── Configuration files (package.json, tsconfig.json, vite.config.ts, etc.)
```

---

## File Responsibilities & Exported Functions

### App Shell (`src/app/`)

| File | Responsibility | Key Exports |
|------|---------------|-------------|
| `App.tsx` | Root component; wraps the app in `<RouterProvider>` | `App` component |
| `RequireAuth.tsx` | Auth guard; redirects unauthenticated users to `/login` | `RequireAuth` component |
| `routes.tsx` | Defines all routes and nesting | `router` (React Router instance) |
| `routes.constants.ts` | Named route path constants | `ROUTES` object (`/`, `/login`, `/app`, `/app/entries`) |

### Pages (`src/pages/`)

| File | Responsibility | Key Exports |
|------|---------------|-------------|
| `LandingPage.tsx` | Public landing page with nav links to login/entries | `LandingPage` component |
| `LoginPage.tsx` | WebAuthn registration & login UI; checks browser support; redirects to `/app` on success | `LoginPage` component |
| `AppHomePage.tsx` | Main recording interface; wires together `useAuth`, `useMyProfile`, `useSpeechRecognition`, `useCreateEntry`, and `useHomeRecorder` | `AppHomePage` component |
| `EntriesPage.tsx` | Two-pane layout — entry list (left) + entry detail (right); manages `selectedEntryId` state | `EntriesPage` component |

### Components (`src/components/`)

| File | Responsibility | Props |
|------|---------------|-------|
| `RecordButton.tsx` | 220px circular record button with state-driven styling (idle/recording/saving) | `state`, `disabled?`, `onClick` |
| `Timer.tsx` | Displays recording duration as `MM:SS` | `seconds` |
| `TranscriptView.tsx` | Shows combined final + interim transcript with placeholder when empty | `finalTranscript`, `interimTranscript` |
| `EntriesList.tsx` | Vertical list of entry cards; highlights selected entry | `entries`, `selectedEntryId`, `onSelectEntry` |
| `EntryEditor.tsx` | Displays full entry detail (timestamp, title, transcript) or placeholder | `entry` |

### Hooks (`src/hooks/`)

| File | Responsibility | Key Exports |
|------|---------------|-------------|
| `useAuth.ts` | Manages Supabase session state; orchestrates WebAuthn register/login ceremonies; subscribes to `onAuthStateChange` | `useAuth()` returning `{ session, user, loading, signInWithPasskey, registerPasskey, signOut }` |
| `useEntries.ts` | Provides two hooks: one for fetching entry list, one for creating entries | `useEntriesList()` returning `{ entries, status, errorMessage, reload }`; `useCreateEntry()` returning `{ status, errorMessage, create }` |
| `useSpeechRecognition.ts` | Wraps Web Speech API; manages `finalTranscript` and `interimTranscript`; maps browser error codes to readable messages; language: `en-AU` | `useSpeechRecognition()` returning `{ isSupported, status, finalTranscript, interimTranscript, errorMessage, start, stop, reset }` |
| `useHomeRecorder.ts` | State machine orchestrating the recording flow (IDLE -> RECORDING -> SAVING -> IDLE); manages timer, notices, and error states | `useHomeRecorder(...)` returning `{ recorderState, recordingSeconds, recorderErrorMessage, notice, isBusy, recordButtonState, recordDisabled, shouldShowTranscript, combinedTranscript, handleRecordButtonClick, handleRetry }` |
| `useMyProfile.ts` | Fetches authenticated user's profile; accepts `{ enabled }` flag | `useMyProfile(options)` returning `{ status, profile?, message? }` |

### Data Layer (`src/data/`)

All API functions return `Result<T>` = `{ data: T; error: null } | { data: null; error: Error }`.

| File | Responsibility | Key Exports |
|------|---------------|-------------|
| `supabaseClient.ts` | Initializes Supabase client singleton; validates env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); enforces HTTPS in production | `supabase` |
| `entries.api.ts` | Entry CRUD operations with input validation | `listEntries()`, `createEntry(input)`, `updateEntry(id, patch)`, `deleteEntry(id)` |
| `profiles.api.ts` | Fetches authenticated user's profile | `fetchMyProfile()` |
| `webauthnAuthRepository.ts` | Calls WebAuthn edge function endpoints; extracts tokens from responses | `startWebauthnRegister()`, `finishWebauthnRegister(credential, challengeId)`, `startWebauthnLogin()`, `finishWebauthnLogin(credential, challengeId)`, `getTokensOrError(response)` |

### Types (`src/types/`)

| File | Types |
|------|-------|
| `entry.ts` | `Entry` (full row), `EntryCreate` (title, transcript, recorded_at), `EntryPatch` (partial update) |
| `profile.ts` | `Profile` (id, handle) |

### Utilities (`src/utils/`)

| File | Functions |
|------|-----------|
| `time.ts` | `formatEntryTimestamp(iso)` — formats to "3 Apr 2:30pm" (Australia/Melbourne); `formatTimer(seconds)` — formats to "MM:SS" |
| `title.ts` | `buildEntryTitle(recordedAtIso)` — generates "Entry - {timestamp}" title |

### Config (`src/`)

| File | Responsibility |
|------|---------------|
| `config.ts` | Exports `SUPABASE_PROJECT_REF` and `EDGE_FUNCTIONS_BASE_URL` |
| `main.tsx` | React root initialization; renders `<App />` into `#root` |
| `vite-env.d.ts` | Type declarations for Vite env vars |

---

## Supabase Edge Functions (`supabase/functions/`)

### Shared Utilities (`_shared/`)

| File | Exports |
|------|---------|
| `base64url.ts` | `bytesToBase64Url(bytes)`, `base64UrlToBytes(value)`, `normalizeBase64Url(value)` |
| `env.ts` | `getEnv()` — loads/validates required env vars; `getAllowedOrigins(env)` — parses CORS allowlist |
| `http.ts` | `corsHeaders(origin)`, `jsonResponse(status, body, origin?)`, `errorResponse(status, message, origin?)`, `handlePreflight(req, allowedOrigins)`, `assertPost(req)`, `assertOrigin(req, allowedOrigins)`, `getCorsOriginIfAllowed(req, allowedOrigins)` |
| `jwt.ts` | `mintSupabaseJwt(env, claims, expiresInSeconds?)` — mints JWT with 24h default expiry |
| `supabaseAdmin.ts` | `createAdminClient(env)` — service-role Supabase client (no session persistence) |

### WebAuthn Endpoints

| Function | Method | Purpose |
|----------|--------|---------|
| `auth-webauthn-register-start` | POST | Generates registration options + stores challenge in DB (5min expiry) |
| `auth-webauthn-register-finish` | POST | Verifies credential attestation, creates auth user, stores credential, returns session tokens |
| `auth-webauthn-login-start` | POST | Generates authentication options + stores challenge in DB (5min expiry) |
| `auth-webauthn-login-finish` | POST | Verifies assertion against stored credential, updates counter, returns session tokens |

### Database Tables Used

| Table | Purpose |
|-------|---------|
| `entries` | Stores journal entries (id, user_id, title, transcript, recorded_at, created_at, updated_at) |
| `profiles` | User profiles (id, handle) |
| `webauthn_challenges` | Temporary challenge storage for WebAuthn ceremonies (deleted after use, 5min TTL) |
| `webauthn_credentials` | Stored passkey credentials (user_id, credential_id, public_key, counter, transports, last_used_at) |

---

## Data Flow

### 1. Registration Flow

```
LoginPage → useAuth.registerPasskey()
  │
  ├─ [1] POST auth-webauthn-register-start
  │       → Generates registration options
  │       → Stores challenge in webauthn_challenges
  │       ← Returns { options, challengeId }
  │
  ├─ [2] navigator.credentials.create(options)
  │       → Browser prompts user to create passkey
  │       ← Returns PublicKeyCredential
  │
  ├─ [3] POST auth-webauthn-register-finish
  │       → Verifies attestation against stored challenge
  │       → Creates user in auth.users
  │       → Stores credential in webauthn_credentials
  │       → Deletes challenge
  │       → Generates magic link → verifyOtp
  │       ← Returns { access_token, refresh_token }
  │
  └─ [4] supabase.auth.setSession(tokens)
         → Session stored in localStorage
         → onAuthStateChange fires → useAuth updates state
         → RequireAuth allows access → redirect to /app
```

### 2. Login Flow

```
LoginPage → useAuth.signInWithPasskey()
  │
  ├─ [1] POST auth-webauthn-login-start
  │       → Generates authentication options
  │       → Stores challenge in webauthn_challenges
  │       ← Returns { options, challengeId }
  │
  ├─ [2] navigator.credentials.get(options)
  │       → Browser prompts user to authenticate with passkey
  │       ← Returns PublicKeyCredential (assertion)
  │
  ├─ [3] POST auth-webauthn-login-finish
  │       → Verifies assertion against stored credential
  │       → Updates counter in webauthn_credentials
  │       → Deletes challenge
  │       → Generates magic link → verifyOtp
  │       ← Returns { access_token, refresh_token }
  │
  └─ [4] supabase.auth.setSession(tokens)
         → Same session flow as registration
```

### 3. Voice Recording Flow

```
AppHomePage
  │
  ├─ useAuth() ─────────── provides user/session
  ├─ useMyProfile() ────── fetches user handle
  ├─ useSpeechRecognition() ─── wraps Web Speech API
  ├─ useCreateEntry() ──── provides entry save function
  │
  └─ useHomeRecorder(user, speech, createEntry)
       │
       │  State machine: IDLE → RECORDING → SAVING → IDLE
       │
       ├─ [Click Record] (IDLE → RECORDING)
       │   → speech.start()
       │   → SpeechRecognition begins
       │   → Timer starts (1s interval)
       │   → interimTranscript/finalTranscript update live
       │
       ├─ [Click Stop] (RECORDING → SAVING)
       │   → speech.stop()
       │   → Validate transcript is non-empty
       │   → createEntry({ title, transcript, recorded_at })
       │   → supabase.from('entries').insert(...)
       │   → Show success notice (auto-hides after 3s)
       │   → State returns to IDLE
       │
       └─ [Error] → ERROR state
           → User clicks Retry → resets to IDLE
```

### 4. Entries View Flow

```
EntriesPage
  │
  ├─ useEntriesList()
  │   → entries.api.listEntries()
  │   → supabase.from('entries').select().order('recorded_at', desc).limit(100)
  │   ← Returns Entry[]
  │
  ├─ [Left Pane] EntriesList
  │   → Renders entry cards (timestamp + title)
  │   → Click entry → setSelectedEntryId(entry.id)
  │
  └─ [Right Pane] EntryEditor
      → Displays selected entry detail (timestamp, title, full transcript)
```

---

## Layer Architecture

```
┌─────────────────────────────────────────┐
│             Pages (UI composition)       │
│   LandingPage, LoginPage, AppHomePage,  │
│   EntriesPage                           │
├─────────────────────────────────────────┤
│           Components (presentation)      │
│   RecordButton, Timer, TranscriptView,  │
│   EntriesList, EntryEditor              │
├─────────────────────────────────────────┤
│         Hooks (orchestration)            │
│   useAuth, useEntries, useHomeRecorder, │
│   useMyProfile, useSpeechRecognition    │
├─────────────────────────────────────────┤
│          Data (API / infrastructure)     │
│   entries.api, profiles.api,            │
│   webauthnAuthRepository, supabaseClient│
├─────────────────────────────────────────┤
│      Types & Utils (domain / pure)       │
│   entry.ts, profile.ts, time.ts,        │
│   title.ts                              │
├─────────────────────────────────────────┤
│       Supabase Edge Functions (Deno)     │
│   WebAuthn ceremonies, JWT minting,     │
│   user creation, credential storage     │
├─────────────────────────────────────────┤
│           Supabase (PostgreSQL)          │
│   entries, profiles, webauthn_challenges,│
│   webauthn_credentials, auth.users      │
└─────────────────────────────────────────┘
```

**Data flows downward.** Pages compose components and call hooks. Hooks call data-layer functions. Data-layer functions call Supabase or edge function endpoints. Edge functions interact with the database.

---

## Error Handling Pattern

All data-layer functions return a discriminated union:

```typescript
type Result<T> = { data: T; error: null } | { data: null; error: Error };
```

- **Data layer:** validates inputs, wraps Supabase errors with context
- **Hooks:** check `error` field, set status/errorMessage state
- **Components/Pages:** render error messages or notices to the user
- **Edge functions:** return HTTP error responses; client maps them to Result errors
- **WebAuthn errors:** DOMException names mapped to user-friendly messages
- **Speech errors:** browser error codes mapped to readable messages

---

## Environment Variables

### Frontend (Vite)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### Edge Functions (Deno)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) |
| `SUPABASE_AUTH_JWT_SECRET` | JWT signing secret |
| `WEBAUTHN_RP_ID` | Relying Party ID (domain) |
| `WEBAUTHN_RP_NAME` | Relying Party display name |
| `WEBAUTHN_ORIGIN` | Allowed origin for WebAuthn |
| `WEBAUTHN_ORIGINS` | (Optional) Comma-separated allowed origins |
