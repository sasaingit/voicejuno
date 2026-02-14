# Supabase + React (TypeScript) Code Generation Guidelines

## 1. Follow the Existing Codebase

- Match the existing folder structure, naming conventions, import style, and export patterns.
- Prefer small, minimal diffs. Do not refactor unrelated code.
- Do not introduce new libraries unless explicitly requested.
- Follow the established architectural patterns used in nearby files.

---

## 2. Separation of Concerns

- **Presentational Components**
    - Rendering only (props in → UI out).
    - No Supabase calls.
    - No business logic beyond simple UI decisions.

- **Hooks (`useX`)**
    - Handle data fetching and mutations.
    - Manage loading, error, and success state.
    - Shape data for UI consumption.

- **Services / Repositories**
    - Contain Supabase queries only.
    - No React state.
    - Return typed results in a consistent format.

- **Utilities**
    - Pure functions only.
    - No side effects.

---

## 3. TypeScript Rules (Strict-Friendly)

- No `any`. Use `unknown` and narrow with type guards if necessary.
- Avoid unsafe casts.
- Explicitly type important boundaries (API responses, form inputs).
- Model async states with unions (e.g. `"idle" | "loading" | "success" | "error"`).
- Prefer clarity over clever type tricks.

---

## 4. Naming and Readability

- Use intent-revealing names:
    - `fetchInvoices`
    - `createProject`
    - `isLoading`
    - `handleSubmit`
- Functions must be small and single-purpose.
- Avoid deep nesting; extract helper functions.
- Comments are rare and explain **why**, not what.
- Prefer clear naming instead of explanatory comments.

---

## 5. Constants and No Magic Values

- No magic numbers or strings.
- Centralize constants (e.g., `ROUTES`, `ERROR_MESSAGES`, `PAGE_SIZE`).
- Prefer unions, enums, or constants instead of raw string values.
- Avoid scattered inline literals for statuses, roles, or types.

---

## 6. Supabase Best Practices

- Assume **Row Level Security (RLS) is enabled**.
- Never rely on client-side checks for authorization.
- Validate inputs before calling services.
- Avoid `select('*')` unless absolutely necessary.
- Select only required columns.
- Return a consistent result shape from services (e.g., `{ data, error }`).

---

## 7. Async and Error Handling

- Every async flow must handle:
    - Loading state
    - Error state
    - Success path
- Do not silently swallow errors.
- Normalize errors in the service layer.
- Map technical errors to user-friendly messages in the UI layer.
- Maintain consistent patterns across all hooks and services.

---

## 8. React Behavior Guidelines

- Avoid unnecessary `useEffect`.
- Prefer event-driven actions over lifecycle-driven effects.
- Keep rendering logic simple and predictable.
- Extract small components for:
    - Loading states
    - Error states
    - Empty states
- Only use `useMemo` or `useCallback` when there is a clear performance reason.

---

## 9. Output Expectations for Generated Code

- Produce complete, runnable code.
- Keep implementations concise and focused.
- Do not over-comment.
- Do not introduce architectural changes unless requested.
- If uncertain, follow the closest existing pattern in the codebase.
