# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Phase 11 — Frontend Optimization: Lazy-load Research, Vendor-split Editor, Duplicate-Transfer Error (2026-06-10)

#### Fixed
- **`Research` page loaded eagerly, inflating the main bundle (§2)** — `Research` was imported at the top of `App.jsx` alongside the non-lazy pages, which pulled `CreateResearchModal` → `EntryDetailModal` → `MarkdownEditor` → `@uiw/react-md-editor` into the main `index-*.js` chunk on every page load. `Research` is now `React.lazy`-loaded and its `/research` route is wrapped in `<Suspense fallback={<PageFallback />}>` (identical pattern to the Engineering routes). The `PageFallback` skeleton renders inside `<AppLayout>`'s `<Outlet />` so the sidebar stays mounted during chunk download.
- **`@uiw/react-md-editor` and `prism-react-renderer` not vendor-split (§2)** — `client/vite.config.js` had no `build.rollupOptions.output.manualChunks`. Both heavy packages now land in their own cacheable chunks (`mdeditor-*.js`, `prism-*.js`) via a function-based `manualChunks` (required by Vite 8 / rolldown). The main `index-*.js` drops from ~304 kB to ~243 kB; `mdeditor-*.js` is ~1,060 kB (cached after first visit to `/research` or `/engineer/docs`); `prism-*.js` is ~85 kB.
- **Inaccurate App.jsx comment claimed Engineering was the only md-editor consumer (§2)** — the comment said Engineering routes "are the only routes that pull in the heavy `@uiw/react-md-editor`", which was false (Research also uses it). Rewritten to name both Engineering and Research as code-split routes and to note the Phase 11 Research lazy-load.
- **Generic 409 for duplicate Transfer blocks legitimate re-submissions (§4-NEW/§3)** — `idx_transactions_transfer_dedup` can reject a second genuinely-intended identical Transfer (same day, accounts, amount, blank description) with the same generic "A record with this value already exists." message as every other `23505`. `errorHandler.js` now branches on `err.constraint === 'idx_transactions_transfer_dedup'` before the generic fallback and returns `{ code: 'DUPLICATE_TRANSFER', message: 'This looks like a duplicate transfer … add or change the description to record it as a separate transfer.', field: 'description' }`. All other unique-constraint violations keep the existing generic `CONFLICT` path.

### Phase 10 — Integration Test Suite: Real-DB Tests, Real Multer Filter, De-brittle Settle Test (2026-06-10)

#### Added
- **Real-Postgres integration suite (`server/test/integration/`)** — three new test files exercise the riskiest DB guarantees that the mocked unit tests cannot verify:
  - `isolation.int.test.js` — user A cannot read user B's transaction (`getTransactionById` returns `null` when queried with a foreign `user_id`).
  - `settle.int.test.js` — a `settleLedger` call that receives a non-owned account ID rolls back completely; the receivable row stays `outstanding` with `settled_at = null`.
  - `constraints.int.test.js` — a zero-amount `INSERT` on `transactions` fires `23514` (`transactions_amount_nonzero` CHECK); a duplicate Transfer `INSERT` fires `23505` on `idx_transactions_transfer_dedup`.
  - `db.setup.js` — shared harness: runs `db/migrate.js` once via `execFileSync`, creates a `pg.Pool`, and provides `makeUser`/`cleanupUsers` helpers. All suites are wrapped in `describe.skipIf(!hasDb)` so `npm test` remains green on any machine without `DATABASE_URL`.
- **`npm run test:integration`** script (`"vitest run test/integration"`) for running only the integration suite.

#### Fixed
- **`upload.filter.test.js` tested a copy, not the shipped filter (§7)** — the test re-declared `ALLOWED_EXT`, `ALLOWED_MIME`, and a fresh `multer({…})` instead of importing from `research.js`. A regression in the real filter would not have failed the test. Fix: `research.js` now exports `researchFileFilter` (and the two allowlist Sets); the test imports and mounts the real function with `multer.memoryStorage()` so no disk writes occur. All six assertion cases are retained.
- **`settle.atomicity.test.js` brittle positional mock chain (§7)** — the three tests chained `mockResolvedValueOnce` in the exact query-call order; any reordering of equally-correct SQL would desync the chain without a real defect. Replaced with `mockImplementation` that branches on SQL content (`/FROM receivables/i`, `'BEGIN'`, `'COMMIT'`, etc.) so the mock is order-independent. Outcome assertions (`ROLLBACK` present, `COMMIT` absent/present, `result.status`) are unchanged.

