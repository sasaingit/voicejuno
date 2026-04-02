# Voice Journal MVP — Junie Execution Plan (Source of Truth)

Owner: Sasanga  
Phase: 1 (personal use → validate → later publish)

Primary goal: **Super simple voice journaling** with Chrome SpeechRecognition transcription and saving transcripts to DB.

---

## Product Summary

### What this app is
A web app where an authenticated user can:
- Tap a large button to **start recording** (toggle ON)
- See **live transcription**
- Tap again to **stop** (toggle OFF)
- On stop, the app **auto-saves** an entry to the database
- View past entries in a split “Entries” screen and **edit** title + transcript

---

## Current implementation status (source of truth)

As of 2026-02-15, the repo has the following implemented:

- Routing exists with:
  - `/` (landing placeholder)
  - `/login`
  - `/app` (authenticated; currently a simple home page)
  - `/app/entries` (authenticated; placeholder)
- Supabase client wiring exists (`src/data/supabaseClient.ts`) with fail-fast env validation.
- Passkey/WebAuthn auth is implemented end-to-end via Supabase Edge Functions + a frontend hook:
  - Frontend uses `src/hooks/useAuth.ts` and `src/data/webauthnAuthRepository.ts`.
  - Backend Edge Functions live under `supabase/functions/auth-webauthn-*`.
  - The functions mint a **real Supabase Auth session** (access + refresh token), and the SPA applies it with `supabase.auth.setSession(...)`.
- Voice recording / SpeechRecognition journaling and entries CRUD UI are **not implemented yet** (pages are placeholders).

---

## Tech Stack (Locked)
- Frontend: **React** (Vite + TypeScript)
- Backend + Auth + DB: **Supabase**
- Database: **Postgres** (via Supabase)
- Browser constraint: **Chrome-first**

---

## Global constraints (apply to all tasks)

### Locked scope (Phase 1)
- **Passkey sign-in only** (WebAuthn; Supabase-backed session for RLS; no email/phone)
- **Chrome SpeechRecognition** transcription only (no audio storage)
- On **Stop** → **auto-save entry** (`title`, `transcript`, `recorded_at`)
- Entries screen: split view list + editor (title/transcript), save/delete
- **RLS required**: user only sees their own entries

### Required routes
- `/` (public landing placeholder)
- `/login`
- `/app` (authenticated home; recorder not implemented yet)
- `/app/entries` (authenticated; entries UI not implemented yet)

---

# Junie-ready Execution Plan (Task Breakdown — Source of Truth)

This section is the actionable work plan for junie

---

## Task 1 — Bootstrap project + routing skeleton

### Objective
Create a Vite + React + TypeScript app with routes:
- `/` (landing)
- `/login`
- `/app` (authenticated)
- `/app/entries` (authenticated)

### Steps
1. Create Vite React TS project.
2. Install dependencies:
    - `react-router-dom`
    - `@supabase/supabase-js`
3. Create files:
    - `src/app/routes.tsx` defines routes.
    - `src/app/routes.constants.ts` defines route paths.
    - `src/app/App.tsx` renders RouterProvider.
    - `src/pages/LoginPage.tsx`, `LandingPage.tsx`, `AppHomePage.tsx`, `EntriesPage.tsx`.
    - `src/styles/app.css` basic layout styles.

### Acceptance checklist
- App runs locally.
- Navigating to each route renders a page without crash.

---

## Task 2 — Supabase client wiring + environment contract

### Objective
Add Supabase client setup with env vars, and ensure build fails loudly if missing.

### Required env vars
Create `.env.local` with:
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

### Steps
1. Implement `src/data/supabaseClient.ts`:
    - Read env vars.
    - Throw an Error if missing.
    - Export `supabase`.

### Acceptance checklist
- App boots when vars exist.
- App errors clearly when vars missing.
 - In non-local builds, `VITE_SUPABASE_URL` is HTTPS (fail fast if not).

