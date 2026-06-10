# Production Readiness Audit V3 — Rafli's Productivity Suite

**Auditor:** Senior SRE & Full-Stack Security Architect
**Date:** 2026-06-10
**Repository:** `productivity-project` (React 19 + Vite / Node 22 + Express 5 / PostgreSQL 16)
**Scope:** Full-stack audit covering security, reliability, scalability, maintainability, and long-term sustainability
**Previous Audits:** V1 (6.4/10, 2026-06-09), V2 (7.5/10, 2026-06-10)
**Method:** Read every route, model, migration, middleware, test, and config. Ran the real quality gates on both packages. **Executed the Phase 10 integration suite against a live PostgreSQL** and empirically probed the transfer-dedup index. Findings cite measured results, not assumptions.

---

## Executive Summary

The six remediation phases (6–11) that followed V2 are **real, complete, and verifiable.** I checked every V2 item marked ❌ Open or ⚠️ Partial against the shipped code and confirmed each was closed correctly — not merely present. The single production-blocking V2 Critical (the `/api/auth/me` rate-limit self-lockout) is fixed at [index.js:167-169](../../server/index.js#L167): the strict `authLimiter` now guards only `/login` and `/register`, while `/me` and `/logout` ride the lenient `generalLimiter`, and the axios interceptor distinguishes `429` from `401` so a throttle never ejects the user ([api.js:41-54](../../client/src/lib/api.js#L41), [useAuth.js:22](../../client/src/hooks/useAuth.js#L22), [AuthGuard.jsx:20](../../client/src/components/layout/AuthGuard.jsx#L20)). **There are no Critical findings in V3.** That is the headline.

The quality gates are green and I ran them: **`npm audit` → 0 vulnerabilities** on both packages; **server 24 unit + 4 integration tests pass** (the integration suite skips without a DB locally); **client 5 tests pass**; both lints clean at `--max-warnings 0` (the server is now linted — it was silently unlinted in V2); and the client build is clean with the main chunk down to **242 KB / 77 KB gzip** (from V2's 304 KB). Most importantly, I provisioned a throwaway Postgres and **executed the Phase 10 integration suite against it — all 4 tests passed**: cross-user isolation returns `null`, a failed settle rolls back leaving the row `outstanding`, a zero-amount insert raises `23514`, and a duplicate Transfer raises `23505` on the named index. The migrations applied cleanly to a fresh DB (the new `002` guard is a correct no-op on an empty ledger). This is the first audit cycle in which the riskiest database guarantees are proven against real Postgres rather than a mock.

That said, two new issues surfaced under scrutiny. **(1) The transfer-dedup index has a NULL hole.** I empirically inserted two identical Transfers with `description = NULL` (the default for a quick transfer) and **both succeeded** — Postgres treats NULLs as distinct in a unique index, so the partial index `WHERE type='Transfer'` only fires when a description is present (an empty string *is* deduped; NULL is not). The double-submit guard the migration advertises is therefore a no-op for the most common case. **(2) `GET /health` does not verify database connectivity** ([index.js:156](../../server/index.js#L156)) — it returns a static `{ status: 'ok' }`. The Docker healthcheck and nginx `depends_on: service_healthy` gate on this endpoint, so an API whose DB has gone away still reports healthy, serves traffic, 500s every request, and is never auto-restarted.

The remaining gaps are the long tail that a finer-grained framework exposes: the **OpenAPI spec documents only ~14 of the ~50+ live routes**; there are **no metrics/APM/alerting** (errors via Sentry only); **no e2e/Playwright** coverage and the `Modal` still does not trap focus; the **markdown editor is a 1,060 KB / 363 KB-gzip lazy chunk** that trips Vite's >500 KB warning; and the server image still runs **as root**. None of these is a blocker for the stated single-user scope.

**Verdict: production-ready for its stated single-user personal scope, with no gating item.** Overall score rises from **7.5 → 7.7**. The modest headline delta understates the remediation: V2's score was *conditional* on closing the `/me` Critical and the top Highs — all of which are now verifiably closed — but V3's 12-dimension framework breaks previously-bundled strengths into finer buckets (API-doc completeness, observability/metrics, accessibility, e2e testing) that score honestly in the high-6s/low-7s. Close the two new items above plus metrics and e2e, and this is a clean 8.5+.

---

## Quality Gates — Actual Results

| Gate | Server | Client |
|------|--------|--------|
| `npm audit` | **0 vulnerabilities** | **0 vulnerabilities** |
| `npm run lint` | **clean** (`eslint . --max-warnings 0`; config now exists) | **clean** (`--max-warnings 0`) |
| `npm test` | **24 passed / 4 skipped** (5 files passed, 3 integration files skipped — no local `DATABASE_URL`) | **5 passed** (1 file: markdown sanitization) |
| `npm run test:integration` (real Postgres, provisioned by auditor) | **4 passed / 3 files** — isolation, settle rollback, `23514`, `23505 idx_transactions_transfer_dedup` | n/a |
| `npm run build` | n/a | **clean**; main `index-*.js` **242.73 KB / 77.38 KB gzip**; `mdeditor-*.js` **1,059.81 KB / 363.28 KB gzip** (lazy); `prism-*.js` 85 KB; `Research-*.js` 43 KB (lazy). ⚠️ Vite ">500 kB chunk" warning on `mdeditor`. |

Auditor-run integration evidence (throwaway DB, dropped after): all Phase 10 assertions held against real Postgres. Separately probed the dedup index — two `description=NULL` Transfers **both inserted** (no `23505`); two `description=''` Transfers → second blocked with `23505 idx_transactions_transfer_dedup`.

Note: CI pins Node **20** ([ci.yml:39](../../.github/workflows/ci.yml#L39)) while the production Docker images use **node:22-alpine** — a version skew between test and prod runtimes.

---

## Section Scores

| # | Section | V1* | V2* | V3 | Δ V2→V3 |
|---|---------|----|----|----|---------|
| 1 | Security & Authentication (×2.0) | 5.5 | 8.0 | **8.8** | ▲ +0.8 |
| 2 | Backend Resilience & Reliability (×1.5) | 6.0 | 7.0 | **7.6** | ▲ +0.6 |
| 3 | Database Integrity & Data Safety (×1.5) | 7.0 | 7.5 | **7.8** | ▲ +0.3 |
| 4 | Frontend Reliability & Error Resilience (×1.5) | 6.5 | 7.5 | **7.6** | ▲ +0.1 |
| 5 | API Design & Documentation (×1.0) | 7.0 | 7.5 | **6.8** | ▼ −0.7 (newly scored strictly) |
| 6 | Test Suite Quality & Coverage (×1.25) | 3.0 | 6.0 | **7.2** | ▲ +1.2 |
| 7 | DevOps & CI/CD Maturity (×1.25) | 6.0 | 7.5 | **8.0** | ▲ +0.5 |
| 8 | Observability & Debugging (×1.0) | 4.5 | 6.5 | **6.8** | ▲ +0.3 |
| 9 | Performance & Scalability (×1.0) | 5.5 | 6.5 | **7.2** | ▲ +0.7 |
| 10 | UI/UX Quality & Accessibility (×1.0) | 7.0 | 7.5 | **7.4** | ▼ −0.1 (a11y scored strictly) |
| 11 | Code Quality & Maintainability (×1.0) | 7.0 | 7.5 | **8.0** | ▲ +0.5 |
| 12 | Long-Term Sustainability & Roadmap (×1.0) | 6.5 | 8.0 | **8.5** | ▲ +0.5 |
| | **Overall (weighted)** | **6.4** | **7.5** | **7.7** | ▲ +0.2 |

*V1/V2 used a 10-section framework; their columns above are my best mapping of those scores onto the new 12 dimensions (V1/V2's "Documentation 9.0" largely feeds §12; "Resilience" splits across §2/§4; "Security 8.0" → §1). The overall is recomputed from the V3 weights: Security ×2.0, Backend/DB/Frontend ×1.5, Test/DevOps ×1.25, all others ×1.0 (Σweights = 15.0).

---

## 1. Security & Authentication — 8.8 / 10

### Strengths
- **The V2 Critical is gone.** `authLimiter` guards only `/login`+`/register`; `/me`+`/logout` use `generalLimiter` ([index.js:167-169](../../server/index.js#L167)). Verified by mount-order reading and by the `429` client handling chain.
- `npm audit` = **0 vulns** both packages (bcryptjs swap holds).
- Full perimeter: `helmet` CSP (`default-src 'none'`) + prod HSTS ([index.js:113-123](../../server/index.js#L113)); nginx headers + CSP ([nginx.docker.conf:10-14](../../client/nginx.docker.conf#L10)); auth+ownership-gated attachment download with UUID filenames, `nosniff`, attachment disposition ([research.js:379-401](../../server/routes/research.js#L379)); **pre-upload** ownership middleware so unauthorized uploads never touch disk ([research.js:162-172,553](../../server/routes/research.js#L162)); `rehype-sanitize` with a **passing regression test** ([MarkdownSanitization.test.jsx](../../client/src/test/MarkdownSanitization.test.jsx)); bcryptjs cost 12; session regeneration on login ([auth.js:76](../../server/routes/auth.js#L76)); identical-message user-enumeration mitigation ([auth.js:64-73](../../server/routes/auth.js#L64)); parameterized SQL and `user_id` scoping in all 5 models (36 scoped clauses).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | Dev `SESSION_SECRET` + DB password live in `server/.env` (gitignored, never in history — confirmed) | Low | S | Rotate before prod; docs already cover it (Phase 7) |
| 1.2 | No CSRF token — defense is `sameSite: lax` + CORS only | Medium | M | Upgrade session cookie to `sameSite: strict` (nav model allows it) or add double-submit token |
| 1.3 | MIME allowlist includes `application/octet-stream` ([research.js:65](../../server/routes/research.js#L65)) | Low | M | Acceptable given nosniff+attachment; magic-byte check if stricter |
| 1.4 | nginx CSP `connect-src https://*.ingest.sentry.io` may not match modern region DSNs (`*.ingest.us.sentry.io`) | Low | S | Widen to `https://*.sentry.io` or the exact region host |
| 1.5 | CORS `allowedHeaders: ['Content-Type']` blocks any future custom header silently | Low | S | Note constraint; widen deliberately when adding a CSRF/idempotency header |

### Detailed Findings

#### Finding 1.1: Dev secrets remain in the working tree (acceptable, documented)
**Priority:** Low — **Source:** [server/.env](../../server/.env)

**Observation:** `SESSION_SECRET` and the DB password are real values in `server/.env`. I confirmed the file is gitignored and absent from history. Phase 7 correctly left the working file intact (deleting it breaks local dev) and instead added "treat as compromised / generate fresh" guidance to [.env.docker.example:4-9](../../.env.docker.example#L4) and [RUNBOOK.md §3](../RUNBOOK.md). **This is the correct resolution** for a local-only exposure — no code change is warranted; only operator discipline at deploy time.

**Recommendation:** Generate fresh `openssl rand -hex 32` / `-base64 24` for production; never promote the dev values. Already documented.

---

## 2. Backend Resilience & Reliability — 7.6 / 10

### Strengths
- Graceful shutdown drains HTTP then the pool with a 10 s force-exit fallback ([index.js:199-217](../../server/index.js#L199)).
- Centralized error handler masks 500 detail, maps `23505`→409, surfaces `reqId` ([errorHandler.js](../../server/middleware/errorHandler.js)).
- `settleLedger` is genuinely atomic — `BEGIN`/`FOR UPDATE`/`ROLLBACK` on every error path, ownership re-checked inside the txn ([finance.model.js:591-652](../../server/models/finance.model.js#L591)); **proven against real Postgres** (settle into a non-owned account rolls back, row stays `outstanding`).
- Export now capped at 10 000 rows → `413`, pretty-print dropped ([research.js:230-247](../../server/routes/research.js#L230)); month/year present-but-invalid → clean `400` at route **and** model (`assertMonthYear`) ([finances.js:39-55](../../server/routes/finances.js#L39), [finance.model.js:23-28](../../server/models/finance.model.js#L23)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | `GET /health` returns static 200 — does not verify DB | **High** | S | `SELECT 1` with a short timeout; 503 on failure |
| 2.2 | No retry/backoff on transient DB errors (`ECONNREFUSED`/`57P03`) | Medium | M | Small retry wrapper for idempotent reads |
| 2.3 | Pool `max: 10` hardcoded ([db.js:27](../../server/lib/db.js#L27)) | Low | S | `parseInt(process.env.PG_POOL_MAX ?? '10', 10)` |
| 2.4 | Body parsers run before rate limiters | Low | S | Move `generalLimiter` to a global `app.use` ahead of parsers |
| 2.5 | `migrate.js` diagnostic re-run executes SQL outside a txn ([migrate.js:137-138](../../server/db/migrate.js#L137)) | Low | S | Wrap in `BEGIN … ROLLBACK` so only the error propagates |
| 2.6 | Pool error logged via `console.error` not pino ([db.js:33](../../server/lib/db.js#L33)) | Low | S | Use the shared `logger` |

### Detailed Findings

#### Finding 2.1: `/health` does not check the database
**Priority:** High — **Source:** [server/index.js:156](../../server/index.js#L156)

**Observation:** `app.get('/health', (_req, res) => res.json({ status: 'ok', ... }))` returns 200 as long as the Node process is alive. The Docker `api` healthcheck and nginx's `depends_on: api → service_healthy` both gate on this ([docker-compose.yml:34-39,52-54](../../docker-compose.yml#L34)).

**Risk:** If Postgres becomes unreachable (restart, network partition, exhausted pool) the API keeps reporting healthy. Docker never restarts it, nginx keeps routing, and every request 500s with no auto-recovery — the exact "hung-but-alive" failure the healthcheck was added to catch, except for the dependency that matters most.

**Recommendation:** Make `/health` run `await pool.query('SELECT 1')` inside a 1–2 s timeout and return `503 { status: 'degraded' }` on failure. Keep it unauthenticated and cheap.

**Verification:** Stop Postgres, `curl /health` → 503; Docker marks the container unhealthy and restarts it.

---

## 3. Database Integrity & Data Safety — 7.8 / 10

### Strengths
- The destructive `002` migration now refuses to run against a populated `transactions` table ([002_finance_upgrade.sql:32-40](../../server/db/migrations/002_finance_upgrade.sql#L32)); verified a no-op on a fresh DB and (per the migration's design) an abort on a populated one.
- CHECK constraints are comprehensive and **proven to fire**: `amount <> 0` (`23514` confirmed), `> 0` on receivables/payables, `>= 0` on portfolio/budgets, account/category type enums.
- FKs use deliberate `ON DELETE` semantics (CASCADE on `user_id`, SET NULL on account refs); off-host backup path added (Phase 7).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | **Transfer-dedup index has a NULL hole** — blank-description duplicate transfers are NOT blocked | **High** | S | `NULLS NOT DISTINCT` (PG15+) or `COALESCE` the nullable columns in the index |
| 3.2 | Migrations forward-only, no `down` step | Low | L | Adopt `dbmate`/`node-pg-migrate` when convenient; keep pre-DROP snapshot discipline |
| 3.3 | `research_attachments.file_path` legacy absolute path still written ([research.js:570](../../server/routes/research.js#L570)) | Low | S | Stop writing it, or backfill `= filename`; it is no longer *read* (good) |

### Detailed Findings

#### Finding 3.1: Transfer-dedup index does not block the common (NULL-description) duplicate
**Priority:** High — **Source:** [005_idempotency_guards.sql:27-29](../../server/db/migrations/005_idempotency_guards.sql#L27)

**Observation:** The partial unique index is keyed on `(user_id, date, amount, source_account_id, dest_account_id, description) WHERE type='Transfer'`. I provisioned a real DB and inserted two byte-identical Transfers with `description = NULL`: **both succeeded, no `23505`.** With `description = ''` the second was correctly blocked. Postgres unique indexes treat NULL as distinct from NULL by default, so the index does nothing when any keyed column is NULL — and a quick transfer with no note leaves `description` NULL. The migration comment and `constraints.int.test.js` (which deliberately uses two non-NULL accounts and a `'dup'` description) only exercise the path that *does* work, masking the hole.

**Risk:** The Phase 5 idempotency guarantee — "covers the concurrent double-submit of a Transfer … from two browser tabs" — does not hold for the default case. A double-submit/network-retry of a no-description transfer creates a duplicate ledger entry, mis-stating balances. The client disables the submit button, so the practical surface is two tabs or a retried request, but the DB safety net is absent precisely when it's needed.

**Recommendation:** Recreate the index with `NULLS NOT DISTINCT` (Postgres 16 is in use, so this is available):
```sql
DROP INDEX IF EXISTS idx_transactions_transfer_dedup;
CREATE UNIQUE INDEX idx_transactions_transfer_dedup
  ON transactions (user_id, date, amount, source_account_id, dest_account_id, description)
  NULLS NOT DISTINCT WHERE type = 'Transfer';
```
Add an integration test that inserts two NULL-description Transfers and asserts the second raises `23505`.

**Verification:** Re-run the probe — the second NULL-description insert now raises `23505 idx_transactions_transfer_dedup`.

---

## 4. Frontend Reliability & Error Resilience — 7.6 / 10

### Strengths
- `ErrorBoundary` wraps `<App/>` with a reload action ([ErrorBoundary.jsx](../../client/src/components/ErrorBoundary.jsx)); `429` now handled distinctly from `401` so a throttle shows the loading skeleton instead of ejecting to `/login` ([AuthGuard.jsx:20](../../client/src/components/layout/AuthGuard.jsx#L20)).
- `useApi` guards `setState` after unmount via an `isMounted` ref ([useApi.js:20-43](../../client/src/hooks/useApi.js#L20)); fail-fast on missing `VITE_API_URL` in prod builds ([api.js:15](../../client/src/lib/api.js#L15)); four-state lists, disabled submit buttons.
- `Research` is now `React.lazy`-loaded so the editor leaves the main chunk (main 304→242 KB, verified).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | No e2e/Playwright; UI never browser-verified across audits | Medium | L | Playwright smoke: login→dashboard, create txn, upload→download, light/dark, in CI |
| 4.2 | `Modal` does not trap or restore focus ([Modal.jsx](../../client/src/components/ui/Modal.jsx)) | Medium | M | Trap Tab within dialog; restore focus to opener on close |
| 4.3 | Only 1 client test file (5 assertions) — no component/page tests | Medium | L | Add React Testing Library coverage for the high-traffic modals |
| 4.4 | `navigator.clipboard` (citation copy) silently no-ops on non-secure contexts | Low | S | Feature-detect + "copy manually" toast |

---

## 5. API Design & Documentation — 6.8 / 10

### Strengths
- Consistent envelope: success `{ success, data, meta? }`, error `{ success, error: { code, message, reqId, field? } }`; `reqId` on every error for correlation.
- RESTful conventions, literal-before-`/:id` route ordering, allowlisted sort/filter columns, consistent pagination meta (`total`, `page`, `per_page`).
- Phase 11 added a distinct `DUPLICATE_TRANSFER` code + `field` hint instead of the generic 409.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | **OpenAPI documents only ~14 of ~50+ live routes** | Medium | M | Regenerate to cover receivables/payables/portfolio/budgets/accounts/categories/dashboard, research topics/stats/tags/attachments/bulk, all engineer routes |
| 5.2 | No API versioning (`/api/v1`) | Low | M | Decide and document; cheap to add now, costly later |
| 5.3 | Query params validated ad-hoc, not via Zod like bodies | Low | M | Optional `validateQuery` middleware for list endpoints |

### Detailed Findings

#### Finding 5.1: The OpenAPI spec is a fraction of the real surface
**Priority:** Medium — **Source:** [docs/openapi.json](../openapi.json) (paths at lines 492-1224)

**Observation:** The generated spec lists 14 paths (auth ×4, todos ×2, finances + summary + balances, research + export, learning, engineer projects + snippets, health). The actual API exposes far more — the finances router alone adds `/receivables`, `/payables`, `/portfolio`, `/budgets`, `/accounts`, `/categories`, `/dashboard` (+ their `/:id` and `/settle` variants), and research adds `/topics`, `/stats`, `/tags`, `/bulk`, `/attachments/:id/download`. V2 cited "14 paths" as a strength; under scrutiny it's ~30 % coverage.

**Risk:** A spec that silently omits two-thirds of the API misleads any future integrator or contract test and rots faster than no spec at all.

**Recommendation:** Extend `server/scripts/generate-openapi.js` to register every router's routes (the Zod schemas already exist for the mutating ones). Gate CI on "every mounted route appears in the spec."

---

## 6. Test Suite Quality & Coverage — 7.2 / 10

### Strengths
- **The V2 "all-mocked, false-confidence" critique is substantially answered.** Phase 10 added a real-Postgres integration suite that I **executed and watched pass**: cross-user isolation, settle rollback, `23514` CHECK, `23505` dedup ([test/integration/](../../server/test/integration/)). It skips cleanly without `DATABASE_URL` so the fast suite stays green everywhere.
- `upload.filter.test.js` now imports the **shipped** `researchFileFilter` ([research.js:82](../../server/routes/research.js#L82)) instead of a copy; `settle.atomicity.test.js` is de-brittled to SQL-matching mocks. CI runs a `postgres:16` service + migrate + tests.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | No coverage tooling/reporting | Medium | S | `vitest --coverage` with a floor in CI |
| 6.2 | Integration suite is thin (4 tests); patch/settle-commit-success and bulk ops not covered on real DB | Medium | M | Add commit-path settle, balance math on real data, bulk delete isolation |
| 6.3 | No e2e (shared with §4.1) | Medium | L | Playwright in CI against the compose stack |
| 6.4 | Client effectively has one test file | Medium | L | Component tests for the create/settle modals |

---

## 7. DevOps & CI/CD Maturity — 8.0 / 10

### Strengths
- CI runs audit + lint + build + test for both packages; **server now has a real ESLint config + `lint` script** and CI dropped `--if-present` ([ci.yml:51-53](../../.github/workflows/ci.yml#L51), [eslint.config.js](../../server/eslint.config.js)); server job gets a `postgres:16` service + migrate step.
- Sentry build-arg wired end-to-end (Dockerfile ARG → compose build.args → CSP) ([client/Dockerfile:8-9](../../client/Dockerfile#L8), [docker-compose.yml:46-48](../../docker-compose.yml#L46)); `CLIENT_ORIGIN`/`VITE_API_URL` parameterized out of tracked files; off-host backup option; healthchecks + ordered startup; immutable asset caching; `hehe.md` removed.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | Server image runs as **root**, single-stage ([server/Dockerfile](../../server/Dockerfile)) | Medium | S | Add `USER node` after copy; `chown` app dir |
| 7.2 | CI Node **20** vs prod Node **22** skew | Medium | S | Pin CI to `node-version: 22` |
| 7.3 | Backup sidecar `apk add aws-cli` at container start — fragile/air-gap-hostile; no alert on missing/failed backup | Medium | M | Prefer host-level `aws-cli`/`rclone`; add a "last backup age" check |
| 7.4 | No resource limits or log-rotation (`max-size`/`max-file`) on compose services | Low | S | Add `deploy.resources.limits` + `logging` to each service |
| 7.5 | Restore drill documented but not automated | Low | M | Scheduled restore-to-scratch asserting row counts |

---

## 8. Observability & Debugging — 6.8 / 10

### Strengths
- Structured `pino` + `pino-http`; `reqId` propagated to the error envelope **and** logs **and** the Sentry scope tag ([errorHandler.js:31-41](../../server/middleware/errorHandler.js#L31)).
- Client Sentry now actually functions in Docker (V2's "dead" finding fixed): DSN compiles in via build arg and the CSP permits the ingest host.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | No metrics/APM (request rate, latency, error rate, pool saturation) and no alerting | Medium | M | `prom-client` at `/metrics` (request histogram + pool gauge); alert on p99 + pool exhaustion |
| 8.2 | No pino `redact` for `cookie`/`authorization` headers | Low | S | `redact: ['req.headers.cookie', 'req.headers.authorization']` |
| 8.3 | No audit trail of critical actions (login, mutation, export) | Low | M | Structured info-log on auth + export with `userId`+`reqId` |

---

## 9. Performance & Scalability — 7.2 / 10

### Strengths
- Main chunk **242 KB / 77 KB gzip** (down from 304); editor + prism vendor-split and lazy ([vite.config.js:12-25](../../client/vite.config.js#L12), [App.jsx:25](../../client/src/App.jsx#L25)) — `mdeditor` is not requested on the dashboard.
- Parameterized queries with sensible indexes on every filtered column; dashboard aggregates use `generate_series` + `FILTER` rather than N+1.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | `mdeditor` chunk is **1,060 KB / 363 KB gzip** — trips Vite's >500 KB warning | Medium | M | Acceptable (lazy + cached) for single-user; if trimming, drop the live-preview CodeMirror or swap to a lighter editor |
| 9.2 | Uploads single-node local disk (R2 plan unimplemented) | Medium (High before any multi-replica) | L | Execute RUNBOOK §4 behind a `USE_OBJECT_STORAGE` flag when scaling |
| 9.3 | Lazy per-user seeding (`ensureDefaults`) on the read path | Low | M | Move into the registration transaction |

---

## 10. UI/UX Quality & Accessibility — 7.4 / 10

### Strengths
- The `/me` lockout's UX catastrophe is resolved — throttle shows a skeleton, not a forced logout. Consistent design system, four-state lists, dark mode, toasts; `Modal` has `role="dialog"`, `aria-modal`, `aria-labelledby`, Esc/backdrop close, and `aria-label`ed icon buttons.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | `Modal` focus trap/restore absent (shared §4.2) | Medium | M | Trap + restore focus |
| 10.2 | No axe/Lighthouse pass; no light/dark/mobile verification artifact | Medium | M | axe-core in the Playwright suite; capture a checklist |
| 10.3 | No per-route `<title>` management | Low | S | `useEffect` document.title per page |

---

## 11. Code Quality & Maintainability — 8.0 / 10

### Strengths
- Disciplined routes→models→db layering; DRY helpers (`parseListOpts`, `assertAccountsOwned`, shared envelope); heavy, accurate JSDoc; snake_case DB / camelCase JS discipline; **server now linted** (was unlinted in V2).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | Magic enum strings duplicated across routes/models/migrations (`TX_TYPES`, statuses, `ALLOWED_EXT/MIME`) | Low | M | Extract to `server/lib/enums.js`; mirror to client |
| 11.2 | No type checking (`// @ts-check` / `jsconfig` `checkJs`) | Low | M | Add incrementally on hot paths |
| 11.3 | `useApi` blanket-disables `exhaustive-deps`/`use-memo` ([useApi.js:29](../../client/src/hooks/useApi.js#L29)) | Low | M | Documented invariant; consider a scoped rule rather than blanket disable |

---

## 12. Long-Term Sustainability & Roadmap — 8.5 / 10

### Strengths
- Documentation is **current**: `PROJECT_STATE.md` references Phases 6–11 (21 mentions), `CHANGELOG.md` is complete through Phase 11, `RUNBOOK.md` covers backup/off-host/restore-drill/rotation/R2-plan/incidents, `SECURITY.md` now matches reality (Sentry caveat, export cap, pre-upload ownership, migration guard all reflected), and `ARCHITECTURE.md` exists. Onboarding is < 30 min.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | OpenAPI incompleteness (shared §5.1) undermines the API as a durable contract | Medium | M | Regenerate full spec; gate in CI |
| 12.2 | Two architecture sources of truth (`PROJECT_STATE.md` + `ARCHITECTURE.md`) | Low | M | Make `ARCHITECTURE.md` canonical; demote `PROJECT_STATE.md` to a phase log |
| 12.3 | No feature-flag mechanism for risky rollouts | Low | M | Trivial env-flag pattern when first needed (R2 cut-over) |

---

## Cross-Cutting Themes

1. **The remediation was real; the score plateau is a framing artifact.** Every V2 ❌/⚠️ is closed and verified — several by execution against real Postgres. The +0.2 headline reflects V3's finer dimensions exposing genuinely weaker sub-areas (API-doc completeness 6.8, observability 6.8, e2e 0) that V2's coarser sections averaged away. Trajectory, not stall.

2. **"Documented/tested ⇒ correct" is the recurring trap.** The transfer-dedup index *has* a test and a CHANGELOG entry, yet the test only exercises the non-NULL path and the real-world default (NULL description) slips through. The OpenAPI spec *exists* yet covers 30 % of routes. `/health` *exists* yet checks nothing meaningful. Each looks done on paper. Depth, not presence, is the remaining work.

3. **Observability stops at errors.** Sentry + pino + reqId give excellent *post-mortem* debugging, but there is no *pre-mortem* signal — no latency/throughput/pool metrics, no alerting, and a `/health` that can't see the DB. You will learn about saturation or a DB partition from failing requests, not a dashboard.

4. **Single-node assumptions are now the ceiling, and they're consciously deferred.** Local-disk uploads, in-process seeding, and a fixed pool are all fine for one user and explicitly documented (RUNBOOK §4). They are correctly *not* over-engineered — but they are the first things that break at any horizontal scale.

5. **Testing breadth lags testing depth-of-the-right-things.** The integration suite proves the four scariest invariants beautifully, but there is no e2e, no coverage floor, and the client has one test file. The riskiest *backend* logic is well-guarded; the *frontend* and *contract* surfaces are not.

---

## Top Actions (ranked by priority × impact)

> **Phase 12 status:** items #1, #2, #6, #8, #10, #11 were closed in Phase 12 (2026-06-10). Remaining open items are #3–#5, #7, #9, #12.

| # | Action | Dimension | Priority | Effort | Impact | Status |
|---|--------|-----------|----------|--------|--------|--------|
| 1 | Make `/health` run `SELECT 1` and return 503 on DB failure | §2 | **High** | S | Restores the auto-restart/readiness guarantee the healthcheck exists for | ✅ Phase 12 |
| 2 | Fix the transfer-dedup NULL hole (`NULLS NOT DISTINCT`) + add a NULL-description test | §3 | **High** | S | Closes the double-submit gap for the *common* transfer case | ✅ Phase 12 |
| 3 | Regenerate OpenAPI to cover all ~50 routes; gate "every route documented" in CI | §5, §12 | Medium | M | Makes the API a trustworthy contract again | ❌ Open |
| 4 | Add `prom-client` `/metrics` + alerting on p99/pool exhaustion | §8 | Medium | M | First pre-mortem signal; ends "learn from users" | ❌ Open |
| 5 | Add Playwright e2e (login, create txn, upload→download, light/dark) + axe, in CI | §4, §6, §10 | Medium | L | First-ever working-UI verification across the suite | ❌ Open |
| 6 | `USER node` + multi-stage server image; pin CI to Node 22 | §7 | Medium | S | Container hardening + test/prod runtime parity | ✅ Phase 12 |
| 7 | Trap & restore focus in `Modal` | §4, §10 | Medium | M | Real keyboard/AT accessibility for every dialog | ❌ Open |
| 8 | `vitest --coverage` with a CI floor | §6 | Medium | S | Visibility into the real test gaps | ✅ Phase 12 (floor not yet set) |
| 9 | Retry/backoff wrapper for transient DB errors on idempotent reads | §2 | Medium | M | Survives a DB blip without a 500 | ❌ Open |
| 10 | Add pino `redact` for cookie/authorization headers | §8 | Low | S | Prevents secret leakage into logs | ✅ Phase 12 |
| 11 | Make `generalLimiter` global (before body parsers); env-drive `PG_POOL_MAX` | §2 | Low | S | Tightens the DoS envelope; ops flexibility | ✅ Phase 12 |
| 12 | Extract `server/lib/enums.js`; stop writing legacy `file_path` | §11, §3 | Low | M | Removes drift risk and dead schema | ❌ Open |

**Quick wins (< 30 min each):** #1 `/health`, #2 dedup index, #6 `USER node`/Node-22, #8 coverage, #10 redact, #11 env pool size — **all closed in Phase 12.**

---

## V2 Remediation Ledger — Verified

| V2 Item | V2 Priority | Phase | Actually Fixed? | Evidence |
|---------|-------------|-------|-----------------|----------|
| `/me`+`/logout` rate-limit self-lockout | Critical | 6 | ✅ | [index.js:167-169](../../server/index.js#L167); `429` handled [api.js:41-54](../../client/src/lib/api.js#L41), `throttled` [useAuth.js:22](../../client/src/hooks/useAuth.js#L22), skeleton [AuthGuard.jsx:20](../../client/src/components/layout/AuthGuard.jsx#L20) |
| `002` drops populated table (no guard) | High | 7 | ✅ | [002:32-40](../../server/db/migrations/002_finance_upgrade.sql#L32); verified no-op on fresh DB |
| Backups on-host only | High | 7 | ✅ (optional, env-gated) | [docker-compose.yml:68-107](../../docker-compose.yml#L68); `RUNBOOK §1a` restore drill |
| Dev secret rotation | High | 7 | ✅ (docs+discipline) | [.env.docker.example:4-9](../../.env.docker.example#L4); [RUNBOOK §3](../RUNBOOK.md) |
| Unbounded `/export` | Medium | 8 | ✅ | cap+413, no pretty-print [research.js:230-247](../../server/routes/research.js#L230) |
| Upload before ownership check | Medium | 8 | ✅ | `requireOwnedEntry` before multer [research.js:553](../../server/routes/research.js#L553); awaited cleanup |
| Attachment DELETE host-coupled path | Medium | 8 | ✅ | reconstructs from `filename` [research.js:419](../../server/routes/research.js#L419); `file_path` no longer read |
| Month/year not range-validated | Low→Med | 8 | ✅ | route 400 [finances.js:48](../../server/routes/finances.js#L48) + model `assertMonthYear` |
| Client Sentry dead in Docker | Medium | 9 | ✅ | build arg [client/Dockerfile:8](../../client/Dockerfile#L8) + compose + CSP [nginx.docker.conf:14](../../client/nginx.docker.conf#L14) (⚠ region-DSN wildcard §1.4) |
| `CLIENT_ORIGIN`/`VITE_API_URL` hardcoded | Medium | 9 | ✅ | env-interpolated [docker-compose.yml:22,46](../../docker-compose.yml#L22) |
| Server unlinted in CI | Medium | 9 | ✅ | [eslint.config.js](../../server/eslint.config.js) + script; `--if-present` dropped |
| No Postgres in CI | Medium | 9 | ✅ | service + migrate step [ci.yml:17-57](../../.github/workflows/ci.yml#L17) |
| `hehe.md` in root | Low | 9 | ✅ | moved to `docs/prompt/AUDIT_PROMPT_ARCHIVE.md` |
| All-mocked tests / no integration | Medium | 10 | ✅ **executed & passing on real PG** | [test/integration/](../../server/test/integration/); 4/4 verified by auditor |
| `upload.filter.test` tests a copy | Medium | 10 | ✅ | imports `researchFileFilter` [upload.filter.test.js:17](../../server/test/upload.filter.test.js#L17) |
| `settle.atomicity.test` brittle | Low | 10 | ✅ | SQL-matching mocks [settle.atomicity.test.js:35](../../server/test/settle.atomicity.test.js#L35) |
| Editor in main bundle | Medium | 11 | ✅ | lazy `Research` + `manualChunks`; main 304→242 KB (measured) |
| Inaccurate App.jsx comment | Medium | 11 | ✅ | [App.jsx:20-24](../../client/src/App.jsx#L20) |
| Transfer-dedup misleading 409 | Medium | 11→12 | ✅ **Fully fixed** — message correct (Phase 11); index recreated with `NULLS NOT DISTINCT` (Phase 12, migration 006) | [errorHandler.js:15-24](../../server/middleware/errorHandler.js#L15); [006_fix_dedup_nulls.sql](../../server/db/migrations/006_fix_dedup_nulls.sql) |

**19 of 19 fully fixed** (the dedup NULL hole closed by Phase 12 migration 006 + integration test).

---

## Path to 9.0+

The work is now incremental, not structural. In recommended order:

1. **Two High quick wins first (Effort S, < 1 h total):** real `/health` DB check (§2.1) and the dedup `NULLS NOT DISTINCT` fix (§3.1). These remove the only two findings that touch availability and financial-data integrity. → ~7.9.
2. **Observability + DevOps hardening (Effort S–M):** `prom-client` metrics + basic alerting (§8.1), `USER node` + Node-22 parity (§7.1–7.2), pino redaction (§8.2), coverage floor (§6.1). Lifts §8 to ~7.8, §7 to ~8.6, §6 to ~7.8. → ~8.2.
3. **Contract + UI verification (Effort M–L):** complete the OpenAPI spec with a CI gate (§5.1, §12.1) and a Playwright + axe e2e suite (§4.1, §6.3, §10.2), plus Modal focus trapping (§4.2). Lifts §5 to ~8.5, §4/§10 to ~8.5, §6 to ~8.3. → **~8.8–9.0.**
4. **Scale-readiness (defer until needed):** R2 object storage behind a flag (§9.2) and a metrics-backed restore drill. Pushes §9 past 8 and removes the last single-node ceiling.

The highest-leverage dimensions are the ×2.0/×1.5/×1.25 weighted ones already in good shape; the cheapest points to recover are in **API documentation, observability, and e2e testing**, which the new framework correctly surfaces as the laggards.

---

## Overall Production Readiness Score: **7.7 / 10**

Up from V2's 7.5 — and, more meaningfully, **with zero Critical findings and every V2 Critical/High verifiably closed** (the closures confirmed by running the tooling and the integration suite against real Postgres, not by inspection alone). This application is **ready to run reliably for its stated single-user personal-productivity purpose.** It is *not* yet ready for multi-replica deployment (single-node uploads), nor for an operator who needs to see trouble coming (no metrics/alerting, a blind `/health`).

**The single most important next step** is the one-line `/health` database check (§2.1): today the entire restart-and-readiness safety net is built on an endpoint that cannot detect the failure mode most likely to take the app down. Fix that and the NULL-dedup hole, and this is a genuinely well-built, honestly-documented, continuously-improvable personal platform sitting comfortably in the low-8s with a clear, incremental path to 9.0+.
