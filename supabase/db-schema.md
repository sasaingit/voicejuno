# Database Schema (Supabase)

## Identity Model

The app uses an **account-based identity model**. Each person is an `account`. Each passkey registration creates an `auth.users` record (a device login identity), which maps to exactly one account via `account_users`. Multiple devices can be linked to the same account using a 6-digit code.

## Tables

---

### accounts

One row per person. Holds the shared identity.

| Column     | Type        | Nullable | Default           | Constraints      |
| ---------- | ----------- | -------- | ----------------- | ---------------- |
| id         | uuid        | NO       | gen_random_uuid() | PRIMARY KEY      |
| handle     | text        | NO       |                   | UNIQUE           |
| created_at | timestamptz | NO       | now()             |                  |
| updated_at | timestamptz | NO       | now()             |                  |

**RLS:** SELECT/UPDATE for users who belong to this account (via `account_users`).

---

### account_users

Maps many `auth.users` (device identities) to one account.

| Column     | Type        | Nullable | Default | Constraints                              |
| ---------- | ----------- | -------- | ------- | ---------------------------------------- |
| account_id | uuid        | NO       |         | FK → accounts(id) ON DELETE CASCADE      |
| user_id    | uuid        | NO       |         | FK → auth.users(id) ON DELETE CASCADE, UNIQUE |
| created_at | timestamptz | NO       | now()   |                                          |

**Primary Key:** (account_id, user_id)
**Unique:** (user_id) — one user belongs to exactly one account.
**RLS:** SELECT where `user_id = auth.uid()`.

---

### account_link_codes

Temporary 6-digit codes for linking a second device to an existing account.

| Column              | Type        | Nullable | Default           | Constraints                         |
| ------------------- | ----------- | -------- | ----------------- | ----------------------------------- |
| id                  | uuid        | NO       | gen_random_uuid() | PRIMARY KEY                         |
| issuer_account_id   | uuid        | NO       |                   | FK → accounts(id) ON DELETE CASCADE |
| issuer_user_id      | uuid        | NO       |                   | FK → auth.users(id) ON DELETE CASCADE |
| code_hash           | text        | NO       |                   |                                     |
| expires_at          | timestamptz | NO       |                   |                                     |
| redeemed_at         | timestamptz | YES      |                   |                                     |
| redeemed_by_user_id | uuid        | YES      |                   | FK → auth.users(id)                 |
| created_at          | timestamptz | NO       | now()             |                                     |

**RLS:** None (only accessed by edge functions via service role).

---

### entries

Journal entries, scoped to account (shared across devices).

| Column             | Type        | Nullable | Default           | Constraints                    |
| ------------------ | ----------- | -------- | ----------------- | ------------------------------ |
| id                 | uuid        | NO       | gen_random_uuid() | PRIMARY KEY                    |
| account_id         | uuid        | NO       | my_account_id()   | FK → accounts(id)              |
| created_by_user_id | uuid        | YES      | auth.uid()        | FK → auth.users(id)            |
| title              | text        | NO       |                   |                                |
| transcript         | text        | NO       |                   |                                |
| recorded_at        | timestamptz | NO       | now()             |                                |
| created_at         | timestamptz | NO       | now()             |                                |
| updated_at         | timestamptz | NO       | now()             |                                |

**RLS:** SELECT/INSERT/UPDATE/DELETE for users whose account matches `entries.account_id` (via `account_users`).

**Triggers:**
- `trg_entries_touch_updated_at` — sets `updated_at = now()` before UPDATE.

**Notes:**
- `account_id` defaults to `my_account_id()` — a SQL function that resolves the caller's account from `account_users`.
- `created_by_user_id` defaults to `auth.uid()` — tracks which device created the entry.

---

### webauthn_challenges

Temporary challenge storage for WebAuthn ceremonies. Rows are deleted after use.

| Column      | Type        | Nullable | Default           | Constraints |
| ----------- | ----------- | -------- | ----------------- | ----------- |
| id          | uuid        | NO       | gen_random_uuid() | PRIMARY KEY |
| challenge   | text        | NO       |                   |             |
| type        | text        | NO       |                   | CHECK: 'register' or 'login' |
| user_id     | uuid        | YES      |                   |             |
| created_at  | timestamptz | NO       | now()             |             |
| expires_at  | timestamptz | NO       |                   |             |
| user_handle | text        | YES      |                   |             |

**RLS:** Disabled (only accessed by edge functions via service role).

---

### webauthn_credentials

Stored passkey credentials. Scoped to `auth.users` (device-level, not account-level).

| Column          | Type        | Nullable | Default           | Constraints                         |
| --------------- | ----------- | -------- | ----------------- | ----------------------------------- |
| id              | uuid        | NO       | gen_random_uuid() | PRIMARY KEY                         |
| user_id         | uuid        | NO       |                   | FK → auth.users(id)                 |
| credential_id   | text        | NO       |                   | UNIQUE                              |
| public_key      | text        | NO       |                   |                                     |
| counter         | bigint      | NO       | 0                 |                                     |
| transports      | text[]      | YES      |                   |                                     |
| created_at      | timestamptz | NO       | now()             |                                     |
| last_used_at    | timestamptz | YES      |                   |                                     |
| aaguid          | text        | YES      |                   |                                     |
| attestation_fmt | text        | YES      |                   |                                     |

**RLS:** Disabled (only accessed by edge functions via service role).

---

## Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `my_account_id()` | uuid | Returns the caller's account_id from `account_users`. Used as column default on `entries.account_id`. `SECURITY DEFINER`, `STABLE`. |
| `generate_memorable_handle()` | text | Generates a random `adjective-noun-XXXX` handle. Called via RPC during registration. |
| `entries_touch_updated_at()` | trigger | Sets `updated_at = now()` on entry updates. |

---

## Global Notes

* All timestamps are `timestamptz` (UTC).
* IDs use `uuid` with `gen_random_uuid()` default.
* `accounts` is the person-level identity; `auth.users` are device-level identities.
* Passkeys (`webauthn_credentials`) are scoped to `auth.users`, not accounts.
* App data (`entries`) is scoped to `accounts`, not `auth.users`.
* Account linking merges the redeemer's entries into the issuer's account and deletes the redeemer's old account.