---

## Task 3 — Passkey Auth: WebAuthn + session hook (implemented)

### Objective
Implement passkey-based login/logout and session tracking (no OAuth providers).

### Core approach (source of truth)
- The app uses **WebAuthn passkeys** for user authentication.
- The backend verifies WebAuthn challenges and then mints a real **Supabase Auth session** so `auth.uid()` works with RLS.
- No email/phone/name is collected.
- A “user” is a **random UUID** tied to one or more **WebAuthn credential public keys**.

Implementation detail (current code): the backend creates a Supabase Auth user with a random `@passkey.local` email purely to satisfy Supabase Auth APIs. This is internal-only; the UI should not treat it as user-provided PII.

### Files to implement

#### `src/hooks/useAuth.ts`
Contract:
```ts
export type AuthState = {
  session: import("@supabase/supabase-js").Session | null;
  user: import("@supabase/supabase-js").User | null;
  loading: boolean;
  signInWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  signOut: () => Promise<void>;
};
```

Behavior (current implementation):
- On mount: reads current session and subscribes to auth state changes.
- WebAuthn support detection:
  - If not supported, show: “Passkeys are not supported in this browser. Please use Chrome.”
- `registerPasskey()`:
  1. `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-register-start`
     - Response: `{ options, challengeId }`
  2. `navigator.credentials.create({ publicKey: options })`
  3. `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-register-finish`
     - Body: `{ credential, challengeId }`
     - Response: `{ access_token, refresh_token }`
  4. Apply the session to Supabase client:
     - `supabase.auth.setSession({ access_token, refresh_token })`
- `signInWithPasskey()`:
  1. `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-login-start`
     - Response: `{ options, challengeId }`
  2. `navigator.credentials.get({ publicKey: options })`
  3. `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-login-finish`
     - Body: `{ credential, challengeId }`
     - Response: `{ access_token, refresh_token }`
  4. Apply the session via `supabase.auth.setSession({ access_token, refresh_token })`
- `signOut()` calls `supabase.auth.signOut()`.

Important implementation notes (current code):
- The hook performs base64url/ArrayBuffer transforms so WebAuthn options work in the browser.
- Edge Functions enforce:
  - `Origin` allowlist (`WEBAUTHN_ORIGIN`)
  - `rpID` (`WEBAUTHN_RP_ID`) + `rpName` (`WEBAUTHN_RP_NAME`)
  - `userVerification: 'required'`
- Edge Functions return a real Supabase session by doing a server-side OTP exchange (magic link) so refresh token rotation works in the SPA.

**Implementation rules**
- The frontend must **not** do any OAuth provider flows.
- The frontend stores no PII and sends no PII.
- If WebAuthn is not supported:
  - show a clear message: “Passkeys are not supported in this browser. Please use Chrome.”

Backend approach (short clarification):
- Preferred: use Supabase Auth’s native Passkeys if acceptable (lowest risk).
- If custom: implement the four WebAuthn endpoints as Supabase Edge Functions using `@simplewebauthn/*`, store credential IDs/public keys, and on successful verification mint a Supabase session server‑side (service role) and return it. Lock CORS/allowed origins to local + prod only.

#### `src/pages/LoginPage.tsx`
- If already logged in → redirect to `/app`
- Else show:
  - “Create passkey” button → calls `registerPasskey()`
  - “Sign in with passkey” button → calls `signInWithPasskey()`
- Show readable errors:
  - user cancelled
  - no passkey available
  - unsupported browser
  - network errors

### Acceptance checklist
- User can create a passkey and ends up signed in (session exists).
- Returning user can sign in via passkey and session persists on refresh.
- No Google provider required.

---

### What to do on the frontend (Edge Functions are already in-repo)

If the Supabase Edge Functions for WebAuthn are already deployed and returning a valid Supabase-compatible JWT, wire the frontend as follows. This keeps the app strictly passkey-based while enabling RLS via `auth.uid()`.

