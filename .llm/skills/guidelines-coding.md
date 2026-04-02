# Coding Guidelines

This is a React + TypeScript web application for voice journaling, powered by Supabase (database, auth, edge functions) and the Web Speech API.

Prefer patterns suited to React hooks, component composition, async data operations, browser APIs, and Supabase edge functions (Deno).

Follow clean architecture principles where practical, while keeping implementation simple and pragmatic.

Write self-documenting code. Keep comments only if required. Prefer readability and consistency over cleverness.

## Follow the Existing Codebase

- Match the existing folder structure, naming conventions, import style, and export patterns.
- Prefer small, minimal diffs. Do not refactor unrelated code.
- Do not introduce new libraries unless explicitly requested.

## Output Expectations

- Produce complete, runnable code.
- Keep implementations concise and focused.
- Avoid architectural changes unless explicitly requested.

## Skills

- [Naming](guidelines-naming.md) — action verbs, domain terms, constants, hook conventions
- [Functions & Control Flow](guidelines-functions.md) — small/pure functions, early returns, no hidden side effects
- [Types & Immutability](guidelines-types.md) — domain types, generics, readonly, type-only imports
- [Error Handling](guidelines-errors.md) — Result pattern, fail fast, validate boundaries, readable errors
- [Architecture & Separation](guidelines-architecture.md) — layer separation, hooks as orchestration, data layer isolation