### Phase 9 — DevOps: Client Sentry Docker, Env Parameterization, Server Lint, CI Postgres (2026-06-10)

#### Fixed
- **Client Sentry dead in Docker (§6-N1)** — `client/Dockerfile` now accepts `ARG VITE_SENTRY_DSN` (empty default → no-op without config) and exposes it as an `ENV` so `main.jsx`'s `Sentry.init` guard actually compiles the DSN into the bundle when one is provided. `docker-compose.yml` passes it as a build arg via the long-form `build.args` block. `client/nginx.docker.conf` CSP `connect-src` extended with `https://*.ingest.sentry.io` so the browser can POST events when the DSN is set. `SECURITY.md` client error-reporting row updated to state the build-arg requirement.
- **Hardcoded `CLIENT_ORIGIN` and `VITE_API_URL` (§6)** — `docker-compose.yml` api service `CLIENT_ORIGIN` is now `${CLIENT_ORIGIN:-https://raflitriwijaya.my.id}`, and the nginx build uses `${VITE_API_URL:-https://raflitriwijaya.my.id}` as a build arg. Both vars documented in `.env.docker.example`. Staging or any other domain is now a `.env` change only — no tracked-file edits required.
- **Server linting silently skipped in CI (§6/§7)** — `server/package.json` gains a `"lint": "eslint . --max-warnings 0"` script backed by a new `server/eslint.config.js` (ESLint 9 flat config, Node ESM + vitest globals). Five pre-existing lint errors fixed: unused import of `getLedgerById`/`getPortfolioById` in `finances.js`; unused `USER_B` in `ownership.test.js`; unused `beforeEach` import in `upload.filter.test.js`; useless post-increment of `i` in `engineer.model.js`. CI server job Lint step drops `--if-present` — lint now fails the build on errors.
- **No Postgres in server CI (§6/§7)** — server CI job gains a `postgres:16-alpine` service with healthcheck; `DATABASE_URL`, `SESSION_SECRET`, `CLIENT_ORIGIN`, and `NODE_ENV` are set at job level; a "Migrate test DB" step (`npm run migrate`) runs before the test suite so the Phase 10 integration suite can use a fully-migrated schema. Existing mocked unit tests are unaffected.
- **Stray `hehe.md` in repo root (§1)** — raw audit-prompt file moved to `docs/prompt/AUDIT_PROMPT_ARCHIVE.md` alongside the existing phase-solve prompts; repo root is clean.

---

### Phase 8 — Backend Resilience: Export Cap, Pre-Upload Ownership, Host-Independent Delete, Strict Month/Year (2026-06-10)

#### Fixed
- **Export memory unbounded (§3)** — `/api/research/export` previously requested up to 100,000 rows and `JSON.stringify(rows, null, 2)`'d the whole result set into memory. Now capped at `EXPORT_MAX = 10000`; if `total > EXPORT_MAX` the endpoint returns `413 PAYLOAD_TOO_LARGE` with a message instructing the user to narrow filters. JSON export drops the `null, 2` pretty-print (halves payload + heap). CSV path shares the same cap via the 413 guard.
- **Disk-churn DoS on upload to non-owned entry (§3/§9)** — `POST /api/research/:id/attachments` previously ran multer (writing bytes to disk) before verifying entry ownership. A flood of POSTs to a foreign `:id` would churn `server/uploads/` and silently swallow cleanup errors. Fix: a new `requireOwnedEntry` middleware (mirrors the existing `requireOwnedProject` pattern in `engineer.js`) now runs *before* `upload.single('file')`, so unauthorized callers are rejected before multer opens a file handle. The entry is stashed on `req.ownedEntry` to avoid a second DB query in the handler. Any post-write cleanup (rare insert failure) is now `await`ed via `fs.promises.rm` and logs on failure rather than being swallowed.
- **Attachment DELETE trusts stored absolute `file_path` (§4)** — the `DELETE /api/research/attachments/:id` handler called `fs.rm(attachment.file_path, …)`, trusting the stored absolute path. The download route had already been fixed to reconstruct from `path.join(uploadsDir, attachment.filename)`. DELETE now does the same — host/mount-independent. Removal is `await`ed via `fs.promises.rm` and logs on failure. `attachment.file_path` is no longer read anywhere in `research.js`.
- **`?month=13` silently returns all-time data (§9)** — `parseMonthYear` in `finances.js` previously returned `{}` (all-time) for any present-but-invalid month/year (out-of-range, missing partner, non-integer), making `GET /api/finances?month=13` look like a successful filter. Now distinguishes absent (→ `{}`, all-time, unchanged) from present-but-invalid (→ throws `AppError(400, VALIDATION_ERROR)`). The three model functions that accept month/year (`listTransactions`, `getSummary`, `listBudgets`) now call a new `assertMonthYear` guard at entry so a direct caller passing `month: 13` gets a clean 400 instead of a `make_date` 500.