1) Call the deployed Edge Functions directly from the browser
- Endpoints (current):
  - `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-register-start`
  - `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-register-finish`
  - `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-login-start`
  - `POST https://<PROJECT>.functions.supabase.co/auth-webauthn-login-finish`
- Calls must originate from an allowed Origin that matches the function’s `WEBAUTHN_ORIGIN` config.

2) Registration flow (frontend)
- Start
```ts
const startRes = await fetch('https://<PROJECT>.functions.supabase.co/auth-webauthn-register-start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
});
const { options, challengeId } = await startRes.json();
```
- Create credential
```ts
// Some fields may need base64url→ArrayBuffer transforms depending on your function output
const credential = await navigator.credentials.create({ publicKey: options });
```
- Finish
```ts
const finishRes = await fetch('https://<PROJECT>.functions.supabase.co/auth-webauthn-register-finish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential, challengeId })
});
const { access_token, refresh_token, error } = await finishRes.json();
if (error) throw new Error(error.message);
```
- Apply the token to the Supabase client so RLS works
```ts
import { supabase } from '@/data/supabaseClient';

function applyAuthSession(accessToken: string, refreshToken: string) {
  // Let supabase-js persist the session and handle refresh token rotation
  supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

applyAuthSession(access_token, refresh_token);
```

3) Login flow (frontend)
- Start
```ts
const startRes = await fetch('https://<PROJECT>.functions.supabase.co/auth-webauthn-login-start', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
const { options, challengeId } = await startRes.json();
```
- Get assertion
```ts
const assertion = await navigator.credentials.get({ publicKey: options });
```
- Finish
```ts
const finishRes = await fetch('https://<PROJECT>.functions.supabase.co/auth-webauthn-login-finish', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential: assertion, challengeId })
});
const { access_token, refresh_token, error } = await finishRes.json();
if (error) throw new Error(error.message);
applyAuthSession(access_token, refresh_token);
```

4) Persisting/refreshing the token
- Rely on `supabase.auth.setSession({ access_token, refresh_token })` so supabase-js persists it and handles refresh token rotation.
- For silent re-auth on page load, consider `navigator.credentials.get({ publicKey: { ... , mediation: 'silent' } })` → call `login-finish` and reapply the fresh JWT.

5) Update `useAuth.ts`
- After successful `register-finish` or `login-finish`, call `supabase.auth.setSession({ access_token, refresh_token })`.
- `signOut()` should call `supabase.auth.signOut()` and clear any in-memory state.

6) Common pitfalls
- Exact origin match required: protocol, host, and port must match `WEBAUTHN_ORIGIN` or functions return 403.
- Credential JSON serialization: if you see type errors, base64url‑encode ArrayBuffers (`rawId`, `response.clientDataJSON`, `response.attestationObject`/`authenticatorData`/`signature`/`userHandle`) before `JSON.stringify`.
- When calling REST endpoints directly (not via Supabase client), include headers:
```ts
await fetch('https://<YOUR_PROJECT>.supabase.co/rest/v1/entries', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'apikey': '<public-anon-key>',
    'Authorization': `Bearer ${access_token}`,
  }
});
```

This wiring ensures your JWT has `role=authenticated` and a `sub` that maps to your user id, so Postgres RLS policies using `auth.uid()` will permit access to the correct rows.

---

## Task 4 — AuthGuard + App shell layout

### Objective
Prevent access to `/app` and `/app/entries` when signed out.

### Files to implement

#### `src/app/RequireAuth.tsx`
Behavior:
- If `useAuth().loading` → show minimal “Loading…”
- If no session → `<Navigate to="/login" replace />`
- Else render children

Notes (current code): redirect includes `state.from` with the attempted pathname.

#### `src/pages/AppHomePage.tsx`
Current state:
- Simple authenticated home page with:
  - Link to `/app/entries`
  - Logout button calling `signOut()`

