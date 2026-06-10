# Production Readiness & Product Vision Audit V4 — Rafli's Productivity Suite

**Auditor:** Product Architect & Senior SRE
**Date:** 2026-06-11
**Repository:** `productivity-project` (React 19 + Vite / Node 22 + Express 5 / PostgreSQL 16)
**Scope:** Full-stack technical audit + product-market-fit evaluation for personal productivity
**Previous Audits:** V1 (6.4, 2026-06-09), V2 (7.5, 2026-06-10), V3 (7.7, 2026-06-10)
**Enhancements Since V3:** Observability (prom-client `/metrics`, pool gauge, audit-trail logging, alerting runbook), E2E Testing + Accessibility (Playwright, axe-core, Modal focus trap, per-route titles), API Documentation + Code Cleanup (OpenAPI 57 paths, shared `enums.js`, doc hierarchy)

---

## Executive Summary

The three post-V3 enhancement sessions did real, substantial work — and I verified it against the shipped code, not the CHANGELOG. **Observability went from "errors only" to a genuine pre-mortem signal:** `prom-client` now exports an HTTP request histogram, a request counter, and a Postgres pool-saturation gauge at `/metrics` ([metrics.js](../../server/lib/metrics.js), [poolMetrics.js](../../server/lib/poolMetrics.js), [index.js:166-186](../../server/index.js#L166)); an audit trail logs `LOGIN_SUCCESS`/`LOGIN_FAILURE`/`LOGOUT`/`REGISTER` and every `DELETE`/`SETTLE`/`TRANSACTION_CREATE` with `userId`+`reqId` ([auth.js:50-105](../../server/routes/auth.js#L50), [finances.js:226-340](../../server/routes/finances.js#L226)); and [RUNBOOK.md §6.2](../RUNBOOK.md) ships six concrete Prometheus alert expressions. **The API contract is now trustworthy:** the OpenAPI spec grew from 14 paths to **57** (94 `addPath` calls), and CI fails the build if that count drops below 75 ([ci.yml:59-67](../../.github/workflows/ci.yml#L59)). **Accessibility and E2E exist for the first time:** a Playwright suite of 30 tests (smoke + axe-core WCAG-AA on 7 pages × 2 viewports) is wired into a dedicated CI job, the `Modal` now traps and restores focus, and every route sets a document title. The two V3 High findings — the blind `/health` and the transfer-dedup NULL hole — are both closed and the dedup fix is backed by a real-DB integration test ([constraints.int.test.js:58](../../server/test/integration/constraints.int.test.js#L58)).

**But the same trap V3 named — "documented/tested ⇒ correct" — has simply inverted into "built ⇒ shipped," and two regressions prove the gates were not run before merge.** First, **`npm run lint` on the client is RED**: 18 errors. Fifteen are in the brand-new Playwright files (`process`, `Buffer`, `browser` are `no-undef`/`no-unused-vars` because [eslint.config.js](../../client/eslint.config.js) never taught the `e2e/` directory Node or Playwright globals), and three are in the focus-trap `Modal` rewrite (`Math.random()` called during render at [Modal.jsx:36](../../client/src/components/ui/Modal.jsx#L36); `titleId.current` read during render at [:117](../../client/src/components/ui/Modal.jsx#L117) and [:123](../../client/src/components/ui/Modal.jsx#L123)). The client CI job runs `npm run lint` at [ci.yml:105](../../.github/workflows/ci.yml#L105) with no `continue-on-error`, which means **CI is currently failing on `main`** — and that it was failing when the e2e and a11y sessions were merged. Second, the **CHANGELOG stops at Phase 12 and PROJECT_STATE.md never mentions metrics, Playwright, axe, `enums.js`, the focus trap, or the 57-path spec** — there is no "Phase 13+" entry anywhere in `docs/`, `CHANGELOG.md`, or `PROJECT_STATE.md`, even though all of that code is in the tree. V3's single strongest dimension was "documentation is current" (8.5); that pillar has cracked.

**On the technical dimensions alone, the suite improved from 7.7 to ~8.1.** The three laggards V3 flagged — API documentation (6.8), observability (6.8), and accessibility/e2e — are the three biggest climbers. Security holds at the top (zero `npm audit` vulnerabilities on both packages, the V2 critical long gone, now with pino redaction and an audit trail). Backend resilience and DB integrity both rose on the back of the `/health` and dedup fixes. The only technical dimension that *fell* is DevOps maturity, because a green pipeline is the whole point of DevOps maturity and this one is red.

**Then the product-market-fit lens — the new, heavily-weighted §13 — tells the story the technical score cannot.** Scored against *this* user (researcher, engineer, financial manager, task manager, lifelong learner, reader), the suite earns **2.8/10**. The reason is structural and visible in the schema: **every one of the ~25 tables links only to `users(id)`. There is not a single foreign key between modules.** A book bought for research cannot be linked from a Finance transaction to a Research entry; a Learning course cannot reference the three papers it's based on; an Engineering project cannot point at its budget or its reading list. "Search" exists only as a text filter on the Finance transactions list ([finances.js:301](../../server/routes/finances.js#L301)) — there is no cross-module search. Only Research can export its data (JSON/CSV); the other five modules have no export at all. There is no reading tracker, no time tracking outside Learning's manual `spent_hours`, no habits, no goals, and no daily/weekly review. The Dashboard is a handsome **per-module stat board** — but it shows yesterday's counts, not today's agenda, and it omits the Engineer module entirely. **This is six genuinely good single-purpose apps behind one login, not one productivity system.**

**Verdict: still production-ready for its stated single-user scope, and technically stronger than V3 — but the blended score is flat at 7.6 (V3: 7.7), and that flatness is the most honest number in this report.** The engineering is now outrunning the product. The next 6–12 months should not be spent polishing six silos to 9.0; they should be spent building the connective tissue — a universal links table, a unified search, a today-focused dashboard, a reading tracker, and real time tracking — that turns this from a toolkit into the daily operating system its owner actually needs. Fix the red lint gate and re-sync the docs first (both are under an hour), because a CI that's been red through three "finished" sessions is the canary, not the bug.

---

## Quality Gates — Actual Results

All commands executed on 2026-06-11 against the working tree. Output is reported verbatim (trimmed).

| Gate | Command | Result |
|------|---------|--------|
| Server audit | `npm audit` (server) | **0 vulnerabilities** |
| Server lint | `npm run lint` (server) | **clean** (`eslint . --max-warnings 0`) |
| Server unit/integration | `npm test` (server) | **24 passed / 5 skipped** (5 files passed, 3 integration files skip without `DATABASE_URL`) |
| Server integration (no DB) | `npm run test:integration` | **skipped** — all suites `describe.skipIf(!hasDb)`; clean exit |
| OpenAPI generation | `npm run openapi` | **OK — 57 paths written** (`94` `addPath` calls; ≥75 CI gate passes) |
| Client audit | `npm audit` (client) | **0 vulnerabilities** |
| **Client lint** | `npm run lint` (client) | **❌ FAIL — 18 errors** (15 in `e2e/*` + `playwright.config.js`; 3 in `Modal.jsx`) |
| Client build | `npm run build` | **clean**; main `index-*.js` **244.03 KB / 77.77 KB gzip**; `mdeditor-*.js` **1,059.81 KB / 363.28 KB gzip** (lazy) — ⚠️ Vite >500 KB warning persists; `prism` 85 KB; `Research` 43 KB |
| Client test | `npm test` (client) | **5 passed** (1 file: markdown sanitization) |
| Playwright | `npx playwright test --list` | **30 tests in 2 files** (`smoke.spec.js` ×8, `a11y.spec.js` ×7) across `chromium-desktop` + `chromium-mobile`; not executed (needs running stack) |

**Spot checks requested in Phase 2:**
- `docs/openapi.json` is **valid JSON**, **57 paths** (verified by parse + key count).
- `006_fix_dedup_nulls.sql` **exists** (`server/db/migrations/006_fix_dedup_nulls.sql`, 873 bytes).
- `server/Dockerfile` has **`USER node`** (line 9).

### The client lint failure, in full

```
e2e/a11y.spec.js          22:27 'browser' is defined but never used  (no-unused-vars)
                          23:15 'process' is not defined             (no-undef)
e2e/auth.setup.js         20,22,23 'process' is not defined          (no-undef ×4)
e2e/smoke.spec.js         12:27 'browser' never used; 13:15 'process'; 149:15 'Buffer'  (no-undef)
playwright.config.js      6,7,8,9,14,32 'process' is not defined     (no-undef ×6)
src/components/ui/Modal.jsx  36:41 Cannot call impure function during render
                             117:26 / 123:17 Cannot access refs during render
✖ 18 problems (18 errors, 0 warnings)
```

**Root cause:** [eslint.config.js](../../client/eslint.config.js) globs `**/*.{js,jsx}` with `globals: globals.browser` only and ignores nothing but `dist`. The `e2e/` directory and `playwright.config.js` are Node-context files; they need `globals.node` (and the e2e specs receive `browser` from Playwright fixtures). The Modal errors are a genuine React anti-pattern flagged by `eslint-plugin-react-hooks@7`'s `react-hooks/refs` rule. **Because [ci.yml:105](../../.github/workflows/ci.yml#L105) runs `npm run lint` un-guarded, the client CI job fails on `main` today.**

---

## Section Scores

| # | Section | V1 | V2 | V3 | **V4** | Δ V3→V4 |
|---|---------|----|----|----|--------|---------|
| 1 | Security & Authentication (×2.0) | 5.5 | 8.0 | 8.8 | **8.9** | ▲ +0.1 |
| 2 | Backend Resilience & Reliability (×1.5) | 6.0 | 7.0 | 7.6 | **8.2** | ▲ +0.6 |
| 3 | Database Integrity & Data Safety (×1.5) | 7.0 | 7.5 | 7.8 | **8.4** | ▲ +0.6 |
| 4 | Frontend Reliability & Error Resilience (×1.5) | 6.5 | 7.5 | 7.6 | **7.9** | ▲ +0.3 |
| 5 | API Design & Documentation (×1.0) | 7.0 | 7.5 | 6.8 | **8.2** | ▲ +1.4 |
| 6 | Test Suite Quality & Coverage (×1.25) | 3.0 | 6.0 | 7.2 | **7.8** | ▲ +0.6 |
| 7 | DevOps & CI/CD Maturity (×1.25) | 6.0 | 7.5 | 8.0 | **7.5** | ▼ −0.5 |
| 8 | Observability & Debugging (×1.0) | 4.5 | 6.5 | 6.8 | **8.3** | ▲ +1.5 |
| 9 | Performance & Scalability (×1.0) | 5.5 | 6.5 | 7.2 | **7.4** | ▲ +0.2 |
| 10 | UI/UX Quality & Accessibility (×1.0) | 7.0 | 7.5 | 7.4 | **8.1** | ▲ +0.7 |
| 11 | Code Quality & Maintainability (×1.0) | 7.0 | 7.5 | 8.0 | **7.8** | ▼ −0.2 |
| 12 | Long-Term Sustainability & Roadmap (×1.0) | 6.5 | 8.0 | 8.5 | **7.8** | ▼ −0.7 |
| **13** | **Product-Market Fit for Personal Productivity (×1.5)** | — | — | — | **2.8** | **NEW** |
| | **Technical only (12 dims, Σ15.0)** | 6.4 | 7.5 | 7.7 | **8.1** | ▲ +0.4 |
| | **Overall (blended, Σweights = 16.5)** | **6.4** | **7.5** | **7.7** | **7.6** | ▼ −0.1 |

> Two numbers are reported deliberately. **Technical-only = 8.1** (the 12 dimensions, Σ15.0) is the honest measure of how the engineering moved since V3 — up +0.4. **Blended = 7.6** folds in the new §13 Product-Market Fit (×1.5); the slight *drop* despite broad technical gains is the report's central finding: the product dimension is where the value now lives, and it is the weakest.

---

## 1. Security & Authentication — 8.9 / 10

### Strengths
- **Zero `npm audit` vulnerabilities** on both packages (re-run 2026-06-11); the V2 `/me` rate-limit critical remains closed ([index.js:205-207](../../server/index.js#L205): `authLimiter` guards only `/login`+`/register`; `/me`+`/logout` ride `generalLimiter`).
- **pino redaction shipped** (V3 §8.2): `redact: ['req.headers.cookie', 'req.headers.authorization']` ([logger.js:8](../../server/lib/logger.js#L8)) — secrets no longer land in structured logs.
- **Audit trail shipped** (V3 §8.3): structured `event` logs for `REGISTER_SUCCESS`, `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT` ([auth.js:50,75,84,105](../../server/routes/auth.js#L50)) and every mutating `DELETE`/`SETTLE`/`TRANSACTION_CREATE` across all routers, each with `userId`+`reqId`.
- Perimeter intact: helmet CSP (`default-src 'none'`) + prod HSTS ([index.js:145-155](../../server/index.js#L145)); session regeneration on login ([auth.js:80](../../server/routes/auth.js#L80)); bcryptjs cost 12; identical-message user-enumeration mitigation; parameterized SQL + `user_id` scoping in all models; pre-upload ownership gate on attachments.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | `/metrics` is unauthenticated and mounted on the app port ([index.js:179](../../server/index.js#L179)) | Medium | S | Documented mitigation exists ([ARCHITECTURE §9](../ARCHITECTURE.md), RUNBOOK §6.3) — enforce it: block `/metrics` at nginx/Cloudflare, or bind to localhost. Until then, request rates, routes, and pool internals leak to any caller. |
| 1.2 | `LOGIN_FAILURE` logs the attempted **email in plaintext** ([auth.js:75](../../server/routes/auth.js#L75)) | Low | S | Useful for brute-force forensics but is PII in logs; hash or truncate if logs leave the host. |
| 1.3 | No CSRF token — defense is `sameSite: lax` + CORS ([index.js:129](../../server/index.js#L129)) | Medium | M | Carried from V3 §1.2. Upgrade to `sameSite: strict` (the nav model allows it) or add a double-submit token. |
| 1.4 | MIME allowlist includes `application/octet-stream` ([enums.js:23](../../server/lib/enums.js#L23)) | Low | M | Carried from V3; acceptable given `nosniff`+attachment disposition. Magic-byte check if stricter. |

### Detailed Findings

#### Finding 1.1: The metrics endpoint is open by default
**Priority:** Medium — **Source:** [index.js:179-186](../../server/index.js#L179)

The new `/metrics` endpoint is excellent for observability but is mounted unauthenticated on the same Express port the API serves. `productivity_http_requests_total{route,status_code}` and `productivity_pg_pool_connections` reveal traffic shape and DB saturation to anyone who can reach the port. The code comment and ARCHITECTURE §9 both say "restrict via nginx/Cloudflare in prod," which is the right call — but it is advice, not enforcement. In the Docker topology nginx fronts the API, so a one-line `location /metrics { deny all; }` (or allow only the Prometheus scraper) closes it. **Verification:** `curl https://<host>/metrics` from outside the scrape network → `403`.

---

## 2. Backend Resilience & Reliability — 8.2 / 10

### Strengths
- **`/health` now verifies the database** (V3 §2.1 High, closed): `await pool.query('SELECT 1')` → `503 { status: 'degraded' }` on failure ([index.js:191-198](../../server/index.js#L191)). The Docker healthcheck and nginx `depends_on: service_healthy` finally gate on real availability, restoring the auto-restart guarantee.
- **`generalLimiter` is global and ahead of the body parsers** (V3 §2.4): `app.use(generalLimiter)` before `express.json()` ([index.js:103-107](../../server/index.js#L103)) — flood payloads are rejected before the JSON parser allocates.
- **Pool size is env-driven** (V3 §2.3): `parseInt(process.env.PG_POOL_MAX ?? '10', 10)` ([db.js:28](../../server/lib/db.js#L28)); pool errors now go through pino ([db.js:35](../../server/lib/db.js#L35), V3 §2.6).
- `settleLedger` remains genuinely atomic — `BEGIN`/`FOR UPDATE`/`ROLLBACK` on every error path, account ownership re-checked inside the txn ([finance.model.js:591-652](../../server/models/finance.model.js#L591)).
- Graceful shutdown drains HTTP → stops pool metrics → drains pool, 10 s force-exit fallback ([index.js:237-253](../../server/index.js#L237)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | No retry/backoff on transient DB errors (`ECONNREFUSED`/`57P03`) | Medium | M | Carried from V3 §2.2. A small retry wrapper for idempotent reads survives a DB blip without a 500. |
| 2.2 | `migrate.js` diagnostic re-run executes SQL outside a txn | Low | S | Carried from V3 §2.5. Wrap in `BEGIN … ROLLBACK`. |
| 2.3 | `/health` runs a query on every probe with no short statement timeout | Low | S | Add `statement_timeout` (1–2 s) to the health query so a slow/locked DB returns `503` fast rather than hanging the probe. |

---

## 3. Database Integrity & Data Safety — 8.4 / 10

### Strengths
- **The transfer-dedup NULL hole is closed** (V3 §3.1 High): `006_fix_dedup_nulls.sql` recreates `idx_transactions_transfer_dedup` with `NULLS NOT DISTINCT` ([006:15-17](../../server/db/migrations/006_fix_dedup_nulls.sql#L15)), and a real-DB integration test asserts the second NULL-description Transfer raises `23505` ([constraints.int.test.js:58-73](../../server/test/integration/constraints.int.test.js#L58)). This was the one finding that touched financial-data integrity, and it is now proven, not asserted.
- **Legacy `file_path` is no longer a hazard** (V3 §3.3): the column is still written but with the safe relative `req.file.filename` ([research.js:569](../../server/routes/research.js#L569)), and the download/delete paths reconstruct from `filename`, never trusting a stored absolute path ([research.js:416](../../server/routes/research.js#L416)). The host-move footgun is gone; the column is now merely redundant.
- CHECK constraints comprehensive and proven (`amount <> 0` → `23514`; `> 0` on receivables/payables; account/category type enums). Deliberate `ON DELETE` semantics (CASCADE on `user_id`, SET NULL on account refs). Destructive `002` migration refuses to run against a populated ledger ([002:32-40](../../server/db/migrations/002_finance_upgrade.sql#L32)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | Migrations are forward-only, no `down` step | Low | L | Carried from V3 §3.2. Adopt `dbmate`/`node-pg-migrate` when convenient; keep pre-DROP snapshot discipline. |
| 3.2 | `research_attachments.file_path` column is now dead weight | Low | S | Drop the column in a future migration, or document it as deprecated; nothing reads it. |
| 3.3 | No cross-module referential integrity exists (by design, but now the chief *product* constraint) | Medium (product) | L | See §13.1 and the roadmap — a universal `links` table is the recommended additive solution. |

---

## 4. Frontend Reliability & Error Resilience — 7.9 / 10

### Strengths
- **The `Modal` now traps and restores focus** (V3 §4.2): Tab/Shift+Tab cycle within the dialog, body scroll locks, first focusable auto-focuses, and the opener is re-focused on close ([Modal.jsx:39-88](../../client/src/components/ui/Modal.jsx#L39)). A smoke test asserts the trap (`smoke.spec.js` "modal focus trap: Tab cycles within dialog").
- **E2E coverage exists** (V3 §4.1): Playwright smoke tests cover login → dashboard, create-transaction-via-modal, research upload→download, dark-mode toggle, and mobile navigation.
- `ErrorBoundary` wraps `<App/>`; `429` is handled distinctly from `401`; `useApi` guards post-unmount `setState`; Research and all Engineer pages are `React.lazy` + `<Suspense>` ([App.jsx:25-32](../../client/src/App.jsx#L25)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | **`Modal` focus-trap rewrite introduced 3 lint errors** ([Modal.jsx:36,117,123](../../client/src/components/ui/Modal.jsx#L36)) | High | S | `Math.random()` in the `useRef` initializer runs every render (waste) and reads the ref during render (anti-pattern). Replace with React 18's `useId()`: `const titleId = useId();` then use `titleId` directly. Fixes both the impurity and both ref-read errors. |
| 4.2 | Only **1 client unit test file** (5 assertions); component/page unit tests still absent | Medium | L | Carried from V3 §4.3. The Playwright suite covers happy paths but needs a running stack; add React Testing Library tests for the create/settle modals. |
| 4.3 | `navigator.clipboard` (citation copy) silently no-ops on non-secure contexts | Low | S | Carried from V3 §4.4. Feature-detect + "copy manually" toast. |

#### Finding 4.1: The focus trap works but fails the lint gate
**Priority:** High — **Source:** [Modal.jsx:36](../../client/src/components/ui/Modal.jsx#L36), [:117](../../client/src/components/ui/Modal.jsx#L117), [:123](../../client/src/components/ui/Modal.jsx#L123)

The modal functionally traps focus (the smoke test exercises it), so this is not a runtime defect — it is a quality-gate defect that has been sitting on `main`. `titleId = useRef(`modal-title-${Math.random()…}`)` calls an impure function during render and then reads `titleId.current` in JSX twice. `eslint-plugin-react-hooks@7` flags all three. The fix is one line:
```jsx
import { useId } from 'react';
// …
const titleId = useId();           // stable, render-safe
// aria-labelledby={titleId}  /  id={titleId}
```
**Verification:** `npm run lint` (client) drops from 18 errors to the 15 e2e-config errors; fix the eslint config (§7.1) and it reaches 0.

---

## 5. API Design & Documentation — 8.2 / 10

### Strengths
- **The OpenAPI spec is now real** (V3 §5.1, the dimension's defining gap): **57 paths** (verified by parse), up from 14 — covering auth, todos, finances + receivables/payables/portfolio/budgets/accounts/categories/dashboard, research + topics/tags/stats/attachments/export/bulk, all engineer routes, and `/health`+`/metrics`. The generator registers them via 94 `addPath` calls ([generate-openapi.js](../../server/scripts/generate-openapi.js)).
- **CI gates on completeness**: the client/server pipeline fails if `addPath` count drops below 75 ([ci.yml:59-67](../../.github/workflows/ci.yml#L59)) — a spec that rots is now a build break.
- Consistent envelope (`{success,data,meta?}` / `{success,error:{code,message,reqId,field?}}`); the `DUPLICATE_TRANSFER` code + `field` hint from Phase 11 ([errorHandler.js:15-24](../../server/middleware/errorHandler.js#L15)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | CI gate counts `addPath` calls in the **script**, not paths in the **emitted spec** | Low | S | The proxy is decent (94 ≥ 75) but could pass while the spec is malformed. Add a step that parses `docs/openapi.json` and asserts `Object.keys(paths).length ≥ 50` and valid JSON. |
| 5.2 | No API versioning (`/api/v1`) | Low | M | Documented decision ([ARCHITECTURE §Key Design Decisions](../ARCHITECTURE.md)); correct for single-tenant. The re-mount trigger is recorded. |
| 5.3 | Query params validated ad-hoc, not via Zod like bodies | Low | M | Carried from V3 §5.3. Optional `validateQuery` for list endpoints. |

---

## 6. Test Suite Quality & Coverage — 7.8 / 10

### Strengths
- **Integration suite deepened**: `constraints.int.test.js` now proves the zero-amount CHECK (`23514`), the non-NULL Transfer dedup (`23505`), **and** the NULL-description dedup added in Phase 12; plus cross-user isolation and settle-rollback suites. All wrapped in `describe.skipIf(!hasDb)` so the fast suite stays green everywhere ([db.setup.js](../../server/test/integration/db.setup.js)).
- **E2E suite exists**: 30 Playwright tests (smoke + axe a11y), with a dedicated CI `e2e` job that boots Postgres + server + client and runs them on push ([ci.yml:115-201](../../.github/workflows/ci.yml#L115)).
- **Coverage tooling added**: `test:coverage` script + a CI step ([ci.yml:78-80](../../.github/workflows/ci.yml#L78)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | Coverage step is `continue-on-error: true` with **no floor** | Medium | S | Carried from V3 §6.1 (V3 said "floor not yet set" — still not set). Set a realistic floor (e.g. 60 % lines on `server/models` + `routes`) and drop `continue-on-error`. |
| 6.2 | E2E job runs **only on push, not PR** ([ci.yml:120](../../.github/workflows/ci.yml#L120)) | Medium | S | A regression merges green and only breaks the post-merge run. Run e2e on PRs too (it's the highest-value gate for a UI-heavy app), or at least nightly. |
| 6.3 | Client unit coverage is effectively one file | Medium | L | Carried from V3 §6.4. |
| 6.4 | The lint failure means the e2e/a11y tests **have never passed CI** | High | S | They cannot have — the client lint job blocks the pipeline before e2e runs (`needs: [server, client]`). Confirm green after §4.1/§7.1 fixes. |

---

## 7. DevOps & CI/CD Maturity — 7.5 / 10

### Strengths
- **Container hardening** (V3 §7.1): `server/Dockerfile` adds `chown -R node:node /app` + `USER node` (line 9).
- **Runtime parity** (V3 §7.2): both CI jobs pin `node-version: 22` ([ci.yml:40,93](../../.github/workflows/ci.yml#L40)), matching the `node:22-alpine` images.
- **Pipeline breadth grew**: an OpenAPI-completeness gate, a coverage step, and a full e2e job (Postgres service + Playwright browsers + server/client boot + screenshot-on-failure artifact upload).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | **CI is RED on `main`: the client `Lint` step fails** ([ci.yml:105](../../.github/workflows/ci.yml#L105)) | **Critical** | S | Add `globals.node` (and Playwright's `browser` global) for `e2e/**` + `playwright.config.js` in [eslint.config.js](../../client/eslint.config.js), and fix the 3 Modal errors (§4.1). A red pipeline that shipped through three "finished" sessions means the gates were bypassed. |
| 7.2 | Coverage floor still unset; e2e PR-skipped | Medium | S | See §6.1, §6.2. |
| 7.3 | Backup sidecar `apk add aws-cli` at container start; no "last backup age" alert | Medium | M | Carried from V3 §7.3. |
| 7.4 | No resource limits / log-rotation on compose services | Low | S | Carried from V3 §7.4. |

#### Finding 7.1: The pipeline is failing and nobody noticed
**Priority:** Critical — **Source:** [ci.yml:104-106](../../.github/workflows/ci.yml#L104), [eslint.config.js](../../client/eslint.config.js)

This is the most consequential operational finding in V4. The client job runs `npm run lint` with no `continue-on-error`; the lint script is `eslint . --max-warnings 0`; the working tree produces 18 errors. Therefore the client job exits non-zero, and because the `e2e` job declares `needs: [server, client]`, **the e2e and a11y suites never run.** All three were introduced together; the commit history (`Session 2 finished`, `Final cleanup`) shows them landing on `main`. The only way that happens with a red gate is that the gate was not consulted. The fix is small (config + `useId`), but the *process* signal is large: re-enable branch protection so a red CI blocks merge, and treat the green check as load-bearing again.

---

## 8. Observability & Debugging — 8.3 / 10

### Strengths
- **Metrics, finally** (V3 §8.1, the dimension's defining gap): `prom-client` with default process metrics (`productivity_` prefix), an HTTP duration histogram (10 ms–10 s buckets) and request counter labelled `method/route/status_code`, and a pool gauge sampling `total`/`idle`/`waiting` every 15 s with `.unref()` ([metrics.js](../../server/lib/metrics.js), [poolMetrics.js](../../server/lib/poolMetrics.js)). Exposed at `/metrics` ([index.js:179](../../server/index.js#L179)), recorded by middleware ([index.js:166-174](../../server/index.js#L166)), and started/stopped with the server lifecycle.
- **Alert rules documented** (V3 §8.1): six concrete Prometheus expressions — high error rate, p99 latency, pool exhaustion, pool near-capacity, `/health` 503s, scrape-down — in [RUNBOOK §6.2](../RUNBOOK.md).
- **Audit trail** (V3 §8.3) and **pino redaction** (V3 §8.2): see §1.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | Alert rules are **documented but not shipped** (no Alertmanager/Prometheus config in-repo) | Medium | M | The expressions are great; commit a `deploy/prometheus/` with the rules and a scrape config so they're deployable, not retyped. |
| 8.2 | No distributed tracing / APM span timing inside requests | Low | L | `reqId` correlation is good post-mortem; tracing (e.g. OpenTelemetry) is the next tier when needed. |
| 8.3 | Metrics route label cardinality uses `req.path` fallback ([index.js:170](../../server/index.js#L170)) | Low | S | For un-matched routes `req.path` can explode label cardinality (e.g. `/api/finances/12345`). Prefer `req.route?.path` and bucket the rest as `unknown` (already the fallback — verify dynamic IDs don't leak through). |

---

## 9. Performance & Scalability — 7.4 / 10

### Strengths
- Main chunk **244 KB / 77.8 KB gzip**; editor + prism vendor-split and lazy ([vite.config.js:12-25](../../client/vite.config.js#L12)); `mdeditor` not requested on the dashboard.
- Pool saturation is now **observable** (the `productivity_pg_pool_connections` gauge), so the previously-invisible scaling ceiling is at least instrumented.
- Parameterized queries with indexes on every filtered column; dashboard/portfolio aggregates computed in SQL (`generate_series`, `FILTER`, derived columns in [finance.model.js:660-668](../../server/models/finance.model.js#L660)), not N+1.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | `mdeditor` chunk is **1,060 KB / 363 KB gzip** — still trips Vite's >500 KB warning | Medium | M | Carried from V3 §9.1. Acceptable (lazy + cached) for single-user; revisit only if mobile data cost matters. |
| 9.2 | Uploads single-node local disk (R2 plan unimplemented) | Medium (High before multi-replica) | L | Carried from V3 §9.2. Execute RUNBOOK §4 behind a flag when scaling. |
| 9.3 | Lazy per-user `ensureDefaults` on the read path | Low | M | Carried from V3 §9.3. Move into the registration transaction. |

---

## 10. UI/UX Quality & Accessibility — 8.1 / 10

### Strengths
- **Focus trap + restore** in every dialog (§4); **per-route titles** via `useDocumentTitle` (restores the previous title on unmount — [useDocumentTitle.js](../../client/src/hooks/useDocumentTitle.js)), used on Dashboard and asserted by a smoke test.
- **Automated a11y**: `@axe-core/playwright` runs a WCAG-AA audit on 7 authenticated pages × 2 viewports ([a11y.spec.js](../../client/e2e/a11y.spec.js)) — the first programmatic accessibility coverage in the project's history.
- Consistent design system, four-state lists, dark mode, toasts, `role="dialog"`/`aria-modal`/`aria-labelledby` on the modal.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | a11y suite **cannot have passed CI** (blocked behind the red client lint job) | Medium | S | Same fix as §7.1; then confirm the axe assertions are actually green, not merely written. |
| 10.2 | axe checks 7 pages but **omits Engineer pages and modal-open states** | Low | M | Add the engineer routes and an "open a modal then audit" case — modals are the densest interactive surface. |
| 10.3 | No documented light/dark contrast or keyboard walkthrough artifact | Low | S | Capture an axe HTML report as a CI artifact for the record. |

---

## 11. Code Quality & Maintainability — 7.8 / 10

### Strengths
- **Shared enums extracted** (V3 §11.1): `server/lib/enums.js` centralizes `TODO_STATUSES`, `LEARNING_*`, `ENTRY_*`, `TX_TYPES`, `LEDGER_STATUSES`, `PROJECT_*`, `ISSUE_*`, and the upload allowlists — the magic-string drift V3 flagged is gone on the server.
- Disciplined routes→models→db layering; DRY helpers; heavy JSDoc; snake_case DB / camelCase JS; server linted clean.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | **Client lint is red** (§4.1, §7.1) — the codebase ships an anti-pattern and an unconfigured test dir | High | S | The single highest-ROI cleanup in the report. |
| 11.2 | `enums.js` is **server-only**; the client re-declares its own status/label maps | Low | M | V3 said "mirror to client"; not done. A shared `enums` module (or generated constants) removes client/server drift. |
| 11.3 | ARCHITECTURE.md tells future devs to create `006_user_settings.sql`, but `006` is already `006_fix_dedup_nulls.sql` ([ARCHITECTURE §Planned](../ARCHITECTURE.md), [006](../../server/db/migrations/006_fix_dedup_nulls.sql)) | Low | S | Renumber the planned migration to `007_`; a literal follow-through would collide. |
| 11.4 | No type checking (`checkJs`/`// @ts-check`) | Low | M | Carried from V3 §11.2. |

---

## 12. Long-Term Sustainability & Roadmap — 7.8 / 10

### Strengths
- `ARCHITECTURE.md` is now explicitly canonical ([line 3](../ARCHITECTURE.md)) and `PROJECT_STATE.md` is demoted to a phase log (V3 §12.2, done); the OpenAPI contract is complete and CI-gated (V3 §12.1, done).
- RUNBOOK covers backup/off-host/restore-drill/rotation/incidents/alerting; ARCHITECTURE documents the full schema, middleware order, and design decisions.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | **CHANGELOG + PROJECT_STATE never recorded the post-V3 work** | **High** | S | No mention of prom-client/metrics, Playwright/e2e, axe, focus trap, `enums.js`, per-route titles, or the 57-path spec; no "Phase 13+" entry exists in `docs/`, `CHANGELOG.md`, or `PROJECT_STATE.md`. The CHANGELOG's top entry is Phase 12. V3's best dimension was "docs are current"; restore it. |
| 12.2 | The `user_settings` table remains "planning only" while the docs reference a now-colliding migration number | Low | S | See §11.3; also a prerequisite for the personalization roadmap below. |
| 12.3 | No feature-flag mechanism for risky rollouts | Low | M | Carried from V3 §12.3 — and now needed for the cross-module rollout in the roadmap. |

#### Finding 12.1: The record-keeping fell behind the code
**Priority:** High — **Source:** [CHANGELOG.md](../../CHANGELOG.md), [PROJECT_STATE.md](../../PROJECT_STATE.md)

A grep of both files for `prom-client|metrics|playwright|axe|e2e|focus trap|enums|Phase 1[3-9]` returns only the package-deps line and the old Phase 5 "Observability" heading. The metrics stack, the entire e2e/a11y suite, the shared enums, the per-route titles, and the 57-path OpenAPI spec — all present in the tree, all unrecorded. For a single-user project this is low operational risk, but it is the exact erosion of the "onboarding < 30 min, docs match reality" property that earned this dimension 8.5 in V3. It also compounds the §7.1 process signal: code is being shipped without running gates *or* updating the canonical log. Add a "Phase 13–15" CHANGELOG block and a PROJECT_STATE update; gate "CHANGELOG touched" in the PR template if you want it enforced.

---

## 13. Product-Market Fit for Personal Productivity — 2.8 / 10

> The decisive new dimension. Scored against *this* user — researcher, engineer, financial manager, daily task manager, lifelong learner, and reader — not a generic app. Every score below cites the schema or the code.

### 13.1 Cross-Module Integration — 0.7 / 3

**The schema settles this question: there is not one foreign key between modules.** Every per-user table references only `users(id) ON DELETE CASCADE`. I read all ten migrations; the only cross-table FKs that exist are *within* a module (research entry↔topic pivot, engineer issues/checkins/docs→`engineer_projects`, budgets→categories). There is no entity that can point from one module's row to another's.

- **Research entry ↔ Finance transaction?** Impossible. There is no `transaction.research_id` or any link table. "Bought this book for research — Rp 250k" cannot be expressed.
- **Learning item → Research entries?** Impossible. `learning_items` ([20240103](../../server/db/migrations/20240103_create_learning.sql)) has no reference to `research_entries`.
- **Engineering project → Research / Learning / Finance?** Impossible. `engineer_projects` ([003](../../server/db/migrations/003_engineer_toolkit.sql)) links only to its own children.
- **Cross-module dashboard widgets?** The Dashboard ([Dashboard.jsx](../../client/src/pages/Dashboard.jsx)) renders four modules' stats side-by-side and four "recent activity" cards — genuine multi-module *display*, but no correlation, no links, and **no Engineer module at all**. This earns the 0.7.
- **Cross-module search?** No. The only `search` parameter in the entire API is a text filter on the Finance transactions list ([finances.js:301](../../server/routes/finances.js#L301)). There is no endpoint that queries across todos + research + learning + engineer + finance.

**This is the single largest gap between what the app is and what its owner needs.** The six modules are co-located, not connected.

### 13.2 Workflow Support — 1.0 / 2

- **Morning routine** ("today's tasks + today's finance + today's learning on one screen"): **partial.** The Dashboard shows *totals* (pending/in-progress/done counts, net worth, hours logged) but nothing is **date-scoped to today** — there is no "due today," no "today's spend," no "today's goal." It answers "how am I doing overall," not "what do I do now."
- **Research session** (capture → link refs → track time → attach): **partial.** Capture (entry), tag/topic, and attach all work; **linking references and tracking time do not exist.**
- **Engineering sprint** (tasks + issues + check-ins together): **weak.** Issues, check-ins, snippets, docs, and roadmap are five separate pages ([App.jsx:102-108](../../client/src/App.jsx#L102)); planning a sprint means hopping between them, and project tasks live in a *different module* (Todo) with no link back to the project.
- **Financial review** (budget vs actual + receivables aging + portfolio in one view): **weak.** Each is its own page (`/finance/budget`, `/finance/receivables`, `/finance/portfolio`); there is a `FinanceDashboard` but no single aging+budget+portfolio review surface.
- **Reading workflow**: **absent** (see §13.5).

### 13.3 Data Portability & Longevity — 0.75 / 2

- **Export everything?** No. Only **Research** exports ([research.js:213](../../server/routes/research.js#L213), JSON/CSV, capped at 10k rows). Todos, Finance, Learning, and the entire Engineering toolkit have **no export route**.
- **Single "export all" button?** No.
- **Open formats?** Research export is JSON/CSV (good) — but it's 1 of 6 modules.
- **Migrate to another tool?** Only by direct DB access. The schema *is* well-documented ([ARCHITECTURE §Database Schema](../ARCHITECTURE.md)), so a technical user could `pg_dump` and transform — which is why this isn't a zero.
- **Schema documented for future extraction?** Yes — this is the saving grace and the reason for the 0.75.

### 13.4 Personalization & Adaptability — 1.0 / 2

- **Customize categories/tags/topics?** Yes, broadly: finance categories and accounts are seeded but user-extendable; research topics are user-created with colors; snippet categories are free-text; comma-separated tags are everywhere.
- **Hide unused modules?** No — the sidebar ([AppLayout.jsx](../../client/src/components/layout/AppLayout.jsx)) is fixed.
- **Configure/reorder dashboard widgets?** No — the Dashboard layout is hardcoded.
- **Sensible defaults out of the box?** Yes — `ensureDefaults` seeds accounts/categories/roadmap lazily.
- **Server-side preferences?** No — `user_settings` is "planning only" ([ARCHITECTURE §Planned](../ARCHITECTURE.md)); theme lives in `localStorage`, so it doesn't follow the user across devices.

### 13.5 Missing Capabilities — −0.65 / (−1 … 0)

Honest gap analysis against the stated identity:

- **Reading list / book tracker:** **missing.** `learning_items` has a `'book'` type and `url`/`notes`, but no current-page, chapter, rating, "want to read / reading / finished" shelf, or annual reading stats. For an "avid reader," this is the most conspicuous hole.
- **Time tracking:** **mostly missing.** Only Learning has `total_hours`/`spent_hours`, edited by hand. No task timer, no project time log, no pomodoro, no "where did my week go."
- **Habit tracking:** **missing.** No table, no streaks.
- **Goal setting / OKRs:** **missing.** No cross-module goals.
- **Daily/Weekly review:** **missing.** No "what did I accomplish this week" rollup across modules.

Five of the canonical personal-productivity loops are absent; the deduction is near the floor.

### 13.6 Total for §13

0.7 + 1.0 + 0.75 + 1.0 − 0.65 = **2.8 / 10.**

**Interpretation:** as *six separate tools*, the quality is high — the Finance ledger in particular is genuinely sophisticated (multi-account, atomic settle, portfolio, budgets). As *one productivity system for this person*, it is a set of silos with a shared login and a stat board. The score is low not because anything is broken, but because the connective tissue that turns tools into a system was never built.

---

## The Vision: 6-12 Month Roadmap

The architecture is clean and consistent — Express route → model → parameterized SQL; React page → modal → hook. **Every feature below is additive** (new tables, routes, pages, components) and follows those patterns. They are sequenced so each unlocks the next.

### Quick Wins (S–M effort, High impact)

#### Feature: Today Dashboard (date-scoped briefing)
- **Problem:** The Dashboard shows lifetime totals, not "what do I do today." The morning-routine workflow (§13.2) is unmet.
- **Integration:** Reuses existing endpoints; adds date-filtered variants (`?due=today`, `?date=today`). Surfaces Todo (due today/overdue), Finance (today's spend, outstanding receivables/payables due this week), Learning (in-progress items), and — finally — Engineer (open P0/P1 issues, this week's check-in).
- **Implementation:** New `client/src/pages/Today.jsx` (or a Dashboard mode toggle); add `GET /api/todos?due=today` filter and a `GET /api/finances/dashboard?window=today` aggregate (the model already does `FILTER`/`generate_series`). No schema change.
- **Effort:** S | **Impact:** High

#### Feature: Universal Export ("Download all my data")
- **Problem:** Only Research exports (§13.3); the user's financial and learning history is trapped.
- **Integration:** All modules.
- **Implementation:** `GET /api/export` streams a single ZIP of per-table JSON (+ optional CSV), reusing each model's `list*`. One new route, one `client` button in a Settings page. Cap + stream to avoid the memory cliff (mirror the research export's 10k cap).
- **Effort:** M | **Impact:** High

#### Feature: Fix-the-Gates hardening (lint, CI, docs)
- **Problem:** §7.1 red CI, §4.1 Modal, §12.1 doc drift — the foundation the rest of the roadmap builds on.
- **Implementation:** `useId()` in Modal; `globals.node` for `e2e/**` in eslint config; run e2e on PRs; set a coverage floor; backfill CHANGELOG/PROJECT_STATE Phases 13–15.
- **Effort:** S | **Impact:** High (unblocks every later PR's CI signal)

### Medium Builds (M–L effort, High–Transformative impact)

#### Feature: Universal Links ("connect anything to anything")
- **Problem:** The §13.1 silo problem — the root cause of the low PMF score.
- **Integration:** Every module.
- **Implementation:** One polymorphic table:
  ```sql
  CREATE TABLE entity_links (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_type   VARCHAR(40) NOT NULL,  -- 'transaction'|'research_entry'|'learning_item'|'engineer_project'|'todo'
    from_id     INTEGER NOT NULL,
    to_type     VARCHAR(40) NOT NULL,
    to_id       INTEGER NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, from_type, from_id, to_type, to_id)
  );
  ```
  A `links.model.js` validates that both endpoints are owned by the user (the ownership pattern already exists), `GET/POST/DELETE /api/links?type=&id=` returns "related items," and a shared `<LinkedItems>` React component renders on every detail modal. Soft references (type+id, not FKs) keep it module-agnostic and migration-light.
- **Effort:** L | **Impact:** **Transformative** — this is the single feature that most raises §13.
- **Dependencies:** none; everything cross-module builds on it.

#### Feature: Unified Search
- **Problem:** No cross-module search (§13.1).
- **Integration:** All modules.
- **Implementation:** `GET /api/search?q=` runs a `UNION ALL` over `to_tsvector`/`ILIKE` across `todos.title`, `research_entries.title|content|tags`, `learning_items.title|notes`, `engineer_*`, and `transactions.description`, returning `{type, id, title, snippet}`. Add a Postgres GIN index per searchable column. A command-palette (`Ctrl/Cmd-K`) in `AppLayout` is the UI.
- **Effort:** M | **Impact:** High

#### Feature: Reading Tracker
- **Problem:** The "avid reader" identity is entirely unserved (§13.5).
- **Integration:** Extends Learning; links (via Universal Links) to Research entries (notes per book) and Finance (book purchases).
- **Implementation:** Either extend `learning_items` (add `current_page`, `total_pages`, `rating`, `shelf ∈ want|reading|finished`, `started/finished_at`) or a dedicated `books` table. A `/reading` page with shelves and an annual "books finished" stat. Reading notes are Research entries linked to the book.
- **Effort:** M | **Impact:** High
- **Dependencies:** Universal Links (for notes/purchases).

#### Feature: Time Tracking
- **Problem:** No task/project time (§13.5).
- **Implementation:** `time_entries (user_id, entity_type, entity_id, started_at, ended_at, seconds, note)`; a start/stop timer component reusable on Todo, Learning, Research, and Engineer detail views; a weekly time report. Feeds the Weekly Review.
- **Effort:** M | **Impact:** High
- **Dependencies:** none (uses the same soft-reference shape as Links).

### Moonshots (L–XL effort, Transformative impact)

#### Feature: Weekly Review & Goals
- **Problem:** No reflection loop, no cross-module goals (§13.5).
- **Implementation:** A `goals` table (title, target, due, linked entities via Universal Links) + a generated weekly digest ("12 tasks done, Rp 3.4M spent vs Rp 4M budget, 2 books progressed, 1 issue closed, 5.5 h logged"). A `/review` page; optionally a scheduled email/push. This is where Links + Time Tracking + Today pay off as a system.
- **Effort:** L | **Impact:** Transformative
- **Dependencies:** Universal Links, Time Tracking, Today Dashboard.

#### Feature: PWA + Offline + Reminders
- **Problem:** Daily tools live on the phone; reminders (due dates, payables) have no delivery channel.
- **Implementation:** Vite PWA plugin (service worker, installable), IndexedDB cache for reads, and web-push for due-date/payable reminders. Pairs with the planned `user_settings` for notification prefs.
- **Effort:** XL | **Impact:** High
- **Dependencies:** `user_settings`.

#### Feature: Local AI Assist (summarize / auto-tag / semantic search)
- **Problem:** Research/Reading volume outgrows manual tagging and keyword search.
- **Implementation:** A small embeddings model (or an API behind a flag) to auto-suggest tags, summarize long research entries, and power semantic search via `pgvector`. Strictly additive and flag-gated.
- **Effort:** XL | **Impact:** Transformative (for the researcher/reader specifically)
- **Dependencies:** Unified Search, feature-flag mechanism (§12.3).

### Dependency Graph

```
[Fix-the-Gates] ──► (unblocks CI for everything below)

[Today Dashboard] ─────────────┐
[Universal Export] (standalone) │
                                ▼
                       [Universal Links] ──┬──► [Reading Tracker]
                                           │
[Time Tracking] ───────────────────────────┤
                                           │
[Unified Search] ──────────────┐           │
                               ▼           ▼
                        [Local AI Assist]  [Weekly Review & Goals]
                                                   ▲
                                   [Today Dashboard]┘

[user_settings] ──► [PWA + Reminders]
```

---

## V3 → Post-V3 Remediation Ledger — Verified

Every V3 Top Action / planned post-V3 item, checked against the shipped code on 2026-06-11.

| V3 Item | V3 Priority | Session | Actually Fixed? | Evidence |
|---------|-------------|---------|-----------------|----------|
| `/health` DB check | High | Quick Wins | ✅ | [index.js:191-198](../../server/index.js#L191) — `SELECT 1` → 503 |
| Transfer dedup `NULLS NOT DISTINCT` | High | Quick Wins | ✅ | [006_fix_dedup_nulls.sql](../../server/db/migrations/006_fix_dedup_nulls.sql) + [constraints.int.test.js:58](../../server/test/integration/constraints.int.test.js#L58) |
| `USER node` + Node 22 CI | Medium | Quick Wins | ✅ | Dockerfile:9 `USER node`; [ci.yml:40,93](../../.github/workflows/ci.yml#L40) `node 22` |
| `vitest --coverage` | Medium | Quick Wins | ⚠️ Partial | Script + CI step exist, but `continue-on-error: true` and **no floor** ([ci.yml:78-80](../../.github/workflows/ci.yml#L78)) |
| pino redact | Low | Quick Wins | ✅ | [logger.js:8](../../server/lib/logger.js#L8) |
| `PG_POOL_MAX` env + global limiter | Low | Quick Wins | ✅ | [db.js:28](../../server/lib/db.js#L28); [index.js:103](../../server/index.js#L103) |
| prom-client `/metrics` | Medium | Sesi 1 | ✅ | [metrics.js](../../server/lib/metrics.js), [poolMetrics.js](../../server/lib/poolMetrics.js), [index.js:179](../../server/index.js#L179) |
| Audit trail logging | Medium | Sesi 1 | ✅ | [auth.js:50-105](../../server/routes/auth.js#L50); [finances.js:226-340](../../server/routes/finances.js#L226); DELETE logs in all routers |
| Alerting runbook | Medium | Sesi 1 | ✅ | [RUNBOOK §6.2](../RUNBOOK.md) — 6 Prometheus rules |
| Playwright e2e | Medium | Sesi 2 | ⚠️ Built, but **blocked by red lint** + PR-skipped | [smoke.spec.js](../../client/e2e/smoke.spec.js); 30 tests listed; CI lint gate fails before e2e runs |
| axe-core a11y | Medium | Sesi 2 | ⚠️ Built, same block | [a11y.spec.js](../../client/e2e/a11y.spec.js) — 7 pages × 2 viewports |
| Modal focus trap | Medium | Sesi 2 | ✅ functional / ⚠️ **3 lint errors** | [Modal.jsx:39-88](../../client/src/components/ui/Modal.jsx#L39) traps; [:36,117,123](../../client/src/components/ui/Modal.jsx#L36) fail lint |
| Per-route titles | Low | Sesi 2 | ✅ | [useDocumentTitle.js](../../client/src/hooks/useDocumentTitle.js); used on Dashboard; smoke title test |
| Complete OpenAPI spec | Medium | Sesi 3 | ✅ | **57 paths** (from 14); 94 `addPath` |
| OpenAPI CI gate | Medium | Sesi 3 | ✅ (proxy metric) | [ci.yml:59-67](../../.github/workflows/ci.yml#L59) — ≥75 `addPath`; counts script not spec (§5.1) |
| `server/lib/enums.js` | Low | Sesi 3 | ✅ (server only) | [enums.js](../../server/lib/enums.js); not mirrored to client (§11.2) |
| Legacy `file_path` stop | Low | Sesi 3 | ✅ (backfilled to `= filename`) | [research.js:569](../../server/routes/research.js#L569) stores `req.file.filename`; download reconstructs from `filename` ([:416](../../server/routes/research.js#L416)) |
| Documentation hierarchy | Low | Sesi 3 | ⚠️ Partial | ARCHITECTURE canonical + PROJECT_STATE demoted ✅, but **CHANGELOG/PROJECT_STATE not updated for post-V3 work** (§12.1) |

**Tally: 12 fully fixed, 6 partial/regressed.** The partials cluster around *process*, not *capability*: coverage has no floor, the e2e/a11y/Modal work is functionally complete but trips (or is blocked by) the lint gate, and the docs didn't keep up. The features landed; the gates and the ledger did not.

---

## Cross-Cutting Themes

1. **The engineering is outrunning the product.** Technical-only score rose 7.7 → 8.1; the three V3 laggards (API docs, observability, a11y) are the three biggest climbers. Yet the blended score is flat at 7.6 because the value of a *personal* productivity tool now lives in §13 — integration, workflows, portability — and that dimension scores 2.8. More polishing of six silos cannot move the number that matters; only connective tissue can.

2. **"Documented/tested ⇒ correct" has inverted into "built ⇒ shipped."** V3's recurring trap was features that *looked* done (a spec covering 30% of routes, a `/health` that checked nothing). V4's is features that *are* done but were merged without running the gates: the client lint is red, the e2e/a11y suites consequently never ran in CI, and the CHANGELOG never recorded any of it. The capability is real; the verification and the record are missing.

3. **The schema is the product strategy, and right now it says "six apps."** Not one inter-module foreign key exists across ~25 tables. Every roadmap item that raises §13 — Links, Search, Reading, Review — is really a request to let the schema express relationships it currently forbids. The single highest-leverage technical decision for the next year is adding the soft-reference `entity_links` table.

4. **Observability matured from post-mortem to pre-mortem — but stopped at "documented."** Metrics, a pool gauge, and six alert expressions now exist, closing V3's "observability stops at errors." The next stop is "observability stops at the README": the alert rules are prose in the RUNBOOK, not a deployable Prometheus config, and `/metrics` is open by default.

5. **Single-node and single-user assumptions are still the consciously-deferred ceiling — and now the product ceiling too.** Local-disk uploads and an in-process pool are fine for one user (V3's theme, unchanged). But the same single-user framing is why there's no `user_settings`, no cross-device prefs, and no reason yet to build the connective features — the architecture is *correct* for today and *limiting* for the tool's owner's actual life.

---

## Top Actions (ranked by priority × impact × feasibility)

| # | Action | Type | Priority | Effort | Impact |
|---|--------|------|----------|--------|--------|
| 1 | Fix client lint: `useId()` in Modal + `globals.node` for `e2e/**` in eslint config; re-green CI | Technical | **Critical** | S | Unblocks the e2e/a11y suites and every future PR's CI signal |
| 2 | Backfill CHANGELOG/PROJECT_STATE for Phases 13–15 (metrics, e2e/a11y, OpenAPI, enums) | Technical | High | S | Restores the doc-currency that defined §12 |
| 3 | **Universal Links table** (`entity_links`) + shared `<LinkedItems>` | Product | High | L | Transformative for §13 — the root fix for the silo problem |
| 4 | Today Dashboard (date-scoped) incl. the Engineer module | Product | High | S–M | Closes the morning-routine workflow gap |
| 5 | Universal Export (`GET /api/export` ZIP of all modules) | Product | High | M | Closes the data-portability gap (§13.3) |
| 6 | Set a coverage floor + run e2e on PRs (not just push) | Technical | Medium | S | Makes the new test infra load-bearing |
| 7 | Unified cross-module search + `Cmd-K` palette | Product | Medium | M | Closes the no-cross-search gap (§13.1) |
| 8 | Reading Tracker (extend Learning) + Time Tracking | Product | Medium | M | Serves the "reader" and fills the time-tracking hole |
| 9 | Ship Prometheus config + lock `/metrics` behind nginx | Technical | Medium | M | Turns documented alerts into deployed alerts; closes §1.1 |
| 10 | Renumber planned `user_settings` migration to `007`; then build it | Technical | Low | S→M | Unblocks personalization + PWA prefs; fixes the doc collision |

---

## Path to 9.0+ (Technical) and Product Excellence

**Technical → 9.0+ (from 8.1, the cheapest points first):**
1. **Re-green CI and re-sync docs (Effort S, < 1 h).** Action #1 + #2. This alone lifts §7 back toward 8.5+, §11 to ~8.2, §12 to ~8.5, and lets §10's a11y suite actually prove itself. → technical ~8.4.
2. **Make the new infra load-bearing (Effort S–M).** Coverage floor + e2e-on-PR (§6), Prometheus config + `/metrics` lockdown (§1.1, §8.1). Lifts §6 to ~8.3, §8 to ~8.7, §1 to ~9.0. → technical ~8.7.
3. **Resilience + contract polish (Effort M).** DB retry wrapper (§2.1), spec-parse CI assertion (§5.1), client-mirrored enums (§11.2). → **technical ~9.0.**

**Product excellence — what "great" looks like for *this* person:**
A personal productivity tool is excellent when it removes the friction between roles. The benchmark is a single morning screen that says: *"3 tasks due today; you're Rp 600k over the Food budget this month; the receivable from Andi is due Friday; you're 40% through *Designing Data-Intensive Applications* — the 2 papers you linked are in Research; the LoRa project has 1 open P0; you logged 4.5 h yesterday."* Reaching that requires exactly the roadmap's spine — **Universal Links → Today Dashboard → Search → Reading/Time → Weekly Review** — built on the clean route→model→SQL pattern that's already here. Get §13 from 2.8 to ~7 and the blended score clears 8.5, because the ×1.5 dimension finally pulls *with* the technical gains instead of against them.

---

## Overall Score: 7.6 / 10

**Technically, this is the strongest the suite has ever been (8.1 on the 12 dimensions, up from 7.7).** The post-V3 sessions closed every laggard V3 named — the API contract, observability, and accessibility/e2e — and the two V3 High findings are fixed and, in the dedup case, proven against real Postgres. Zero audit vulnerabilities, an audit trail, redacted logs, a DB-aware health check, container hardening, and a 57-path CI-gated spec are all real and verified.

**But two things keep the blended score from rising. First, the gates regressed even as capability grew:** the client lint is red on `main`, which means the e2e and a11y suites have never run in CI, and the CHANGELOG/PROJECT_STATE never recorded the work — the build-but-don't-verify inversion of V3's old trap. Both are sub-hour fixes, but they signal that the green check stopped being load-bearing. **Second, and more fundamentally, the new product-market-fit lens scores 2.8/10:** the schema has not one foreign key between modules, only Research can export, and there is no reading tracker, time tracking, habits, goals, or review. As six tools this is very good; as one system for a researcher-engineer-financier-learner-reader, it is six tools.

**The verdict is therefore split and honest. It remains production-ready for its stated single-user scope — run it with confidence.** But the next 6–12 months should pivot from hardening to *connecting*: re-green CI and re-sync the docs this week, then build the Universal Links table, the Today dashboard, universal export, search, and a reading tracker. That is the path from a polished toolkit to the daily operating system its owner actually deserves — and the path from 7.6 to a genuine 8.5+.
