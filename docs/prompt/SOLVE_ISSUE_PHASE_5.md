# Phase 5 — Documentation, Observability & Future-Proofing

> **Run with:** Sonnet 4.6 · Effort: medium · Thinking: off
> **Source audit:** `docs/AUDIT_REPORT.md` (§1, §3, §8, §9, §10)
> **Goal of this phase:** Make the system observable in production and legible to a second engineer — error reporting, an API spec, recovery/architecture docs, project meta-files, and documented forward decisions.

---

## [TASK]

Add observability and the documentation/future-proofing layer: Sentry error reporting (client + server), generated OpenAPI spec, a runbook and architecture doc, standard project meta-files, an API-versioning decision, and documented migration plans for object storage and a user_settings table. Make minimal, backward-compatible edits. Several items below are **document-only** — do not implement them, only write the plan.

---

## [ISSUES TO FIX]

### 1. Sentry error reporting (client + server) — **High**
- **Files:** `server/index.js`, `client/src/main.jsx` (or entry), both `package.json` files.
- **Install:** `cd server && npm install @sentry/node` and `cd client && npm install @sentry/react`
- **Changes:**
  - Initialize Sentry on **both** sides, gated on a `SENTRY_DSN` env var (no-op when unset so dev/local is unaffected).
  - Server: capture unhandled errors in the central error handler; include the Phase 3 request ID as context.
  - Client: wrap the app (compose with the Phase 2 `ErrorBoundary`) so render-time throws are reported.
  - Document the `SENTRY_DSN` env var in `.env*.example` files.

### 2. OpenAPI spec generation (zod-to-openapi) — **Low**
- **Files:** `server/` spec-generation script + output `docs/API.md` or `docs/openapi.json`, `server/package.json`.
- **Install:** `cd server && npm install @asteasolutions/zod-to-openapi` (or `zod-to-openapi`).
- **Changes:**
  - Reuse the existing **zod schemas** on the routes to generate an OpenAPI 3.1 document.
  - Add an `npm run openapi` script that writes the spec to `docs/`.
  - Do not rewrite route handlers; only annotate/register schemas as the library requires.

### 3. `docs/RUNBOOK.md` — **Medium**
- **File:** `docs/RUNBOOK.md` (new).
- **Contents:**
  - **DB backup/restore** (`pg_dump` / `pg_restore`, referencing the Phase 3 backup sidecar).
  - **Migration rollback** (the runner is forward-only — document the manual SQL / `pg_dump`-snapshot-before-DROP procedure).
  - **Secret rotation** for `SESSION_SECRET` (note: rotating invalidates all sessions).
  - **Object storage migration plan for uploads** (see item 7) — include here.

### 4. `docs/ARCHITECTURE.md` (split from PROJECT_STATE.md) — **Low**
- **Files:** `docs/ARCHITECTURE.md` (new), `PROJECT_STATE.md` (trim/point to it).
- **Changes:**
  - Extract the durable architecture content (routes, models, tables, data flow) into `docs/ARCHITECTURE.md`.
  - Leave `PROJECT_STATE.md` as the living status doc and link to the architecture doc. Do not lose information — move, don't delete.

### 5. CHANGELOG.md, SECURITY.md, CONTRIBUTING.md — **Low**
- **Files:** `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md` (all new, repo root).
- **Changes:**
  - **CHANGELOG.md:** Keep-a-Changelog format; seed with an `Unreleased` section summarizing Phases 1–5.
  - **SECURITY.md:** how to report a vulnerability, supported versions, the hardening already in place.
  - **CONTRIBUTING.md:** setup, lint/test commands, branch/PR conventions, the CI gate from Phase 3.

### 6. API versioning (/api/v1) — decision — **Low**
- **Files:** `server/index.js` (if implementing) and/or `docs/ARCHITECTURE.md` (if documenting the decision).
- **Changes:**
  - **Either** introduce an `/api/v1` prefix (keeping `/api` working via alias for backward compatibility) **or** explicitly document the decision **not** to version yet, with the trigger that would change it. Pick the lower-risk option and state the rationale.

### 7. Object storage migration plan for uploads — **document only** — **High (planning)**
- **File:** `docs/RUNBOOK.md` (section).
- **Changes:**
  - Document the plan to move attachments from local disk to object storage (S3 / Cloudflare R2 — R2 pairs with the existing Cloudflare setup): why (multi-replica + durability), the migration steps, and the code touch-points. **Do not implement.**

### 8. `user_settings` table plan — **document only** — **Low (planning)**
- **File:** `docs/ARCHITECTURE.md` (section) or a `docs/PLANS.md`.
- **Changes:**
  - Document a proposed `user_settings` table (columns, FK to user, default-seeding strategy) to replace any hardcoded per-user config. **Do not create the table or migration.**

---

## [CONSTRAINTS]
- **Minimal edits** — only what each fix requires.
- **Backward-compatible** — Sentry must no-op without a DSN; any `/api/v1` change must keep `/api` working; docs must not delete existing information (move/link instead).
- **Install dependencies before use**, in the correct `package.json`.
- Add a **brief one-line comment** on each modified code block (e.g. `// Phase 5: report to Sentry only when DSN configured`).
- **Items 7 and 8 are document-only** — write the plan, change no runtime code or schema for them.

## [DELIVERABLE]
After execution, output:
1. A **summary table** of every changed/created file with a one-line description.
2. The **diffs** for each code change and the list of new doc files.
3. The generated OpenAPI artifact path and how to regenerate it.
4. Confirmation that Sentry no-ops without a DSN and that `/api` still resolves if versioning was added.
