# Phase 4 — Testing & Code Quality

> **Run with:** Sonnet 4.6 · Effort: medium · Thinking: off
> **Source audit:** `docs/AUDIT_REPORT.md` (§7, §2, §6)
> **Goal of this phase:** Replace blind refactoring with a real safety net — a test suite over the riskiest logic, zero-warning lint, env validation, and lean Docker builds.

---

## [TASK]

Establish automated testing and tighten code quality: a vitest + supertest suite covering auth, finance math, ownership scoping, settle atomicity, and the upload filter; a markdown-sanitization test; zero ESLint warnings in CI; client-side env validation; and `.dockerignore` files. Make minimal, backward-compatible edits.

---

## [ISSUES TO FIX]

### 1. Establish a test suite (vitest + supertest) — **Critical**
- **Files:** `server/package.json` (replace the `test` script that currently `exit 1`), new `server/test/` (or `__tests__/`) files, a `vitest.config` if needed.
- **Install:** `cd server && npm install -D vitest supertest`
- **Required coverage (model layer first — highest ROI):**
  - **Auth flow:** register → login → session; duplicate-email returns 409; wrong password fails cleanly.
  - **Finance balance/summary math:** verify the centralized balance computation against known inputs.
  - **Ownership scoping:** assert **user A cannot read/modify user B's rows** across the per-user tables.
  - **Settle transaction atomicity:** a failure mid-settle leaves no partial ledger state.
  - **Upload file-type rejection:** multer ext/MIME allowlist rejects a disallowed file.
- **Notes:** Use a test DB or transaction-rollback fixtures; do not point tests at production data. Wire `npm test` to run vitest. Ensure the Phase 3 CI `test` step now executes these.

### 2. Fix ESLint errors — zero warnings in CI — **Medium**
- **Files:** affected components under `client/src` (the `set-state-in-effect`, unused-import, and `useMemo` deps offenders), `client/package.json` lint script.
- **Changes:**
  - Fix `set-state-in-effect` cases (most are `useApi` patterns — move the state set into the hook's effect, not the component body) to avoid render loops / double-fetches.
  - Remove unused imports; fix `useMemo`/`useEffect` dependency arrays.
  - Make `npm run lint` run with **`--max-warnings 0`** so CI fails on any warning.

### 3. Markdown sanitization test — **High**
- **Files:** new test under `client/src` (e.g. `MarkdownEditor.test.jsx`), client test runner config.
- **Install (if not present):** `cd client && npm install -D vitest @testing-library/react jsdom`
- **Changes:**
  - Render markdown content containing `<img src=x onerror=alert(1)>` (and a `<script>` payload) through the `MarkdownPreview` and assert the dangerous HTML is **stripped/inert** (confirms Phase 1's `rehype-sanitize` holds).
  - Wire this test into CI so a regression in sanitization fails the build.

### 4. Client-side env validation — **Medium**
- **File:** `client/src/lib/api.js` (around line 15, the `VITE_API_URL` fallback).
- **Changes:**
  - At module load, **throw in production builds** if the var is missing: `if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) throw new Error(...)`.
  - Keep the `http://localhost:3000` fallback for **dev only**.

### 5. Add `.dockerignore` to client and server — **Medium**
- **Files:** `client/.dockerignore` (new), `server/.dockerignore` (new).
- **Changes:**
  - Exclude `node_modules`, build output (`dist`), `.env*`, `.git`, logs, test/coverage artifacts, and OS cruft from the Docker build context to shrink images and avoid leaking secrets.

---

## [CONSTRAINTS]
- **Minimal edits** — only what each fix requires; fixing lint should not restyle unrelated code.
- **Backward-compatible** — tests must not mutate real data; env change preserves dev behavior.
- **Install dependencies before use** (as devDependencies where appropriate), in the correct `package.json`.
- Add a **brief one-line comment** on each modified block (e.g. `// Phase 4: fail fast if API URL missing in prod`).
- Prefer testing the **model layer** over routes where it gives more coverage per test.

## [DELIVERABLE]
After execution, output:
1. A **summary table** of every changed/created file with a one-line description.
2. The **diffs** for each change.
3. The **test run output** (`npm test` for server and client) showing passing tests and counts.
4. Confirmation `npm run lint --max-warnings 0` passes for the client.
