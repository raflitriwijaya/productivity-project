# Production Readiness Audit V2 — Rafli's Productivity Suite

**Auditor:** Senior Full-Stack Architect / SRE
**Date:** 2026-06-10
**Repository:** `productivity-project` (React 19 + Vite + Tailwind / Node 22 + Express 5 / PostgreSQL 16)
**Scope:** End-to-end re-audit after the 5 remediation phases that followed [AUDIT_REPORT_V1.md](AUDIT_REPORT_V1.md).
**Method:** Read every route, model, migration, middleware, config, and test. Ran the real quality gates — `npm audit`, `npm test`, `npm run lint`, `npm run build` — on both packages; findings below cite measured results, not assumptions.

---

## Executive Summary

This is a **materially different codebase from the one V1 audited.** The five "SOLVE ISSUE" phases closed almost every Critical and High item from V1, and I verified the closures by execution rather than inspection alone:

- **`npm audit` → `found 0 vulnerabilities`** on both client and server (the `bcrypt`→`bcryptjs` swap eliminated the `tar`/`node-pre-gyp` advisories).
- **Server tests: 24 passed (5 files).** Client tests: 5 passed (1 file). Both suites green.
- **Client lint: clean** under `eslint . --max-warnings 0`.
- **Client build: clean**, main chunk **304 KB / 96 KB gzip** (down from V1's reported ~1.4 MB), with the engineering pages and `prism-react-renderer` code-split out.
- `helmet` + CSP, `express-rate-limit`, graceful shutdown, structured `pino` logging with request IDs, Sentry hooks, an authenticated+ownership-gated attachment route with UUID filenames, `rehype-sanitize`, a React `ErrorBoundary`, a CI pipeline, auto-migrate-on-deploy with an advisory lock, a `pg_dump` backup sidecar, named volumes, OpenAPI spec, ARCHITECTURE/RUNBOOK/CHANGELOG/CONTRIBUTING/SECURITY docs — all present and wired.

The work is real and the core engineering remains excellent (parameterized SQL everywhere, `user_id` scoping on every query, atomic `FOR UPDATE` settle, correct money math).

**However, the remediation introduced one genuine availability regression and left several V1 items only partially fixed.** The headline new bug: **`GET /api/auth/me` — the session heartbeat the SPA calls on every protected-route mount — is mounted behind the 5-requests-per-15-minutes auth brute-force limiter.** A normal user who refreshes or opens tabs more than five times in a quarter-hour gets a `429`, which is not a `401`, so the client never refreshes the session — it bounces them to `/login`, which is *also* on the same exhausted limiter. The result is a self-inflicted 15-minute lockout. This must be fixed before any real use.

Other open items: `002_finance_upgrade.sql` still `DROP`s `transactions` with no populated-table guard (a re-run data-loss bomb); `/export` still loads up to 100,000 rows and pretty-prints them in memory; uploads still hit disk before the ownership check; the attachment `DELETE` path still trusts a host-coupled absolute path; client Sentry is effectively dead in the Docker deploy (env not passed as a build arg *and* would be CSP-blocked); and the test suite, while present and passing, is entirely DB-mocked — no integration test ever touches a real Postgres, and one test re-implements the code it claims to cover.

**Verdict:** **Production-ready for its stated single-user scope once the `/me` limiter bug is fixed** — that one change is the gate. The remaining items are real but are Medium/Low hardening, not blockers. Overall score rises from **6.4 → 7.5**.

---

## Section Scores

| # | Section | V1 | V2 | Δ |
|---|---------|----|----|---|
| 1 | Project Planning & Documentation | 8.5 | 9.0 | ▲ |
| 2 | Frontend (React + Vite + Tailwind) | 7.0 | 7.5 | ▲ |
| 3 | Backend (Node.js + Express) | 7.5 | 7.5 | ◆ |
| 4 | Database (PostgreSQL) | 7.0 | 7.5 | ▲ |
| 5 | UI/UX Consistency | 7.5 | 7.5 | ◆ |
| 6 | DevOps & Deployment | 6.0 | 7.5 | ▲ |
| 7 | Code Quality & Maintainability | 7.0 | 7.5 | ▲ |
| 8 | Security Deep-Dive | 5.5 | 8.0 | ▲▲ |
| 9 | Edge Cases & Resilience | 5.0 | 6.5 | ▲ |
| 10 | Long-Term Scalability & Roadmap | 5.5 | 6.5 | ▲ |
| | **Overall (weighted)** | **6.4** | **7.5** | ▲ |

Weighting (unchanged from V1 for comparability): Security ×2, Backend ×1.5, Database ×1.5, Resilience ×1.5, DevOps ×1.25, others ×1.

---

## V1 → V2 Remediation Ledger (verified)

| V1 Item | Priority | Status | Evidence |
|---------|----------|--------|----------|
| No rate limiting | Critical | ✅ Fixed (but see §3-N1) | `authLimiter`/`generalLimiter` in [index.js](../server/index.js#L127) |
| No `helmet`/CSP | Critical | ✅ Fixed | [index.js:113](../server/index.js#L113); nginx headers [nginx.docker.conf:9](../client/nginx.docker.conf#L9) |
| Public `/uploads` dir | Critical | ✅ Fixed | static mount removed; auth+ownership route [research.js:348](../server/routes/research.js#L348) |
| Zero tests | Critical | ✅ Fixed (shallow — §7) | 24 server + 5 client tests pass |
| `tar`/`bcrypt` vuln | High | ✅ Fixed | `bcryptjs`; `npm audit` = 0 vulns |
| Markdown XSS | High | ✅ Fixed | `rehype-sanitize` [MarkdownEditor.jsx:30,47](../client/src/components/engineer/MarkdownEditor.jsx#L30) |
| No React error boundary | High | ✅ Fixed | [ErrorBoundary.jsx](../client/src/components/ErrorBoundary.jsx) wraps `<App/>` |
| Uploads wiped on rebuild | High | ✅ Fixed | `uploads_data` named volume [docker-compose.yml:79](../docker-compose.yml#L79) |
| No graceful shutdown | High | ✅ Fixed | SIGTERM/SIGINT handler [index.js:190](../server/index.js#L190) |
| No CI/CD | High | ✅ Fixed | [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| No DB backups | High | ⚠️ Partial | `db_backup` sidecar — but on-host volume (§6) |
| No observability | High | ⚠️ Partial | `pino`+Sentry server-side; client Sentry dead in Docker (§6-N) |
| Migrations manual on deploy | High | ✅ Fixed | `CMD` runs migrate first [server/Dockerfile:8](../server/Dockerfile#L8) + advisory lock |
| `002` drops populated table | High | ❌ Open | no guard in [002_finance_upgrade.sql:30](../server/db/migrations/002_finance_upgrade.sql#L30) |
| No structured logging | High | ✅ Fixed | `pino`/`pino-http`, `reqId` in envelope |
| Register email not lowercased | Medium | ✅ Fixed | [auth.js:36](../server/routes/auth.js#L36) |
| pg `23505` → raw 500 | Medium | ✅ Fixed | mapped to 409 [errorHandler.js:11](../server/middleware/errorHandler.js#L11) |
| No money CHECK constraints | Medium | ✅ Mostly | `amount <> 0`, `>0` on recv/pay, `>=0` on portfolio/budgets |
| Unbounded `/export` | Medium | ❌ Open | still `per_page: 100000` [research.js:209](../server/routes/research.js#L209) |
| Upload before ownership check | Medium | ❌ Open | disk write precedes check [research.js:514](../server/routes/research.js#L514) |
| Attachment absolute path | Medium | ⚠️ Partial | download fixed; DELETE still uses `file_path` [research.js:387](../server/routes/research.js#L387) |
| `CLIENT_ORIGIN` hardcoded | Medium | ❌ Open | [docker-compose.yml:21](../docker-compose.yml#L21) |
| No client env fail-fast | Medium | ✅ Fixed | [api.js:15](../client/src/lib/api.js#L15) |
| Double-submit on mutations | Medium | ✅ Fixed | buttons disabled while submitting (verified across modals) |
| Bundle > 1.4 MB | Medium | ⚠️ Partial | 304 KB main, but md-editor still in main chunk (§2-N) |
| ESLint debt shipped | Medium | ✅ Fixed (client) | `--max-warnings 0` passes; **server has no lint script** (§7) |
| migrate diagnostic re-run outside txn | Low | ❌ Open | [migrate.js:137](../server/db/migrate.js#L137) |
| Missing CHANGELOG/API/CONTRIBUTING | Low | ✅ Fixed | all present + `openapi.json` (14 paths) |

---

## 1. Project Planning & Documentation — 9.0 / 10

The strongest area, now stronger. `PROJECT_STATE.md` remains the exhaustive living spec, and the V1 documentation gaps are closed: `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`, a generated `docs/openapi.json` (14 paths, 1,261 lines), `CHANGELOG.md`, `CONTRIBUTING.md`, and `SECURITY.md` all exist and are substantive. The RUNBOOK covers backup/restore, migration rollback, secret rotation, the R2 migration plan, and an incident playbook keyed on `reqId`.

- **Issue**: `hehe.md` in the repo root is the raw audit *prompt* ("[TASK] You are a Senior Full-Stack Software Architect…") committed as a tracked file. It is noise that will confuse any contributor and pollutes the repo root.
  - **Recommendation**: `git rm hehe.md`. If a prompt archive is wanted, move it under `docs/prompt/` alongside the existing `SOLVE_ISSUE_PHASE_*.md` files.
  - **Priority**: Low

- **Issue**: `SECURITY.md` advertises controls that are not actually live in the shipped Docker deploy — e.g. it lists client-side "Error reporting: Sentry initialized before render", but `VITE_SENTRY_DSN` is never passed into the client image build (§6-N1). Documentation that overstates the security posture is itself a risk.
  - **Recommendation**: Either wire the control (§6-N1) or annotate it as "requires build-arg configuration; disabled by default." Keep `SECURITY.md` claims in lockstep with the actual `docker-compose.yml`/`Dockerfile` reality.
  - **Priority**: Medium

- **Issue**: Two parallel sources of truth now exist — the 55 KB `PROJECT_STATE.md` and `docs/ARCHITECTURE.md` — with overlapping content. Drift is inevitable.
  - **Recommendation**: Make `ARCHITECTURE.md` canonical for architecture and demote `PROJECT_STATE.md` to a changelog-style phase log (or fold it into `CHANGELOG.md`).
  - **Priority**: Low

---

## 2. Frontend (React + Vite + Tailwind CSS) — 7.5 / 10

Real improvements: a class-based `ErrorBoundary` wraps `<App/>` ([main.jsx:22](../client/src/main.jsx#L22)), `rehype-sanitize` is applied to both the editor preview and the read-only `MarkdownPreview`, production builds fail fast when `VITE_API_URL` is missing ([api.js:15](../client/src/lib/api.js#L15)), mutation buttons disable during submit, and the engineering routes are `React.lazy`-loaded. Lint is clean at zero warnings.

- **Issue**: **`@uiw/react-md-editor` still ships in the main bundle.** App.jsx comments that the Engineering routes "are the only routes that pull in the heavy `@uiw/react-md-editor`" ([App.jsx:21-24](../client/src/App.jsx#L21)), but `Research` is imported **eagerly** ([App.jsx:16](../client/src/App.jsx#L16)) and pulls the editor via `CreateResearchModal` and `EntryDetailModal`. The lazy `EngineerDocs` chunk is only 7 KB — proof the editor is already resident in the 304 KB main chunk. The lazy-loading therefore buys nothing for the editor; the comment is factually wrong.
  - **Recommendation**: `React.lazy()` the `Research` page (or, more surgically, lazy-load the two markdown modals behind `<Suspense>`). Add `build.rollupOptions.output.manualChunks` to vendor-split `@uiw/react-md-editor`. Then correct the App.jsx comment.
    ```js
    // vite.config.js
    build: { rollupOptions: { output: { manualChunks: {
      mdeditor: ['@uiw/react-md-editor'],
      prism: ['prism-react-renderer'],
    } } } }
    ```
  - **Priority**: Medium

- **Issue**: **No automated visual/e2e coverage.** The only client test is `MarkdownSanitization.test.jsx`. The V1 "never browser-verified" concern across Phases 2–5 (mobile tab strip, hover actions, dark mode, modals, date pickers) is unaddressed — build + unit pass ≠ working UI.
  - **Recommendation**: Add Playwright smoke tests for login → dashboard, create transaction, create research entry, upload+download attachment, in both light and dark. Run them in CI against the Docker compose stack.
  - **Priority**: Medium

- **Issue**: **No accessibility audit.** Icon-only buttons in `AttachmentList` do carry `aria-label`s (good), but there is no evidence of modal focus-trapping/restore, keyboard nav for the bulk-select bar, or an axe/Lighthouse pass.
  - **Recommendation**: Verify `Modal` traps focus and restores it on close; run axe-core in the Playwright suite.
  - **Priority**: Medium

- **Issue**: **`useApi` blanket-suppresses `react-hooks/exhaustive-deps` and `react-hooks/use-memo`** ([useApi.js:29](../client/src/hooks/useApi.js#L29)) and several modals suppress `set-state-in-effect` ([CreateTransactionModal.jsx:65](../client/src/components/finance/CreateTransactionModal.jsx#L65)). The suppressions are reasoned, but they mean the lint "clean" status is partly achieved by disabling the rules that catch the riskiest React bugs.
  - **Recommendation**: Acceptable as-is, but document the invariant (callers must pass a literal deps array to `useApi`) and consider a custom lint rule rather than a blanket disable so genuinely-wrong deps still error.
  - **Priority**: Low

---

## 3. Backend (Node.js + Express) — 7.5 / 10

The backend gained `helmet`+CSP, two rate limiters, graceful shutdown with pool draining, structured `pino` logging with auto request IDs surfaced in the error envelope, Sentry capture, and a clean `23505`→409 mapping. The error handler masks 500s correctly. Held flat at 7.5 purely because the rate-limiting fix introduced a real availability bug.

- **Issue (NEW — N1)**: **`GET /api/auth/me` is throttled by the brute-force limiter, locking out normal users.** `app.use('/api/auth', authLimiter, authRouter)` ([index.js:160](../server/index.js#L160)) places the *entire* auth router — including `/me` and `/logout` — under `authLimiter` (5 req / 15 min / IP, [index.js:127](../server/index.js#L127)). But `useAuth()` calls `/api/auth/me` on **every** protected-route mount ([useAuth.js:18](../client/src/hooks/useAuth.js#L18) → `AuthGuard`). Six page loads / refreshes / tabs in 15 minutes ⇒ `429`. The axios interceptor only special-cases `401` ([api.js:34](../client/src/lib/api.js#L34)), so a `429` is surfaced as a generic error; `useAuth` returns `user: null`; `AuthGuard` redirects to `/login` — which is on the **same exhausted limiter** — and each login attempt also consumes the budget. Net effect: a self-inflicted 15-minute lockout for an ordinary usage pattern.
  - **Recommendation**: Apply the strict limiter only to the credential endpoints, not the whole router. Move `/me` and `/logout` under `generalLimiter`:
    ```js
    // index.js — limit only the brute-forceable verbs
    app.use('/api/auth/login',    authLimiter);
    app.use('/api/auth/register', authLimiter);
    app.use('/api/auth', generalLimiter, authRouter); // /me, /logout, and the above routers
    ```
    (Mount order: register the two path-specific limiters before the router.) Also handle `429` in the api.js interceptor so it surfaces a "slow down" toast rather than silently nulling the session.
  - **Priority**: **Critical**

- **Issue**: **`/export` still streams up to 100,000 rows into memory and `JSON.stringify(rows, null, 2)`'s them** ([research.js:209-215](../server/routes/research.js#L209)). A large account, or a few concurrent exports, can pin the API container's heap. The general limiter (100/min) does not stop a single expensive request.
  - **Recommendation**: Cap at a sane maximum (e.g. 10,000) and return `413` past it, or stream with a DB cursor (`pg-query-stream`) and write CSV/NDJSON incrementally. Drop the `null, 2` pretty-print for exports.
  - **Priority**: Medium (High if any account grows large)

- **Issue**: **Multer writes the upload to disk before ownership is verified** ([research.js:514-532](../server/routes/research.js#L514)). The file lands on disk, *then* `getResearchEntryById` checks ownership, *then* an orphan is `fs.rm`'d via a fire-and-forget callback whose errors are swallowed. A flood of POSTs to a non-owned `:id` churns the disk and can partially fill it; cleanup is best-effort.
  - **Recommendation**: Verify entry ownership in a middleware that runs **before** `upload.single('file')`, so unauthorized requests never touch disk. Make the cleanup `await fs.promises.rm(...)` and log failures.
  - **Priority**: Medium

- **Issue**: **CORS `allowedHeaders: ['Content-Type']`** ([index.js:70](../server/index.js#L70)) silently blocks any future custom header (idempotency key, CSRF token).
  - **Recommendation**: Note the constraint in code; widen deliberately when adding headers.
  - **Priority**: Low

- **Issue**: **Body parsing runs before rate limiting** (parsers at [index.js:74](../server/index.js#L74), limiters mounted per-route after). A burst of 1 MB bodies is parsed before the limiter can reject it.
  - **Recommendation**: Minor; the 1 MB cap bounds the damage. If desired, move `generalLimiter` to a global `app.use` ahead of the body parsers (keeping the auth-specific limiter per-route).
  - **Priority**: Low

---

## 4. Database (PostgreSQL) — 7.5 / 10

Schema design remains sound. Phase 2 added the requested integrity work: `CHECK (amount <> 0)` on transactions, `CHECK (amount > 0)` on receivables/payables, `CHECK (quantity/avg_price/current_price >= 0)` on portfolio, `CHECK (amount >= 0)` on budgets, and a migration advisory lock so concurrent replicas can't double-apply.

- **Issue**: **`002_finance_upgrade.sql` still `DROP TABLE … transactions CASCADE` with no populated-table guard** ([002_finance_upgrade.sql:30](../server/db/migrations/002_finance_upgrade.sql#L30)). The runner records applied migrations, so a normal flow won't re-run it — but the file is `IF EXISTS`/re-runnable by design, and any operator who clears `schema_migrations`, restores a partial DB, or runs it manually obliterates the ledger. The RUNBOOK documents a *manual* pre-snapshot, but the migration itself has no safety rail. This is the single largest data-loss risk in the repo.
  - **Recommendation**: Add a guard that refuses to drop a populated table:
    ```sql
    DO $$ BEGIN
      IF to_regclass('public.transactions') IS NOT NULL
         AND (SELECT count(*) FROM transactions) > 0 THEN
        RAISE EXCEPTION 'refusing to drop populated transactions table';
      END IF;
    END $$;
    ```
  - **Priority**: High

- **Issue (NEW)**: **The transfer-dedup unique index can reject legitimate duplicate transfers.** `idx_transactions_transfer_dedup` ([005_idempotency_guards.sql:27](../server/db/migrations/005_idempotency_guards.sql#L27)) is `UNIQUE (user_id, date, amount, source_account_id, dest_account_id, description) WHERE type='Transfer'`. Two genuinely separate identical transfers on the same day (same accounts, same amount, blank description) collide → `23505` → the generic 409 "A record with this value already exists." The user cannot make the second legitimate transfer and gets a misleading message.
  - **Recommendation**: Either accept the trade-off and give it a specific error message (catch `23505` with `constraint === 'idx_transactions_transfer_dedup'` and return "Looks like a duplicate transfer — change the description or confirm"), or replace the structural dedup with a client-supplied idempotency key so true duplicates are still allowed.
  - **Priority**: Medium

- **Issue**: **`research_attachments.file_path` still stores an absolute disk path**, and the attachment `DELETE` handler trusts it directly: `fs.rm(attachment.file_path, …)` ([research.js:387](../server/routes/research.js#L387)). The *download* route was correctly fixed to reconstruct the path from `uploadsDir + filename` ([research.js:359](../server/routes/research.js#L359)), but DELETE was not — so the two paths are inconsistent and DELETE breaks on any host/mount migration.
  - **Recommendation**: Store only `filename`; reconstruct in DELETE exactly as the download route does (`path.join(uploadsDir, attachment.filename)`). Backfill existing rows.
  - **Priority**: Medium

- **Issue**: **Migrations remain forward-only with no `down` step.** Documented in the RUNBOOK, but rollback is still hand-written compensating SQL.
  - **Recommendation**: Adopt `node-pg-migrate`/`dbmate` when convenient; meanwhile keep the pre-DROP snapshot discipline.
  - **Priority**: Low

- **Issue**: **Pool size `max: 10` is hardcoded** ([db.js:27](../server/lib/db.js#L27)).
  - **Recommendation**: `max: parseInt(process.env.PG_POOL_MAX ?? '10', 10)`.
  - **Priority**: Low

---

## 5. UI/UX Consistency — 7.5 / 10

The design system is consistent (atomic primitives, four-state lists, toasts, dark mode). Submit buttons now disable during mutations with a "Saving…" label ([CreateTransactionModal.jsx:172](../client/src/components/finance/CreateTransactionModal.jsx#L172)), icon buttons carry `aria-label`s, and attachment download is an authenticated blob fetch rather than a raw link.

- **Issue**: **The `/me` lockout (§3-N1) manifests as a UX catastrophe**, not just a backend error: the user is silently ejected to a login page they cannot use for 15 minutes, with no explanatory message (the interceptor turns the `429` into a generic Error, and no toast distinguishes it).
  - **Recommendation**: Fix §3-N1, and add explicit `429` handling client-side: show "You're doing that too fast — try again in a few minutes" instead of redirecting.
  - **Priority**: Critical (shared with §3)

- **Issue**: **Still no confirmed manual light/dark or mobile pass.** No screenshots, no e2e, no checklist artifact.
  - **Recommendation**: Run `npm run dev` across desktop + mobile viewports in both themes; capture a short verification checklist in the PR. Pairs with the Playwright work in §2.
  - **Priority**: Medium

- **Issue**: **`navigator.clipboard` (citation copy) silently no-ops on non-secure contexts.** Fine behind HTTPS/Cloudflare, but a bare-HTTP exposure fails without feedback.
  - **Recommendation**: Feature-detect and fall back to a "copy manually" toast.
  - **Priority**: Low

---

## 6. DevOps & Deployment — 7.5 / 10

The biggest jump. CI exists ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) running audit + lint + build + test for both packages; migrations auto-run on deploy via the server `CMD` with an advisory lock; `api` and `nginx` have healthchecks and `nginx` waits on `api: service_healthy`; nginx ships security headers + immutable asset caching; `uploads_data` and `postgres_backups` are named volumes; a `db_backup` `pg_dump` sidecar runs on a cron schedule.

- **Issue (NEW — N1)**: **Client Sentry is effectively dead in the Docker build — two independent failures.** (a) The client `Dockerfile` only accepts `ARG VITE_API_URL` (no `VITE_SENTRY_DSN`), so `import.meta.env.VITE_SENTRY_DSN` is `undefined` at build time and `Sentry.init` never runs ([main.jsx:13](../client/src/main.jsx#L13)). (b) Even if it were set, the nginx CSP `connect-src 'self'` ([nginx.docker.conf:13](../client/nginx.docker.conf#L13)) would block the browser from POSTing events to `ingest.sentry.io`. `.env.docker.example` lists `VITE_SENTRY_DSN=` as if it works, which is misleading.
  - **Recommendation**: Add `ARG VITE_SENTRY_DSN` + `ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN` to the client `Dockerfile`, pass it as a build arg from compose, and add the Sentry ingest host to the CSP `connect-src` (`connect-src 'self' https://*.ingest.sentry.io;`). Or remove the dead config and document client error reporting as unavailable in Docker.
  - **Priority**: Medium

- **Issue**: **`CLIENT_ORIGIN` is hardcoded to `https://raflitriwijaya.my.id`** ([docker-compose.yml:21](../docker-compose.yml#L21)) and `VITE_API_URL` is hardcoded in the client `Dockerfile`. The compose stack is not reusable for staging or any other domain without editing tracked files.
  - **Recommendation**: Move both into `.env`/build args: `CLIENT_ORIGIN: ${CLIENT_ORIGIN}` and `--build-arg VITE_API_URL=${VITE_API_URL}`. Extend `.env.docker.example`.
  - **Priority**: Medium

- **Issue**: **Backups land in the on-host `postgres_backups` volume only.** The single Docker host holds both the live data (`postgres_data`) and its only backups — a host failure loses both. The RUNBOOK's "mount externally for off-host copies" is a comment, not a default.
  - **Recommendation**: Push dumps off-host (R2/S3 `aws s3 cp` in the sidecar, or a host-level cron that `rclone`s the volume). Add a documented, periodically-tested restore drill.
  - **Priority**: High

- **Issue**: **CI never runs the server against a real Postgres, and never lints the server.** The server job has no `services: postgres` (its tests are all DB-mocked — §7) and runs `npm run lint --if-present`, but `server/package.json` has **no `lint` script**, so server linting is silently skipped. Server code ships unlinted.
  - **Recommendation**: Add an ESLint config + `lint` script to `server/` and drop `--if-present`. Add a `postgres:16` service to the server job and at least one true integration test (see §7).
  - **Priority**: Medium

- **Issue**: **Server image runs as root and is single-stage** ([server/Dockerfile](../server/Dockerfile)). `COPY . .` after `npm ci --omit=dev` is fine, but no `USER node`.
  - **Recommendation**: Add `USER node` (the `node:22-alpine` image provides it) after copying, and `chown` the app dir. Low effort, real hardening.
  - **Priority**: Low

- **Issue**: **`db_backup` cron uses busybox `crond`**; if `BACKUP_SCHEDULE` is malformed the sidecar silently never dumps, and nothing alerts on a missing backup.
  - **Recommendation**: Add a healthcheck or a "last backup age" check; alert if no dump in 26 h.
  - **Priority**: Low

---

## 7. Code Quality & Maintainability — 7.5 / 10

Tests now exist and pass (24 server / 5 client), lint is clean on the client, and the layering (routes → models → db) stays disciplined with DRY helpers. But the test suite's *depth* does not match its green checkmark.

- **Issue**: **Every server test mocks `pool.query`/`connect` — there is not one real-database integration test.** `auth.test.js`, `ownership.test.js`, `finance.math.test.js`, and `settle.atomicity.test.js` all `vi.mock('../lib/db.js')`. They assert that the model passes the right parameters to a *mock*, not that the SQL is correct, that constraints fire, that `FOR UPDATE` actually serializes, or that ownership holds at the DB. The riskiest guarantees (settle atomicity, cross-user isolation, the new CHECK constraints) are verified against a fake.
  - **Recommendation**: Add a `testcontainers`/`pg` integration suite that boots a real Postgres, runs the migrations, and exercises: user-A-cannot-read-user-B, settle rollback on injected failure, `amount <> 0` rejection, and the transfer-dedup index. Keep the fast mocked unit tests for math.
  - **Priority**: Medium

- **Issue**: **`upload.filter.test.js` re-implements the multer config instead of importing it** — it copies `ALLOWED_EXT`/`ALLOWED_MIME` and a fresh `multer({...})` into the test ([upload.filter.test.js:19-36](../server/test/upload.filter.test.js#L19)). It therefore tests a *copy*; if the real filter in `research.js` regresses, this test stays green. False confidence.
  - **Recommendation**: Export the `fileFilter` (or the configured `upload`) from `research.js` and import it in the test so the test covers the shipped code path.
  - **Priority**: Medium

- **Issue**: **`settle.atomicity.test.js` asserts on positional mock call order**, hard-coding the exact sequence of `BEGIN`/`SELECT`/`INSERT`/`ROLLBACK`. It's brittle: any reordering of equally-correct SQL breaks the test without a real defect.
  - **Recommendation**: The integration test above is the durable fix; until then, assert on observable outcomes (no `COMMIT`, row unchanged) rather than exact call indices.
  - **Priority**: Low

- **Issue**: **Magic enum strings remain duplicated** across routes, models, and migrations (`TX_TYPES`, statuses, the `ALLOWED_EXT`/`ALLOWED_MIME` sets, topic statuses).
  - **Recommendation**: Extract to `server/lib/enums.js`, import in routes + models; mirror to the client where used.
  - **Priority**: Low

- **Issue**: **`migrate.js` diagnostic re-run executes raw SQL outside a transaction** on the shared pool to surface a blocking error ([migrate.js:137-138](../server/db/migrate.js#L137)). A partially-applied statement could leak side effects on the "stuck" path.
  - **Recommendation**: Wrap the diagnostic re-run in `BEGIN … ROLLBACK` so only the error propagates, never the side effects.
  - **Priority**: Low

---

## 8. Security Deep-Dive — 8.0 / 10

The perimeter that V1 called "wide open" is now closed, and I confirmed it: `helmet` with a locked CSP and prod HSTS, two rate limiters, the public uploads mount **removed** in favor of an auth+ownership-gated streaming route with `crypto.randomUUID()` filenames + `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment`, `rehype-sanitize` on all rendered markdown, `bcryptjs` cost-12, session regeneration on login, user-enumeration mitigation, server-side session store, and **`npm audit` = 0 vulnerabilities** on both packages. Strong fundamentals now backed by a real perimeter.

- **Issue**: **Availability is now the weakest security property, via the `/me` limiter (§3-N1).** A trivially-reachable usage pattern denies service to the legitimate user for 15 minutes. Self-DoS is still a CIA-triad failure.
  - **Recommendation**: Fix §3-N1 (move `/me`+`/logout` off the auth limiter).
  - **Priority**: Critical

- **Issue**: **A real dev `SESSION_SECRET` and DB password sit in `server/.env` in the working tree** (`SESSION_SECRET=c0fc21f8…`, `…postgres:1234567890@…`). I verified it is gitignored and **never entered git history** (`git log --all -- server/.env` is empty), so the exposure is local-only — but the secret is real and the deploy docs reference a matching pattern.
  - **Recommendation**: Treat it as compromised: generate a fresh `openssl rand -hex 32` for production and never reuse the dev value. Use Docker/host secrets in prod, not `.env` files. The `.env.example` placeholders are already correct.
  - **Priority**: High

- **Issue**: **MIME allowlist still includes `application/octet-stream`** ([research.js:64](../server/routes/research.js#L64)), which degrades the MIME check to extension-only for any file a browser labels generically. Risk is now *much* lower because the download route sets `nosniff` + attachment disposition (files are never rendered inline), but a renamed binary with an allowed extension still stores.
  - **Recommendation**: Acceptable given the download hardening; if stricter, validate magic bytes (`file-type`) for image/pdf/zip on upload.
  - **Priority**: Low

- **Issue**: **No CSRF token** — protection is `sameSite: lax` + CORS allowlist only. All mutations are non-GET (so `lax` covers them in practice), but it's a single layer.
  - **Recommendation**: Upgrade the session cookie to `sameSite: strict` (acceptable for this app's nav model) or add a double-submit token. Confirm no state-changing GET exists (`/export` is read-only — OK).
  - **Priority**: Medium

- **Issue**: **The API's helmet CSP (`default-src 'none'`) is correct but cosmetic** — the API only emits JSON, so CSP never engages in a browser. The CSP that matters is nginx's, which is reasonable but uses `script-src 'self'` with no nonce and `style-src 'unsafe-inline'` (required by the markdown editor's injected styles).
  - **Recommendation**: Fine for now. If tightening, move editor styles to a hashed stylesheet and drop `unsafe-inline`.
  - **Priority**: Low

---

## 9. Edge Cases & Resilience — 6.5 / 10

Graceful shutdown drains in-flight requests then the pool ([index.js:190](../server/index.js#L190)); the `ErrorBoundary` stops render-throws from white-screening; settle is atomic with `FOR UPDATE` and an `ALREADY_SETTLED` guard; idempotency guards (`amount <> 0`, transfer-dedup) exist; healthchecks restart hung containers. Failure paths are far better engineered than V1, but several gaps persist.

- **Issue**: **The `/me` limiter makes the app *less* resilient to the most common event in a SPA's life — a page refresh (§3-N1).** It is filed Critical there; noting here that it is the dominant resilience defect.
  - **Recommendation**: §3-N1.
  - **Priority**: Critical

- **Issue**: **Unbounded `/export`** (§3) is a memory-exhaustion vector with no per-request size guard.
  - **Recommendation**: Cap + stream (§3).
  - **Priority**: Medium

- **Issue**: **No retry/backoff on transient DB errors.** `connectionTimeoutMillis: 2000` ([db.js:29](../server/lib/db.js#L29)) surfaces a 500 the instant the DB blips (restart/failover). The pool recovers for subsequent requests, but the in-flight one fails hard.
  - **Recommendation**: Wrap idempotent reads in a small retry on `ECONNREFUSED`/`57P03`. Confirm (via the integration suite) the app survives a DB restart without a process restart.
  - **Priority**: Medium

- **Issue**: **Upload-before-ownership disk churn** (§3) and **best-effort, error-swallowing cleanup** of orphaned files.
  - **Recommendation**: Pre-upload ownership middleware + awaited cleanup (§3).
  - **Priority**: Medium

- **Issue**: **Month/year range is not consistently validated.** `listTransactions` guards `Number.isInteger(month/year)` but not the 1–12 range ([finance.model.js:252](../server/models/finance.model.js#L252)); `make_date` will throw on month 13, surfacing as a 500 rather than a clean 400.
  - **Recommendation**: Centralize a `parseMonthYear` that rejects out-of-range with 400; use it in every list/summary/budget caller.
  - **Priority**: Low

---

## 10. Long-Term Scalability & Roadmap — 6.5 / 10

The phases added the *hooks* for scale — Sentry, `pino`, healthchecks, a documented R2 object-storage migration plan (RUNBOOK §4), automated backups — without over-engineering for the stated single-user scope. Hard ceilings remain.

- **Issue**: **Uploads are still single-node local disk.** Durable across rebuilds now (named volume), but the moment a second `api` replica runs, replica B can't serve replica A's files. The R2 plan is written but not implemented.
  - **Recommendation**: Execute the RUNBOOK §4 R2 migration when multi-replica or stronger durability is needed; it's a library swap behind a `USE_OBJECT_STORAGE` flag.
  - **Priority**: Medium (High before any horizontal scale)

- **Issue**: **No metrics/APM — only errors.** Sentry captures exceptions and `pino` logs requests, but there's no request-rate/latency/error-rate/pool-saturation signal and no alerting. You'll learn about saturation from users.
  - **Recommendation**: Expose `prom-client` metrics at `/metrics` (request histogram, pool gauge) or wire an APM. Alert on p99 latency and pool exhaustion.
  - **Priority**: Medium

- **Issue**: **Lazy per-user seeding on first read** (`ensureDefaults` and the snippet/roadmap seeders) adds latency to the first request and pays the seed cost on the request path — fine for a few users, wrong for a signup spike.
  - **Recommendation**: Move seeding into the registration transaction (or a post-register background job).
  - **Priority**: Low

- **Issue**: **No metrics on the backup/restore path itself.** Backups exist but their *restorability* is unverified.
  - **Recommendation**: Add a scheduled restore-to-scratch test that asserts row counts.
  - **Priority**: Low

---

## Overall Production Readiness Score: **7.5 / 10**

Up a full point from V1's 6.4. The five phases were not cosmetic — they closed every V1 Critical (rate limiting, headers, public uploads, tests) and most Highs, and I verified the closures by running the actual tooling (0 vulnerabilities, 29 passing tests, clean lint, clean 304 KB build). This is now a **genuinely shippable single-user application** — *conditional on one fix*: the `/api/auth/me` rate-limit lockout, which turns an ordinary refresh pattern into a 15-minute self-DoS. That is the gate. Everything else is Medium/Low hardening: the unguarded destructive migration (a latent data-loss bomb), the unbounded export, the upload-before-ownership ordering, the host-coupled attachment delete, dead client Sentry in Docker, and a test suite that passes but never touches a real database. Close the Critical and the top three Highs and this is comfortably an 8.5.

---

## Top 10 Critical Actions (ranked by urgency)

| # | Action | Section | Priority | Effort |
|---|--------|---------|----------|--------|
| 1 | **Move `/api/auth/me` and `/logout` off `authLimiter`** onto `generalLimiter` (and handle `429` client-side) — stops the 15-minute self-lockout on a normal refresh pattern | §3-N1, §5, §8, §9 | **Critical** | S |
| 2 | **Guard the destructive `002` migration** against a populated `transactions` table (`RAISE EXCEPTION` if rows exist) — removes the only irreversible data-loss path | §4 | **High** | S |
| 3 | **Push backups off-host** (R2/S3 from the sidecar) and run a tested restore drill — on-host-only backups die with the host | §6 | **High** | M |
| 4 | **Rotate the committed dev `SESSION_SECRET`/DB password** before any production use; never reuse dev secrets; use host/Docker secrets in prod | §8 | **High** | S |
| 5 | **Cap + stream `/export`** (10k-row ceiling → 413, or cursor stream) — closes the memory-exhaustion vector | §3, §9 | Medium | S |
| 6 | **Check upload ownership before disk write** + await/log orphan cleanup; **fix attachment DELETE** to reconstruct path from `filename` | §3, §4, §9 | Medium | M |
| 7 | **Add a real Postgres integration test** (testcontainers): ownership isolation, settle rollback, CHECK constraints; **import the real multer filter** in `upload.filter.test.js` | §7 | Medium | M |
| 8 | **Wire (or remove) client Sentry in Docker**: pass `VITE_SENTRY_DSN` as a build arg *and* add the ingest host to the nginx CSP `connect-src` | §6, §1 | Medium | S |
| 9 | **Parameterize `CLIENT_ORIGIN`/`VITE_API_URL`** out of tracked files; add a server `lint` script + a `postgres` service to CI | §6 | Medium | S |
| 10 | **Lazy-load `Research`/markdown modals** to pull `@uiw/react-md-editor` out of the main bundle; fix the inaccurate App.jsx code comment; give the transfer-dedup collision a clear error message | §2, §4 | Medium | M |

**Quick wins (< 1 hour each):** #1 `/me` limiter, #2 migration guard, #4 secret rotation, #8 Sentry build-arg, #9 env parameterization, plus `git rm hehe.md` (§1).