The full “app shell layout” (top bar, etc.) is not implemented yet.

### Acceptance checklist
- Signed-out user cannot reach `/app` or `/app/entries`.
- Signed-in user sees top bar and can sign out.

Update for current implementation:
- Signed-in user can navigate to Entries and sign out.
- App shell/top bar is pending.

---

## WebAuthn tables (current database structure)

These tables exist in Supabase (per current code + dashboard schema screenshots). They are required for the Edge Functions under `supabase/functions/auth-webauthn-*`.

### `webauthn_challenges`
Columns:
- `id` (`uuid`, primary key)
- `challenge` (`text`, not null)
- `type` (`text`, not null) — expected values: `register` | `login`
- `user_id` (`uuid`, nullable) — currently unused by the Edge Functions
- `user_handle` (`text`, nullable) — used for registration ceremonies
- `created_at` (`timestamptz`)
- `expires_at` (`timestamptz`, not null)

### `webauthn_credentials`
Columns:
- `id` (`uuid`, primary key)
- `user_id` (`uuid`, not null) → `auth.users.id`
- `credential_id` (`text`, not null, unique)
- `public_key` (`text`, not null)
- `counter` (`int8`, not null)
- `transports` (`_text`, nullable)
- `created_at` (`timestamptz`)
- `last_used_at` (`timestamptz`)
- `aaguid` (`text`, nullable)
- `attestation_fmt` (`text`, nullable)

Note: RLS and permissions should be configured so these tables are not directly writable from the client; Edge Functions use the service role.

---

## Task 5 — Database schema + RLS migration script (SQL artifact)

### Objective
Produce a single SQL script file that creates the table + RLS policies.

Status: not implemented in this repo yet (no `supabase/migrations` folder currently present). When journaling entries CRUD is implemented, add migrations and RLS as a first-class artifact.

### File
Create `supabase/migrations/001_create_entries.sql` containing:
- table DDL
- index
- enable RLS
- policies (exactly as below)

```sql
create extension if not exists pgcrypto;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  transcript text not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_user_id_recorded_at_idx
  on public.entries (user_id, recorded_at desc);

alter table public.entries enable row level security;

create policy "entries_read_own"
on public.entries for select
using (user_id = auth.uid());

create policy "entries_insert_own"
on public.entries for insert
with check (user_id = auth.uid());

create policy "entries_update_own"
on public.entries for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "entries_delete_own"
on public.entries for delete
using (user_id = auth.uid());

-- Triggers to avoid sending user_id from the client and to maintain updated_at
create or replace function public.entries_set_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end; $$;

create or replace function public.entries_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_entries_set_user_id on public.entries;
create trigger trg_entries_set_user_id
  before insert on public.entries
  for each row execute function public.entries_set_user_id();

drop trigger if exists trg_entries_touch_updated_at on public.entries;
create trigger trg_entries_touch_updated_at
  before update on public.entries
  for each row execute function public.entries_touch_updated_at();
```

### Acceptance checklist
- SQL runs in Supabase SQL editor without errors.
- Table exists and RLS enabled.
 - Insert works without providing `user_id`; `updated_at` changes on update.

---

## Task 6 — Type definitions + entries API (Supabase queries)

### Objective
Implement typed CRUD operations.

### Files

#### `src/types/entry.ts`
Source of truth:
```ts
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
```

#### `src/data/entries.api.ts`
Functions (source of truth):
- `listEntries(): Promise<Entry[]>`
    - order by `recorded_at desc`, limit 100
- `createEntry(input: EntryCreate): Promise<Entry>`
- `updateEntry(id: string, patch: EntryPatch): Promise<Entry>`
- `deleteEntry(id: string): Promise<void>`

Rules:
- Do **not** pass `user_id` from client; rely on RLS and Supabase auth.
- On insert, include `recorded_at`, `title`, `transcript`.