---

### Phase 7 — Data Durability & Secret Hygiene (2026-06-10)

#### Fixed
- **Data loss guard on `002_finance_upgrade.sql` (§4)** — inserted a `DO $$ … RAISE EXCEPTION` block immediately before the `DROP TABLE` cascade. If `transactions` already exists and contains rows the migration aborts loudly with a row count and a pointer to the runbook, so an accidental re-run (cleared `schema_migrations`, manual invocation, partial restore) cannot wipe the ledger. Fresh installs pass through (`to_regclass` returns `NULL` when the table is absent). Intentional resets still work via `TRUNCATE transactions` first.
- **Single-host backup risk (§6)** — extended the `db_backup` sidecar to optionally push each nightly dump to S3 / Cloudflare R2 after writing it locally. Conditional on `BACKUP_S3_BUCKET`; with that var absent behaviour is identical to before (local-only). `--endpoint-url` makes it work against R2 as well as AWS S3. Five new optional `BACKUP_S3_*` vars documented in `.env.docker.example`.
- **Dev secrets treated as compromised (§8)** — added explicit "generate fresh, never reuse dev" warnings to both `.env.docker.example` and `server/.env.example`; extended `docs/RUNBOOK.md §3` with the exact `openssl rand` commands and the rule that the dev `SESSION_SECRET`/DB password must never be promoted to production.

#### Added
- **`docs/RUNBOOK.md §1a`** — "Off-host backups & monthly restore drill": how to verify both local and off-host copies, and a step-by-step monthly restore procedure against a throwaway Postgres container.

---

### Phase 6 — Rate-Limit Self-Lockout Fix (2026-06-10)

#### Fixed
- **Critical: `/api/auth/me` self-lockout (§3-N1)** — `GET /api/auth/me` and `POST /api/auth/logout` were mounted behind `authLimiter` (5 req / 15 min / IP) along with `login` and `register`. Because `useAuth()` calls `/me` on every protected-route mount, six page loads / refreshes / open tabs in 15 minutes triggered a `429` self-lockout. Fix: `authLimiter` is now applied only to `/api/auth/login` and `/api/auth/register` via path-specific `app.use` mounts registered before the router; the router itself runs under `generalLimiter` (100/min), so `/me` and `/logout` are no longer counted against the credential-guessing budget.
- **Critical: `429` cascade to `/login` (§5/§8/§9)** — a `429` from the axios interceptor previously fell through to the generic error path, which caused `useAuth` to return `user: null` and `AuthGuard` to redirect to `/login` — which is on the same exhausted limiter, deepening the lockout. Fix: the interceptor now has an explicit `429` branch that surfaces the server's "slow down" message without redirecting; the rejected `Error` carries `err.status`; `useAuth` exposes a `throttled` flag (`error?.status === 429`); `AuthGuard` shows the loading skeleton (not a redirect) when `throttled` is true.

---

### Phase 5 — Documentation, Observability & Future-Proofing (2026-06-10)

