# Phase 2 — Data Integrity & Resilience

> **Run with:** Sonnet 4.6 · Effort: medium · Thinking: off
> **Source audit:** `docs/AUDIT_REPORT.md` (§2, §3, §6, §9, §10)
> **Goal of this phase:** Stop data loss and corruption — durable uploads, clean shutdowns, reliable migrations, a crash-resistant UI, and idempotent financial writes.

---

## [TASK]

Eliminate the data-integrity and resilience gaps from the audit: attachments wiped on rebuild, killed in-flight requests on shutdown, manual/race-prone migrations, white-screening UI, an email-normalization bug that throws raw 500s, and duplicate financial mutations on double-submit. Make minimal, backward-compatible edits.

---

## [ISSUES TO FIX]

### 1. Named Docker volume for `server/uploads` — **High**
- **File:** `docker-compose.yml`.
- **Problem:** Only `postgres_data` is volumed; attachments are lost on every `docker compose up --build`.
- **Changes:**
  - Add a **named volume** (e.g. `uploads_data`) mounted at the container's uploads directory for the `api` service.
  - Declare it under the top-level `volumes:` key alongside `postgres_data`.
  - Confirm the mount path matches `uploadsDir` used by the server.

### 2. Graceful shutdown handler — **High**
- **File:** `server/index.js`.
- **Changes:**
  - Capture the `server` handle returned by `app.listen(...)`.
  - On `SIGTERM` and `SIGINT`: call `server.close()` (stop accepting new connections, drain in-flight), then `pool.end()` (drain the pg pool), then `process.exit(0)`.
  - Add a **timeout fallback** (e.g. force-exit after ~10s) so a hung connection can't block shutdown forever.
  - Log shutdown start/finish (plain `console` is acceptable here; structured logging arrives in Phase 3).

### 3. Auto-run migrations on deploy with advisory lock — **High**
- **Files:** `docker-compose.yml`, `server/db/migrate.js`, possibly a small entrypoint script.
- **Changes:**
  - Run migrations automatically on deploy — either an `api` container entrypoint step or a one-shot `migrate` service that `api` `depends_on`.
  - Guard with a **Postgres advisory lock** (`pg_advisory_lock` / `pg_try_advisory_lock`) in `migrate.js` so concurrent replicas don't race; release in a `finally`.
  - Keep the existing forward-only runner behavior; only wrap it with the lock + wire the deploy step. Do not change migration file contents.

### 4. React ErrorBoundary component — **High**
- **Files:** `client/src/components/ErrorBoundary.jsx` (new), `client/src/main.jsx`.
- **Changes:**
  - Add a **class-based** `ErrorBoundary` (React 19 still needs class components for `componentDidCatch` / `getDerivedStateFromError`).
  - Render the existing `ErrorState` component with a **"Reload"** action on caught errors.
  - Wrap `<App />` (or the router) in `main.jsx` with `<ErrorBoundary>`.

### 5. Email lowercase normalization before register lookup — **Medium**
- **File:** `server/routes/auth.js` (around line 36, the `findByEmail` call in register).
- **Changes:**
  - Lowercase + trim the email **before** the `findByEmail` duplicate check (mirror the login path which already normalizes).
  - In the central error handler, **catch pg error code `23505`** (unique violation) and map it to a clean **`409`** instead of a raw 500 — apply generically so other unique constraints benefit.

### 6. Idempotency guard on finance mutations — **Medium**
- **Files:** client `Create*Modal` / settle components under `client/src`, `server/routes/*finance*` (transactions + settle), a new migration under `server/db/migrations/`.
- **Changes:**
  - **Client:** disable submit buttons while a mutation is in flight (audit every finance `Create*Modal` and the settle action). Re-enable on success/error.
  - **Server/DB:** add a **`UNIQUE` (partial) index** on a natural key where one exists to reject duplicate ledger writes, OR accept an idempotency key on `POST /transactions` and `/settle` and enforce uniqueness. Choose the lighter approach that fits the existing schema; document the choice in a comment.
  - Add the index via a **new forward migration file** (do not edit existing migrations).

---

## [CONSTRAINTS]
- **Minimal edits** — only what each fix requires.
- **Backward-compatible** — preserve response envelopes, route names, and existing migration files (add new ones, don't rewrite).
- **Install any dependencies before use** and place them in the correct `package.json`.
- Add a **brief one-line comment** on each modified block (e.g. `// Phase 2: drain pool on SIGTERM`).
- Do not change finance math; only prevent duplicate writes.

## [DELIVERABLE]
After execution, output:
1. A **summary table** of every changed/created file with a one-line description.
2. The **diffs** for each change.
3. The **new migration filename(s)** and the index/constraint they add.
4. Manual verification steps (e.g. `docker compose up --build` and confirm attachments persist; SIGTERM drains cleanly).