### Acceptance checklist
- Functions compile and return typed results.
- Errors throw with readable messages.

---

## Task 7 — SpeechRecognition hook (Chrome) with final+interim transcript

### Objective
Implement Web Speech API integration with a clean API.

### File
`src/hooks/useSpeechRecognition.ts`

Contract (source of truth):
```ts
export type SpeechStatus = "idle" | "recording" | "error";

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
```

Implementation rules:
- Use `window.SpeechRecognition || window.webkitSpeechRecognition`
- Defaults:
    - `continuous = true`
    - `interimResults = true`
    - `lang = "en-AU"`
- Maintain:
    - `finalTranscript` (committed)
    - `interimTranscript` (live)
- Display string should be `finalTranscript + interimTranscript`
- On `onresult`:
    - append new finals to `finalTranscript`
    - set `interimTranscript` to current interim
- On `onerror`: set status `error` and store message
- On `stop()`:
    - stop recognition
    - do not auto-restart (keep MVP simple)

### Acceptance checklist
- In Chrome: transcripts appear while speaking.
- Unsupported browsers: `isSupported=false`.
 - Permission denied and auto‑stop cases surface readable errors.

---

## Task 8 — Landing page state machine + recording UI (no DB yet)

### Objective
Implement `/app` UI with correct states and controls, but stub saving.

### State machine (source of truth)
States:
- `SIGNED_OUT` (defensive)
- `IDLE`
- `RECORDING`
- `SAVING`
- `ERROR`

Transitions:
- `IDLE -> RECORDING` (tap record)
- `RECORDING -> SAVING` (tap stop)
- `SAVING -> IDLE` (save success)
- `SAVING -> ERROR` (save fail)
- `RECORDING -> ERROR` (recognition error)
- `ERROR -> IDLE` (retry)

### Files
- `src/pages/LandingPage.tsx`
- `src/components/recorder/RecordButton.tsx`
- `src/components/recorder/TranscriptView.tsx`
- `src/components/recorder/Timer.tsx`
- `src/utils/time.ts` (format helpers)

### UI requirements (source of truth)
- Record toggle button (big)
- During RECORDING:
    - button “red” style
    - timer visible
    - live transcript visible
- During SAVING:
    - record button disabled
    - show “Saving…”
- Unsupported browser:
    - disable record button
    - message: “Speech recognition not supported in this browser. Please use Chrome.”
- Privacy note shown:
    - “Transcription is performed using your browser’s speech recognition service.”

### Acceptance checklist
- Button toggles recording on/off and updates UI.
- Transcript clears when reset is invoked.
- Timer counts up while recording.

---

## Task 9 — Wire Landing page auto-save to DB (create entry on Stop)

### Objective
On stop: create entry in DB immediately, then return to idle.

### Save rules (source of truth)
On stop:
1. call `stop()` recognition
2. compute `transcript = (final + interim).trim()`
3. if transcript empty:
    - do **not** save
    - show message: “Nothing captured — entry not saved.”
    - return to IDLE
4. else:
    - `recorded_at = new Date().toISOString()`
    - `title = buildEntryTitle(recorded_at)` (Task 10)
    - `createEntry({ title, transcript, recorded_at })`
    - clear local transcripts and UI state to IDLE
    - on error: show error, return to IDLE (no duplicate saves)

### Files
- Update `src/pages/LandingPage.tsx` to call `createEntry`
- Add minimal message/toast area

### Acceptance checklist
- Speaking then stop creates a DB row.
- Stop with no transcript does not create a row and shows feedback.
- Record button disabled during saving (prevents double saves).

---

## Task 10 — Title and time utilities (single source of formatting)

### Objective
Centralize formatting for:
- Entry title generation
- Display timestamps in UI

### Files

#### `src/utils/title.ts`
Source-of-truth function:
```ts
export function buildEntryTitle(recordedAtIso: string): string
```
Output format:
- `Entry - 17 Dec 9:00am` (use Australia/Melbourne style; locale handling via JS)

