# Task 3B — Backend Passkey Auth (WebAuthn) using Supabase Edge Functions

Owner: Junie  
Phase: 1 MVP  
Status: Not started

---

## Objective

Implement **passkey-only authentication** using **WebAuthn** on Supabase, backed by **Edge Functions**, and return a **Supabase-compatible JWT** so that:

- `auth.uid()` works
- Row Level Security (RLS) works
- No email, phone, or PII is collected
- Frontend can authenticate using **passkeys only**

This task implements **only the backend** required by Task 3 in the Voice Journal MVP spec.

---

## High-level architecture

- WebAuthn flows are implemented manually using Edge Functions
- Credential verification uses `@simplewebauthn/server`
- Passkey credentials are stored in Postgres
- On successful registration or login:
  - A Supabase Auth user is created (synthetic email)
  - A JWT is minted and returned to the frontend
- The frontend uses this JWT as a Bearer token

---

## Endpoints to implement

All endpoints are implemented as **separate Supabase Edge Functions** and are called directly via `/functions/v1/<function-name>`.

| Function name | HTTP route |
|--------------|------------|
| `auth-webauthn-register-start` | `POST /functions/v1/auth-webauthn-register-start` |
| `auth-webauthn-register-finish` | `POST /functions/v1/auth-webauthn-register-finish` |
| `auth-webauthn-login-start` | `POST /functions/v1/auth-webauthn-login-start` |
| `auth-webauthn-login-finish` | `POST /functions/v1/auth-webauthn-login-finish` |

-------|-------|
| `POST /auth/webauthn/register/start` | Start passkey registration |
| `POST /auth/webauthn/register/finish` | Finish registration + create user |
| `POST /auth/webauthn/login/start` | Start passkey login |
| `POST /auth/webauthn/login/finish` | Finish login + issue session |

---

## Step 1 — Database schema (DONE)

> ✅ **Already completed** — migration has been successfully run in Supabase.

---

## Step 2 — Configure secrets

Set the following **Edge Function secrets** (names must match Supabase dashboard exactly):

| Name | Description |
|----|----|
| `URL` | Supabase project URL |
| `SERVICE_ROLE_KEY` | Supabase service role key |
| `JWT_SECRET` | Supabase JWT signing secret |
| `WEBAUTHN_RP_ID` | WebAuthn RP ID |
| `WEBAUTHN_ORIGIN` | Allowed frontend origin |
| `WEBAUTHN_RP_NAME` | Display name |

### Acceptance
- Secrets readable in Edge Functions
- No secrets exposed to frontend

---

## Step 3 — Register start endpoint

### Function
```
auth-webauthn-register-start
```

### Route
```
POST /auth/webauthn/register/start
```

### Input
```json
{}
```

### Logic
- Generate random challenge (base64url)
- Store challenge in `webauthn_challenges`
  - `type = 'register'`
  - `expires_at = now() + 5 minutes`
- Return `PublicKeyCredentialCreationOptionsJSON`

### WebAuthn options
- `rp.id = WEBAUTHN_RP_ID`
- `rp.name = WEBAUTHN_RP_NAME`
- `user.id = random bytes`
- `authenticatorSelection.residentKey = "required"`
- `authenticatorSelection.userVerification = "required"`
- `attestation = "none"`
- `pubKeyCredParams = ES256`

### Output
```json
{ "options": {...}, "challengeId": "uuid" }
```

### Acceptance
- Browser can call `navigator.credentials.create()` successfully

---

## Step 4 — Register finish endpoint

### Function
```
auth-webauthn-register-finish
```

### Route
```
POST /auth/webauthn/register/finish
```

### Input
```json
{ "credential": {...}, "challengeId": "uuid" }
```

### Logic
- Load challenge
- Reject if expired or wrong type
- Verify attestation using `@simplewebauthn/server`
- Create Supabase Auth user (synthetic email)
  - `<uuid>@passkey.local`
- Store credential in `webauthn_credentials`
- Mint JWT signed with `SUPABASE_JWT_SECRET`
  - `sub = user_id`
  - `role = authenticated`
  - `aud = authenticated`
- Return JWT

### Output
```json
{ "access_token": "...", "token_type": "bearer", "expires_in": 86400 }
```

### Acceptance
- Returned token works with RLS (`auth.uid()` matches)

---

## Step 5 — Login start endpoint

### Function
```
auth-webauthn-login-start
```

### Route
```
POST /auth/webauthn/login/start
```

### Logic
- Generate challenge
- Store in `webauthn_challenges` with type `login`
- Return `PublicKeyCredentialRequestOptionsJSON`

### Output
```json
{ "options": {...}, "challengeId": "uuid" }
```

### Acceptance
- Browser can call `navigator.credentials.get()`

---

## Step 6 — Login finish endpoint

### Function
```
auth-webauthn-login-finish
```

### Route
```
POST /auth/webauthn/login/finish
```

### Logic
- Load challenge
- Find credential by `credentialId`
- Verify assertion via `@simplewebauthn/server`
- Update counter + `last_used_at`
- Mint JWT (same as register finish)

### Output
```json
{ "access_token": "...", "token_type": "bearer", "expires_in": 86400 }
```

### Acceptance
- Returning user can login and access RLS tables

---

## Step 7 — Security requirements

- Enforce `Origin === WEBAUTHN_ORIGIN`
- Allow `POST` only
- Handle CORS preflight
- Reject expired challenges
- Never expose service role or JWT secret

---

## Step 8 — Manual test checklist

1. Register start → browser creates passkey
2. Register finish → JWT returned
3. Use JWT to insert/select `entries`
4. Logout → login start → login finish
5. Same user id reused

---

## Definition of Done

- Passkey registration works
- Passkey login works
- JWT authenticates Supabase RLS
- No email/phone/OAuth used
- Ready for frontend Task 3 integration