#### Added
- **Sentry error reporting** — `@sentry/node` on the server (captures unhandled exceptions; attaches `reqId` tag; gated on `SENTRY_DSN` env var); `@sentry/react` on the client (initializes before render; composed with the existing `ErrorBoundary`; gated on `VITE_SENTRY_DSN`).
- **OpenAPI 3.1 spec** — `server/scripts/generate-openapi.js` uses `@asteasolutions/zod-to-openapi` to derive a spec from existing Zod schemas; `npm run openapi` (from `server/`) writes to `docs/openapi.json`.
- **`docs/RUNBOOK.md`** — DB backup/restore (`pg_dump` / `pg_restore`), migration rollback procedure, `SESSION_SECRET` rotation, object storage migration plan (disk → Cloudflare R2), and common incident runbooks.
- **`docs/ARCHITECTURE.md`** — Durable architecture reference: stack, data flow, full route map, complete DB schema table, middleware stack order, and design decisions (API versioning, session vs JWT, attachment storage). Includes the `user_settings` table plan and the API versioning decision.
- **`CHANGELOG.md`**, **`SECURITY.md`**, **`CONTRIBUTING.md`** — standard project meta-files.
- `SENTRY_DSN` / `VITE_SENTRY_DSN` documented in all three `.env*.example` files.

#### Changed
- `PROJECT_STATE.md` — added pointer to `docs/ARCHITECTURE.md` and `docs/RUNBOOK.md`; living status content retained.

---

### Phase 4 — Operational Hardening (2026-06-09)

- `bcrypt` → `bcryptjs` (pure JS; eliminates `tar`/`node-pre-gyp` high-severity transitive vulns).
- CI pipeline (`.github/workflows/ci.yml`): parallel server + client jobs; `npm audit --audit-level=high`; lint; build; test.
- Structured logging: `server/lib/logger.js` (pino); `pino-http` assigns `req.id`; `errorHandler` echoes `reqId` in responses.
- Docker healthchecks for `api` and `nginx` containers; nginx `depends_on: service_healthy`.
- Nginx security + cache headers in `client/nginx.docker.conf`.
- `db_backup` sidecar: daily `pg_dump` → `postgres_backups` named volume.

---

### Phase 3 — Data Integrity & Resilience (2026-06-09)

- Named Docker volume `uploads_data` — attachments survive `docker compose up --build`.
- Graceful shutdown — `SIGTERM`/`SIGINT` drain HTTP connections → pg pool → exit 0; 10 s force-exit fallback.
- Auto-run migrations on deploy (`migrate.js && index.js`); advisory lock prevents race on rolling deploys.
- React `ErrorBoundary` wraps `<App />` — render crashes show `ErrorState` instead of white screen.
- Email lowercase normalization on register; pg `23505` → `409 CONFLICT` in error handler.
- Migration `005_idempotency_guards.sql`: `CHECK (amount <> 0)` + partial UNIQUE index on Transfer rows.

---

### Phase 2 — Security Hardening (2026-06-10)

- `express-rate-limit` (`authLimiter` 5/15 min; `generalLimiter` 100/min).
- `helmet` (CSP, HSTS in prod, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- Authenticated attachment downloads — removed public `/uploads/` static mount; new `GET /api/research/attachments/:id/download` route (auth + ownership).
- `rehype-sanitize` applied to markdown editor live preview and `MarkdownPreview`.
- `crypto.randomUUID()` filenames for uploads (replaces `Date.now()`-based names).

---

### Phase 1 — Research Upgrade (2026-06-02)

- Migration `004_research_topics.sql`: `research_topics`, `research_entry_topics` pivot, `research_attachments`, `research_entries.is_pinned`.
- Full-text search, tag filters, date-range filter, topic sidebar, bulk actions (archive/delete), entry detail modal, export (JSON/CSV), pin/duplicate/copy-citation controls.

---

### Initial Deployment (2026-06-01)

- Docker + Docker Compose (nginx → api → db), manual Nginx + PM2 configs, Cloudflare Tunnel.
- README rewritten in English.

---

### Audit & Foundation (2026-05-31)

- Full audit/hardening pass: created missing `components/ui/*`, hooks (`useApi`, `useTheme`, `useToast`), `server/lib/*`, `errorHandler`, `validate` middleware.
- Fixed broken config: `index.css` Tailwind directives, `index.html` Inter font, `postcss.config.js`, Vite port/proxy, missing client/server deps.
- Corrected bugs: router named-export mismatch, Dashboard stat-key mismatches, duplicate `AppLayout.jsx`.
- Added `express.json({ limit: '1mb' })`, session `sameSite: 'lax'`, pg pool sizing.