#### `src/utils/time.ts`
Functions (source of truth):
- `formatEntryTimestamp(iso: string): string` → `17 Dec 9:00am`
- `formatTimer(seconds: number): string` → `mm:ss`
Implementation note: use `Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", ... })` to avoid host timezone drift.

### Acceptance checklist
- Title matches required example format.
- Timestamp display matches same style.

---

## Task 11 — Entries page split view: list + selectable editor (read-only first)

### Objective
Build `/app/entries` layout and list loading.

### Files
- `src/pages/EntriesPage.tsx`
- `src/components/entries/EntriesList.tsx`
- `src/components/entries/EntryEditor.tsx` (read-only initially)

### Behavior (source of truth)
- On page load: `listEntries()` and render newest-first
- Split layout:
    - Left: list items show `timestamp + title`
    - Right: selected entry details
- “X” button closes entries and navigates back to `/app`

### Acceptance checklist
- List loads and sorts newest first.
- Clicking list item selects and shows it.
- “X” returns to `/app`.

---

## Task 12 — Entry editing: update title/transcript + Save/Delete

### Objective
Make right panel editable and persist changes.

### Editor behavior (source of truth)
- Right panel fields:
    - Timestamp read-only
    - Title input (editable)
    - Transcript textarea (editable)
    - Save button → `updateEntry(id, {title, transcript})`
    - Delete button → `deleteEntry(id)` then:
        - remove from list
        - select next newest if exists, else clear selection
- Show saving state for Save/Delete buttons.

### Acceptance checklist
- Save persists edits after refresh.
- Delete removes entry from DB and UI.
- No crashes when deleting last entry.

---

## Task 13 — UX polish + error handling hardening

### Objective
Make the MVP stable for daily personal use.

### Required edge cases
- Recognition errors:
    - show readable error message
    - offer “Try again” that resets and returns to IDLE
- Supabase API errors:
    - show error banner in Landing / Entries
- Loading states:
    - Entries list shows spinner/loading message
- Avoid logging transcript in production:
    - no `console.log(transcript)` in final code

Standard error copy (keep short and consistent):
- Auth: “Passkeys not supported in this browser.” / “No passkey found for this account.” / “You canceled the request.”
- Speech: “Microphone permission denied.” / “Recognition stopped unexpectedly.”
- Network/API: “Network error — please try again.” / “Save failed — try again.”

### Acceptance checklist
- Failures show actionable messages and recovery paths.
- App remains usable after an error without refresh.

---

## Task 14 — Minimal styling pass (no design system required)

### Objective
Make UI clean and predictable with minimal CSS (or Tailwind if preferred—pick one and keep consistent).

### Must-have UI clarity
- Record button visually dominant and clearly toggles state
- Transcript area readable
- Entries split view stable sizing
- Buttons have disabled states

### Acceptance checklist
- MVP is comfortable to use daily on desktop Chrome.

---

## Supabase dashboard configuration (manual steps to document in README)

Add a README section with:
- Create Supabase project
- **No OAuth providers required**
- Configure and deploy backend WebAuthn endpoints:
  - `POST /auth/webauthn/register/start`
  - `POST /auth/webauthn/register/finish`
  - `POST /auth/webauthn/login/start`
  - `POST /auth/webauthn/login/finish`
- Set redirect URLs:
    - local dev (e.g. `http://localhost:5173/login`)
    - production URL (placeholder)
- Run migration SQL (Task 5)
- Add `.env.local`

Also ensure:
- Allowed origins/CORS configured for local + production only.
- Local HTTPS for WebAuthn if required by your setup (or rely on Chrome’s localhost allowances for passkeys).
- `pgcrypto` enabled (for `gen_random_uuid()`), as in migration.

Backend must enforce WebAuthn RP parameters:
- `rpId` (domain)
- `rpName`
- `origin` allowlist for local + prod
spec