# Production Readiness Audit — Rafli's Productivity Suite

**Auditor:** Senior Full-Stack Architect / SRE
**Date:** 2026-06-09
**Repository:** `productivity-project` (React + Vite + Tailwind / Node + Express / PostgreSQL)
**Scope:** End-to-end — planning, frontend, backend, database, UI/UX, DevOps, code quality, security, resilience, scalability.

---

## Executive Summary

This is a **well-architected single-user productivity suite** with a genuinely strong backend foundation: every query is parameterized, every per-user query is `user_id`-scoped, `ORDER BY` columns are allowlisted (no injection), sessions are stored server-side in Postgres, passwords are bcrypt-hashed (cost 12), session IDs are regenerated on login (fixation defense), and user enumeration is mitigated on login. The code is clean, consistent, and unusually well-commented.

However, it is **not yet production-hardened**. The gaps are operational, not architectural: **no rate limiting** (auth brute-force is wide open), **no security headers** (`helmet` absent), **no automated tests whatsoever**, **no CI/CD**, **no structured logging or monitoring**, a **known-vulnerable `tar` transitive dependency** (via `bcrypt`), a **public unauthenticated uploads directory**, and several **resilience gaps** (no graceful shutdown, no DB CHECK constraints on money columns, no global error boundary in React). The frontend was built but **never browser-verified** (the team's own notes admit this across Phases 2–5).

**Verdict:** Solid for a personal/portfolio deployment behind a Cloudflare Tunnel. **Not ready for multi-tenant or untrusted-internet exposure** without the Critical and High items below.

---

## Section Scores

| # | Section | Score |
|---|---------|-------|
| 1 | Project Planning & Documentation | 8.5 / 10 |
| 2 | Frontend (React + Vite + Tailwind) | 7.0 / 10 |
| 3 | Backend (Node.js + Express) | 7.5 / 10 |
| 4 | Database (PostgreSQL) | 7.0 / 10 |
| 5 | UI/UX Consistency | 7.5 / 10 |
| 6 | DevOps & Deployment | 6.0 / 10 |
| 7 | Code Quality & Maintainability | 7.0 / 10 |
| 8 | Security Deep-Dive | 5.5 / 10 |
| 9 | Edge Cases & Resilience | 5.0 / 10 |
| 10 | Long-Term Scalability & Roadmap | 5.5 / 10 |
| | **Overall (weighted)** | **6.4 / 10** |

Weighting: Security ×2, Backend ×1.5, Database ×1.5, Resilience ×1.5, DevOps ×1.25, others ×1.

---

## 1. Project Planning & Documentation — 8.5 / 10

The strongest area. `PROJECT_STATE.md` is an exceptional living document: every route, model, table, migration, and component is catalogued with rationale. The README covers both Docker and manual deploy paths. This is far above typical project hygiene.

- **Issue**: `PROJECT_STATE.md` is the *only* source of truth for architecture; there is no `CHANGELOG.md`, no API reference (OpenAPI/Swagger), and no `CONTRIBUTING.md`. Onboarding a second developer means reading a 350-line state dump.
  - **Recommendation**: Generate an OpenAPI 3.1 spec from the route handlers (the zod schemas can be reused via `zod-to-openapi`). Split `PROJECT_STATE.md` into `docs/ARCHITECTURE.md` + a generated `docs/API.md`.
  - **Priority**: Low

- **Issue**: No documented testing strategy, rollback procedure, or incident runbook. README explains how to *deploy* but not how to *recover* (DB restore, migration rollback, secret rotation).
  - **Recommendation**: Add `docs/RUNBOOK.md` covering: DB backup/restore (`pg_dump`/`pg_restore`), how to roll back a bad migration (the runner is forward-only — see §4), and `SESSION_SECRET` rotation (invalidates all sessions).
  - **Priority**: Medium

- **Issue**: The "Stoic Garden" re-theme intentionally overrides the SKILL.md accent rules, but there is no single design-token reference doc for future contributors.
  - **Recommendation**: Document the `moss`/`terracotta`/`ember` semantic roles in `docs/DESIGN_TOKENS.md`.
  - **Priority**: Low

---

## 2. Frontend (React + Vite + Tailwind CSS) — 7.0 / 10

Clean component architecture (atomic `ui/` primitives, module folders, shared hooks). Axios client correctly uses `withCredentials` and a 401 redirect interceptor. But the team's own notes admit **Phases 2–5 were never browser-verified**, and there are structural resilience gaps.

- **Issue**: **No React error boundary.** A render-time throw anywhere (e.g. a malformed API row, a null deref in a chart) white-screens the entire SPA. There is no `ErrorBoundary` component wrapping the router in `client/src/main.jsx`.
  - **Recommendation**: Add a class-based `ErrorBoundary` (React 19 still requires class components for `componentDidCatch`) wrapping `<App />`, rendering the existing `ErrorState` component with a "Reload" action.
  - **Priority**: High

- **Issue**: **Markdown XSS surface.** `MarkdownPreview` in [client/src/components/engineer/MarkdownEditor.jsx](client/src/components/engineer/MarkdownEditor.jsx#L38) renders user-authored content (research entries, docs) via `MDEditor.Markdown`. `@uiw/react-md-editor` sanitizes by default, but raw-HTML passthrough is configurable and the version is unpinned (`^4.1.1`). Content is stored verbatim server-side with no sanitization.
  - **Recommendation**: Explicitly pass a `rehypeRewrite`/`rehype-sanitize` plugin to `MDEditor.Markdown` and assert `skipHtml`/disallowed tags. Add a test rendering `<img src=x onerror=alert(1)>` as entry content to confirm it does not execute. Pin the dependency to an exact version.
  - **Priority**: High

- **Issue**: **MDEditor inflates the main bundle.** Importing the editor into `CreateResearchModal` pulls `@uiw/react-md-editor` into the main `Research` chunk, pushing `index-*.js` past **1.4 MB** (team's own note). This is a slow first paint on mobile/3G.
  - **Recommendation**: `React.lazy()` the markdown editor and wrap usage in `<Suspense>`. Code-split `/engineer/docs` and the research create modal. Add `build.rollupOptions.output.manualChunks` to vendor-split `react-md-editor`, `prism-react-renderer`, and charts.
  - **Priority**: Medium

- **Issue**: **Pre-existing ESLint errors are not gated.** Notes mention baseline errors (`set-state-in-effect`, unused imports, `useMemo` deps) that ship. `set-state-in-effect` patterns can cause render loops / double-fetches.
  - **Recommendation**: Run `npm run lint` in CI with `--max-warnings 0`. Fix the `set-state-in-effect` cases (most are `useApi` patterns that should move into the hook's effect, not the component body).
  - **Priority**: Medium

- **Issue**: **No client-side env validation.** `VITE_API_URL` silently falls back to `http://localhost:3000` ([client/src/lib/api.js](client/src/lib/api.js#L15)). A production build that forgets the env var ships pointing at localhost and fails opaquely.
  - **Recommendation**: Throw at module load in production builds if `import.meta.env.PROD && !import.meta.env.VITE_API_URL`.
  - **Priority**: Medium

- **Issue**: **No loading/disabled state guarantees on mutation buttons** are verified. Double-submit on slow networks can create duplicate transactions/entries (no idempotency key, no optimistic lock).
  - **Recommendation**: Disable submit buttons while a mutation is in flight (audit every `Create*Modal`). Consider an idempotency key for `POST /transactions` and `/settle`.
  - **Priority**: Medium

---

## 3. Backend (Node.js + Express) — 7.5 / 10

The backend is the project's strongest engineering. Standard response envelope, central error handler that masks 500s, zod validation on every mutating route, ownership checks in the model layer, atomic transactions for settle. Express 5 param-shadowing handled correctly (literal routes before `/:id`).

- **Issue**: **No rate limiting anywhere.** `POST /api/auth/login` and `/register` accept unlimited attempts. bcrypt cost 12 slows each guess but does not stop credential stuffing, and an attacker can also DoS the single Postgres pool (`max: 10`).
  - **Recommendation**: Add `express-rate-limit` with a strict limiter on `/api/auth/*` (e.g. 5 attempts / 15 min / IP) and a general limiter on `/api/*` (e.g. 100 req/min/IP). Behind the reverse proxy, ensure `trust proxy` is set (it is, in prod) so the limiter keys on the real IP.
  - **Priority**: **Critical**

- **Issue**: **No `helmet` / security headers.** No `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, or `Referrer-Policy`. The app is clickjackable and has no CSP to blunt the markdown-XSS surface.
  - **Recommendation**: `app.use(helmet())` with a tuned CSP. The nginx Docker config also serves the SPA — add headers there too (`add_header X-Frame-Options DENY;` etc.).
  - **Priority**: **Critical**

- **Issue**: **No graceful shutdown.** `app.listen` has no `SIGTERM`/`SIGINT` handler. On `docker compose down` or PM2 reload, in-flight requests are killed and the pg pool is not drained — risking half-written multi-statement operations (though settle is transactional).
  - **Recommendation**: Capture the `server` handle; on `SIGTERM`/`SIGINT` call `server.close()` then `pool.end()` with a timeout fallback.
  - **Priority**: High

- **Issue**: **No request body logging / structured logs.** The only logging is `console.error` of stack traces in the error handler. No request IDs, no access logs, no log levels. Debugging a production incident is near-impossible.
  - **Recommendation**: Add `pino` + `pino-http` with a generated request ID echoed in the error envelope. Log to stdout (captured by Docker/PM2).
  - **Priority**: High

- **Issue**: **`GET /api/auth/me` and `/logout` lack `requireAuth`** (by design, auth router is mounted public), but `/me` re-implements the session check. The `/export` endpoint streams up to `per_page: 100000` rows ([server/routes/research.js](server/routes/research.js#L209)) into memory and `JSON.stringify(rows, null, 2)` — a memory-pressure vector for a large account.
  - **Recommendation**: Cap export at a sane maximum (e.g. 10,000 rows) or stream the CSV/JSON with a cursor. Return `413` past the cap.
  - **Priority**: Medium

- **Issue**: **No `.toLowerCase()` on register-time email lookup.** [server/routes/auth.js:36](server/routes/auth.js#L36) calls `findByEmail(email)` with the raw input, but stores `email.toLowerCase().trim()`. A user registering `Bob@x.com` when `bob@x.com` exists passes the duplicate check, then the DB `UNIQUE` index on `email` throws a raw 500 (unique violation) instead of a clean 409.
  - **Recommendation**: Lowercase/trim before the `findByEmail` check (mirror the login path which does normalize). Also catch pg error `23505` in the error handler and map to a 409.
  - **Priority**: Medium

- **Issue**: **CORS `allowedHeaders: ['Content-Type']` only.** Fine today, but any future custom header (e.g. an idempotency key or CSRF token) will be silently blocked.
  - **Recommendation**: Note this constraint in code; widen deliberately when adding headers.
  - **Priority**: Low

---

## 4. Database (PostgreSQL) — 7.0 / 10

Schema design is sound: SERIAL PKs, `user_id` FKs with `ON DELETE CASCADE`, `TIMESTAMPTZ`, shared `set_updated_at()` trigger, sensible indexes (`idx_{table}_user_id`, `_status`). The migration runner is clever (handles fresh + pre-existing DBs, dependency deferral). The finance balance math is correct and centralized.

- **Issue**: **Migrations are forward-only with no `down`/rollback.** A bad migration in production can only be undone by hand-written SQL. `002_finance_upgrade.sql` **drops the `transactions` table** — running it against a populated prod DB is irreversible data loss (the notes confirm pre-upgrade rows were *not* migrated).
  - **Recommendation**: Adopt a migration tool with down-migrations (`node-pg-migrate` or `dbmate`), or at minimum require a `pg_dump` snapshot before any `DROP`. Add a guard in destructive migrations: `DO $$ BEGIN IF (SELECT count(*) FROM transactions) > 0 THEN RAISE EXCEPTION 'refusing to drop populated table'; END IF; END $$;`.
  - **Priority**: High

- **Issue**: **No CHECK constraint on money/quantity columns.** `transactions.amount`, `portfolio.quantity/avg_price/current_price`, `budgets.amount`, `receivables/payables.amount` rely solely on zod for sign/range. A direct DB write or a future code path bypassing zod can insert garbage. The notes explicitly state `amount` is "not constrained `> 0`".
  - **Recommendation**: Add CHECK constraints where invariants are absolute (e.g. `budgets.amount >= 0`, `portfolio.quantity >= 0`). For `transactions.amount` (which allows negatives for adjustments), add `CHECK (amount <> 0)`.
  - **Priority**: Medium

- **Issue**: **`research_attachments.file_path` stores an absolute disk path.** This is host-coupled — a container rebuild or host migration with a different mount point orphans every attachment's path while the `filename` (random name) is the real key.
  - **Recommendation**: Store only `filename`; reconstruct the path from `uploadsDir` at read time (the delete handler already needs the resolved dir anyway).
  - **Priority**: Medium

- **Issue**: **No connection pooling tuning for production scale.** `max: 10` is hardcoded in [server/lib/db.js](server/lib/db.js#L25). Under the unbounded request volume (no rate limit), the pool is a bottleneck and `connectionTimeoutMillis: 2000` will surface as user-facing 500s under load.
  - **Recommendation**: Make pool size env-driven. For a single-user app this is fine; revisit if multi-tenant.
  - **Priority**: Low

- **Issue**: **Lazy seeding races.** `ensureDefaults`, `seedSnippetsForUser`, `seedRoadmapSkillsForUser` run on first read. Two concurrent first-requests from the same fresh user could double-seed; `ensureDefaults` is `ON CONFLICT`-safe, but verify the snippet/roadmap seeders are too.
  - **Recommendation**: Confirm `ON CONFLICT DO NOTHING` (or an advisory lock) on all lazy seeders.
  - **Priority**: Low

---

## 5. UI/UX Consistency — 7.5 / 10

Consistent design system (atomic primitives, four-state list handling, toast system, dark mode). The Stoic Garden palette is applied uniformly (notes verify 0 stray `emerald` in built CSS). Good empty/error/skeleton states.

- **Issue**: **Never visually verified.** Phases 2–5 (mobile tab strip, hover actions, dark mode, markdown editor, tag autocomplete, export dropdown, detail modal, bulk bar, pin/citation controls, native date pickers) have *not* been eyeballed in a browser (team's own admission). Build + API pass ≠ working UI.
  - **Recommendation**: Run a manual light/dark pass with `npm run dev` on desktop + a mobile viewport. Add Playwright smoke tests for the critical flows (login, create transaction, create research entry, upload attachment).
  - **Priority**: High

- **Issue**: **`navigator.clipboard` requires a secure context.** The citation-copy control silently no-ops on plain HTTP. Fine on localhost/https, but if ever served over bare HTTP it fails without feedback.
  - **Recommendation**: Feature-detect `navigator.clipboard` and fall back to a `document.execCommand('copy')` shim or show a "copy manually" toast.
  - **Priority**: Low

- **Issue**: **No accessibility audit.** No evidence of `aria-*` on the custom checkbox/role=checkbox toggles, modal focus-trapping, or keyboard nav for the bulk-select and dropdowns. Modals portal to `body` but focus management is unverified.
  - **Recommendation**: Run axe-core/Lighthouse. Ensure `Modal` traps focus and restores it on close; add `aria-label`s to icon-only buttons (the row action icons).
  - **Priority**: Medium

- **Issue**: **No `<title>` / meta management per route** and no favicon-beyond-default branding check.
  - **Recommendation**: Add per-page document titles (simple `useEffect` or `react-helmet`-lite).
  - **Priority**: Low

---

## 6. DevOps & Deployment — 6.0 / 10

Two deployment paths (Docker Compose 3-tier, manual Nginx+PM2) plus Cloudflare Tunnel. The Docker setup correctly orders `db → api → nginx` with a healthcheck gate. But there is **no CI/CD, no automated migration on deploy, and config is partly hardcoded.**

- **Issue**: **No CI/CD pipeline.** No GitHub Actions, no automated build/lint/test/audit on push. Deploys are manual (`docker compose up --build`). Nothing prevents a broken build or a vulnerable dependency from shipping.
  - **Recommendation**: Add `.github/workflows/ci.yml`: `npm ci` + `npm run lint` + `npm run build` (client) + `npm audit --audit-level=high` (both) + tests once they exist. Gate merges on green.
  - **Priority**: High

- **Issue**: **Migrations are a manual post-deploy step** (`docker compose exec api npm run migrate`). Easy to forget; a deploy that adds a column but skips migration 500s at runtime.
  - **Recommendation**: Run migrations automatically as an `api` container entrypoint step (or a one-shot `migrate` service that the `api` `depends_on`), guarded so concurrent replicas don't race (advisory lock).
  - **Priority**: High

- **Issue**: **`CLIENT_ORIGIN` is hardcoded to `https://raflitriwijaya.my.id`** in [docker-compose.yml:21](docker-compose.yml#L21). The compose file is not reusable for any other domain/staging environment.
  - **Recommendation**: Move `CLIENT_ORIGIN` into `.env` (`.env.docker.example` already parameterizes only `DB_PASSWORD`/`SESSION_SECRET` — add this).
  - **Priority**: Medium

- **Issue**: **No healthcheck on the `api` and `nginx` containers** (only `db` has one). `restart: unless-stopped` restarts crashed containers but won't catch a hung-but-alive API.
  - **Recommendation**: Add a `healthcheck` to `api` hitting `GET /health` and to `nginx` hitting `/`. Make `nginx` `depends_on` api `condition: service_healthy`.
  - **Priority**: Medium

- **Issue**: **No resource limits / no log rotation** on containers. A memory leak or the unbounded `/export` can OOM the host; PM2/Docker logs grow unbounded.
  - **Recommendation**: Add `deploy.resources.limits` (memory) and `logging` driver with `max-size`/`max-file` to each service. For PM2, configure `max_memory_restart` in `ecosystem.config.cjs`.
  - **Priority**: Medium

- **Issue**: **No DB backup automation.** The `postgres_data` volume is the only copy of all user data.
  - **Recommendation**: Add a scheduled `pg_dump` sidecar (cron container) writing to off-host storage, plus a documented restore test.
  - **Priority**: High

- **Issue**: **nginx serves static assets without cache headers or security headers.** [client/nginx.docker.conf](client/nginx.docker.conf) has gzip but no `Cache-Control` for hashed assets and no security headers.
  - **Recommendation**: Add `location ~* \.(js|css|svg|png|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; }` and the security headers from §8.
  - **Priority**: Medium

---

## 7. Code Quality & Maintainability — 7.0 / 10

Consistent, idiomatic, heavily commented. Clear layering (routes → models → db). DRY helpers (`parseListOpts`, `assertAccountsOwned`, shared envelope). snake_case discipline. The main drag is the **total absence of tests** and some shipped lint debt.

- **Issue**: **Zero automated tests.** `server/package.json` `test` script literally `exit 1`. No unit, integration, or e2e tests. Every refactor is a blind change; the finance balance math (the riskiest logic) has no regression guard.
  - **Recommendation**: Add `vitest` (or `node:test`) + `supertest`. Priority coverage: auth flow, finance balance/summary math, ownership scoping (verify user A cannot read user B's rows), settle transaction atomicity, multer file-type rejection. Target the model layer first (highest ROI).
  - **Priority**: **Critical**

- **Issue**: **Magic enum strings duplicated** across routes, models, and migrations (`TX_TYPES`, statuses, severities). Drift risk: a value added in one place and missed in another silently breaks validation or display.
  - **Recommendation**: Extract shared enum constants into `server/lib/enums.js`, imported by both routes and models. Mirror to the client where used.
  - **Priority**: Low

- **Issue**: **`pool.end()` and error handling on migrate failure** are good, but the runner's "re-run the first blocked file without catching" ([server/db/migrate.js:127](server/db/migrate.js#L127)) runs SQL *outside a transaction* on the shared pool to surface an error — a partial apply could leak.
  - **Recommendation**: Wrap the diagnostic re-run in a transaction that always rolls back; you only want the error, not the side effects.
  - **Priority**: Low

- **Issue**: **No JSDoc/type checking enforced.** JSDoc is present but not validated. A typo in a field name is a runtime bug.
  - **Recommendation**: Add `// @ts-check` + a `jsconfig.json` with `checkJs`, or migrate hot paths to TypeScript incrementally.
  - **Priority**: Low

---

## 8. Security Deep-Dive — 5.5 / 10

**Strong fundamentals, weak perimeter.** What's done right: parameterized SQL everywhere, allowlisted `ORDER BY`, `user_id` scoping on every query, bcrypt cost 12, session regeneration on login, user-enumeration mitigation, httpOnly + `secure` (prod) + `sameSite=lax` cookies, 500-detail masking, 1 MB body cap, multer ext+MIME allowlist + 10 MB cap. What's missing is the operational security layer.

- **Issue**: **No brute-force protection on auth** (see §3). Unlimited login attempts.
  - **Recommendation**: `express-rate-limit` on `/api/auth/*`; consider account lockout/backoff after N failures.
  - **Priority**: **Critical**

- **Issue**: **No security headers / CSP** (see §3). XSS from the markdown surface is unmitigated by any CSP.
  - **Recommendation**: `helmet()` + CSP; headers at nginx too.
  - **Priority**: **Critical**

- **Issue**: **Stored XSS via markdown content** (see §2). Research entries and docs render user markdown; HTML sanitization is not explicitly enforced.
  - **Recommendation**: Enforce `rehype-sanitize`; server-side sanitize on write as defense-in-depth.
  - **Priority**: High

- **Issue**: **Public, unauthenticated `/uploads` directory.** [server/index.js:101](server/index.js#L101) serves `uploadsDir` statically with *no auth gate* — "security by obscure random filename." Anyone with a URL (leaked in logs, referrer headers, browser history, or guessed within the `Date.now()-rand` space) reads another user's attachment. Filenames are predictable-ish (`${Date.now()}-${rand}`).
  - **Recommendation**: Gate downloads behind `requireAuth` + ownership: serve files through a route (`GET /api/research/attachments/:id/download`) that verifies the parent entry belongs to `req.user`, then streams the file. Remove the public static mount. Use `crypto.randomUUID()` for filenames regardless.
  - **Priority**: **Critical**

- **Issue**: **No CSRF token.** Protection relies entirely on `sameSite=lax` + CORS origin allowlist. `lax` permits top-level GET navigations to send the cookie; all mutations are POST/PATCH/DELETE so are protected in practice, but this is a single layer.
  - **Recommendation**: For defense-in-depth, either set `sameSite=strict` for the session cookie (acceptable for this app's nav model) or add a double-submit CSRF token. Verify no state-changing GET endpoints exist (`/export` is read-only — OK).
  - **Priority**: Medium

- **Issue**: **`bcrypt` pulls a known-vulnerable `tar`** (transitive via `@mapbox/node-pre-gyp`). `npm audit` reports **2 high-severity** advisories (node-tar path traversal / arbitrary file overwrite, GHSA-34x7-hfp2-rc4v and others). Exploitable only during `bcrypt` install/build, but it's a supply-chain liability flagged on every audit.
  - **Recommendation**: `npm audit fix`; if unresolved, switch to `bcryptjs` (pure JS, no native build, no `node-pre-gyp`/`tar`) — drop-in API-compatible. Add `npm audit --audit-level=high` to CI.
  - **Priority**: High

- **Issue**: **`SESSION_SECRET` committed in a real `server/.env` on disk.** It is gitignored (verified: not tracked), but a real 64-hex secret sits in the working tree and a matching one is referenced in deploy docs. Risk of accidental commit / sharing.
  - **Recommendation**: Confirm it was never in git history (`git log -p -- server/.env` — clean). Rotate the secret before any real deployment; never reuse the dev secret in prod. Use Docker/host secrets, not `.env` files, in production.
  - **Priority**: High

- **Issue**: **No HSTS / TLS enforcement in app.** Relies on Cloudflare/nginx for TLS. If ever exposed directly, cookies marked `secure` won't be sent and sessions silently break, or worse, are sent over HTTP if `secure` is misconfigured.
  - **Recommendation**: Add HSTS via helmet; ensure the reverse proxy redirects HTTP→HTTPS.
  - **Priority**: Medium

- **Issue**: **MIME allowlist includes `application/octet-stream`** ([server/routes/research.js:63](server/routes/research.js#L63)) to accommodate browsers sending it for `.cpp`/`.py`/`.md`. This weakens the MIME check to "extension-only" for any file a browser labels octet-stream — a renamed executable with a `.txt` extension passes.
  - **Recommendation**: Files are served as attachments (not executed), so risk is low, but set `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` on the download route so the browser never renders/sniffs them inline.
  - **Priority**: Medium

---

## 9. Edge Cases & Resilience — 5.0 / 10

The weakest functional area. The happy path is solid; failure paths are under-engineered.

- **Issue**: **No graceful shutdown / connection draining** (see §3). Container stop = killed in-flight requests.
  - **Recommendation**: `SIGTERM` handler → `server.close()` → `pool.end()`.
  - **Priority**: High

- **Issue**: **No global React error boundary** (see §2). One bad row white-screens the app.
  - **Recommendation**: Add `ErrorBoundary`.
  - **Priority**: High

- **Issue**: **Unbounded `/export` query** loads up to 100,000 rows into memory and pretty-prints them (see §3). Concurrent exports can OOM the API container (no memory limit either, see §6).
  - **Recommendation**: Cap + stream.
  - **Priority**: Medium

- **Issue**: **No retry/backoff on transient DB errors.** `connectionTimeoutMillis: 2000` surfaces a 500 the instant the DB is briefly unreachable (restart, failover). The pool error handler logs but doesn't recover individual requests.
  - **Recommendation**: Add a small retry wrapper for read queries on `ECONNREFUSED`/`57P03`; ensure the app survives a DB restart without a process restart (it should, via the pool — verify).
  - **Priority**: Medium

- **Issue**: **No idempotency on financial mutations.** A double-click or network retry on "settle" or "create transaction" creates duplicate ledger entries, corrupting balances. Settle is transactional but not idempotent.
  - **Recommendation**: Disable buttons during submit (client); add an idempotency key or a `UNIQUE` partial index where a natural key exists.
  - **Priority**: Medium

- **Issue**: **Multer writes to disk before ownership is checked.** [server/routes/research.js:493](server/routes/research.js#L493) — the file lands on disk, *then* the entry ownership is verified and the orphan is `fs.rm`'d. A flood of POSTs to a non-owned entry id writes+deletes files rapidly (disk churn / partial-fill DoS) and the cleanup is best-effort (fire-and-forget callback, errors swallowed).
  - **Recommendation**: Check entry ownership *before* accepting the upload (custom middleware running before `upload.single`). At minimum, monitor `uploads/` disk usage and make cleanup awaited/logged.
  - **Priority**: Medium

- **Issue**: **No handling for `make_date` with malformed month/year** in some paths. `parseMonthYear` validates, but raw `?month`/`?year` reaching `listTransactions` rely on `Number.isInteger` guards — verify every caller validates range (month 1–12) not just integer-ness.
  - **Recommendation**: Centralize month/year validation; reject out-of-range with 400.
  - **Priority**: Low

---

## 10. Long-Term Scalability & Roadmap — 5.5 / 10

The architecture is appropriate for its **stated scope (single/few users)** but has hard ceilings for growth, and no observability to know when they're hit.

- **Issue**: **No observability stack.** No metrics (request rate, latency, error rate, pool saturation), no APM, no alerting. You cannot tell if production is healthy beyond a binary `/health`.
  - **Recommendation**: Expose Prometheus metrics (`prom-client`) or wire an APM (Sentry for errors at minimum — cheap, high value). Add error reporting to the React app too.
  - **Priority**: High

- **Issue**: **Session store and uploads are single-node.** Sessions in Postgres scale fine, but **uploads on local disk** ([server/uploads/](server/uploads/)) break the moment you run >1 API replica or use ephemeral container storage — files written by replica A aren't visible to replica B, and a container rebuild loses them all (the volume isn't in `docker-compose.yml`).
  - **Recommendation**: For multi-instance or durability, move attachments to object storage (S3/R2 — R2 pairs naturally with the Cloudflare setup). At minimum, add a named Docker volume for `server/uploads` so rebuilds don't wipe attachments (currently only `postgres_data` is volumed — **attachments are lost on every `docker compose up --build`**).
  - **Priority**: High

- **Issue**: **Lazy per-user seeding doesn't scale to bulk onboarding** and adds latency to first reads. Fine for a few users; a sign-up spike pays the seed cost on the request path.
  - **Recommendation**: Move seeding into the registration transaction (or a background job) rather than first-read.
  - **Priority**: Low

- **Issue**: **No pagination ceiling enforcement consistency.** Research caps `per_page` at 100, but `/export` deliberately bypasses it. Other list endpoints' caps should be audited for consistency.
  - **Recommendation**: Single shared pagination clamp helper used by every list route.
  - **Priority**: Low

- **Issue**: **No feature-flagging or config service.** All behavior is hardcoded; rolling out a risky change is all-or-nothing.
  - **Recommendation**: Low priority at this scale; revisit if the user base grows.
  - **Priority**: Low

---

## Overall Production Readiness Score: **6.4 / 10**

A **strong B-minus**: excellent core engineering and documentation, undermined by missing operational hardening (rate limiting, headers, tests, monitoring, backups) and several real security gaps (public uploads, markdown XSS, vulnerable transitive dep). **Safe to ship as a personal app behind Cloudflare today**; **not safe for untrusted multi-user internet exposure** until the Critical items are closed.

---

## Top 10 Critical Actions (ranked by urgency)

| # | Action | Section | Priority | Effort |
|---|--------|---------|----------|--------|
| 1 | **Gate `/uploads` behind auth + ownership** (stop serving user files publicly; stream via an authenticated route, UUID filenames) | §8 | Critical | M |
| 2 | **Add rate limiting** on `/api/auth/*` (5/15min) and `/api/*` (100/min) via `express-rate-limit` | §3, §8 | Critical | S |
| 3 | **Add `helmet` + CSP** (app) and security headers (nginx); enforce HSTS | §8 | Critical | S |
| 4 | **Establish a test suite** (vitest + supertest): auth, finance math, ownership isolation, settle atomicity, upload filter | §7 | Critical | L |
| 5 | **Fix the `tar`/`bcrypt` vuln** — `npm audit fix` or swap to `bcryptjs`; add `npm audit` to CI | §8 | High | S |
| 6 | **Enforce markdown sanitization** (`rehype-sanitize`) + add a React error boundary | §2, §8 | High | M |
| 7 | **Add a named volume for `server/uploads`** (attachments are currently wiped on every `--build`) and plan object storage for scale | §10, §6 | High | S |
| 8 | **Graceful shutdown** (`SIGTERM` → `server.close()` → `pool.end()`) + auto-run migrations on deploy with an advisory lock | §3, §6 | High | S |
| 9 | **Add CI/CD** (GitHub Actions: lint, build, audit, test) and **automated DB backups** (`pg_dump` sidecar) | §6 | High | M |
| 10 | **Add observability** — Sentry for client+server errors, structured logging (`pino`), `/health` already exists | §9, §10 | High | M |

**Quick wins (do first, < 1 hour each):** #2 rate limiting, #3 helmet, #5 `npm audit fix`, #7 uploads volume, #8 graceful shutdown, register-email lowercase bug (§3).
