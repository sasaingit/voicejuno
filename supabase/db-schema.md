# Database Schema (Supabase)

## Tables

---

### entries

| Column      | Type        | Nullable | Default           | Constraints |
| ----------- | ----------- | -------- | ----------------- | ----------- |
| id          | uuid        | NO       | gen_random_uuid() | PRIMARY KEY |
| user_id     | uuid        | NO       |                   |             |
| title       | text        | NO       |                   |             |
| transcript  | text        | NO       |                   |             |
| recorded_at | timestamptz | NO       | now()             |             |
| created_at  | timestamptz | NO       | now()             |             |
| updated_at  | timestamptz | NO       | now()             |             |

**Relationships**

* user_id → profiles.id *(assumed — verify FK)*

---

### profiles

| Column     | Type        | Nullable | Default | Constraints |
| ---------- | ----------- | -------- | ------- | ----------- |
| id         | uuid        | NO       |         | PRIMARY KEY |
| handle     | text        | NO       |         |             |
| created_at | timestamptz | NO       | now()   |             |
| updated_at | timestamptz | NO       | now()   |             |

**Relationships**

* (none)

---

### webauthn_challenges

| Column      | Type        | Nullable | Default           | Constraints |
| ----------- | ----------- | -------- | ----------------- | ----------- |
| id          | uuid        | NO       | gen_random_uuid() | PRIMARY KEY |
| challenge   | text        | NO       |                   |             |
| type        | text        | NO       |                   |             |
| user_id     | uuid        | YES      |                   |             |
| created_at  | timestamptz | NO       | now()             |             |
| expires_at  | timestamptz | NO       |                   |             |
| user_handle | text        | YES      |                   |             |

**Relationships**

* user_id → profiles.id *(assumed)*

---

### webauthn_credentials

| Column          | Type        | Nullable | Default           | Constraints |
| --------------- | ----------- | -------- | ----------------- | ----------- |
| id              | uuid        | NO       | gen_random_uuid() | PRIMARY KEY |
| user_id         | uuid        | NO       |                   |             |
| credential_id   | text        | NO       |                   |             |
| public_key      | text        | NO       |                   |             |
| counter         | bigint      | NO       | 0                 |             |
| transports      | ARRAY       | YES      |                   |             |
| created_at      | timestamptz | NO       | now()             |             |
| last_used_at    | timestamptz | YES      |                   |             |
| aaguid          | text        | YES      |                   |             |
| attestation_fmt | text        | YES      |                   |             |

**Relationships**

* user_id → profiles.id *(assumed)*

---

## Global Notes (for AI agents)

* All timestamps are `timestamptz` (UTC)
* IDs use `uuid`
* `gen_random_uuid()` is used for primary keys
* `*_id` fields typically reference another table
* `created_at` / `updated_at` follow standard audit pattern
* Some foreign keys are inferred — verify constraints if needed

---

## Known Issues (from introspection)

* Duplicate `id` columns appeared in raw output (fixed here)
* Foreign key constraints were not explicitly returned by query
* Array type (`transports`) lacks element type detail

---
