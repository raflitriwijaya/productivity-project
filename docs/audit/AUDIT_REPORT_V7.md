# Audit V7 — Polymath OS: The Consolidation Audit

**Auditor:** Distinguished Systems Architect & Principal SRE
**Date:** 2026-06-13
**Repository:** `productivity-project` (React 19 + Vite/Rolldown / Node 22 + Express 5 / PostgreSQL 16 + pgvector)
**Scope:** Verification audit — confirm all 10 V6 gaps closed, check for regressions, score the 13-dimension framework honestly
**Previous:** V6 (8.4 blended / 8.6 technical, 2026-06-13)
**50-Year Lens (§14):** Out of scope this audit — a separate document (`docs/audit/50_YEAR_LENS.md`)

---

## Executive Summary

**The consolidation wave is real, and it is good — but it shipped the way real waves ship: fast, complete in substance, and trailing a thin comet-tail of housekeeping debt.** I re-ran all nine quality gates and read every changed file on 2026-06-13. The headline is unambiguous: **all ten V6 gaps are implemented in shipped code**, and I verified each one against the artifact, not the CHANGELOG's claim of it. The AI egress is now documented in `docs/SECURITY.md` with the exact data categories that leave the host and the local-only escape hatch ([SECURITY.md:40-70](../SECURITY.md#L40)); the README finally describes the whole system instead of the Wave-1 seventh of it ([README.md:8-46](../../README.md#L8)); the theme cross-device read path is wired end-to-end (`useTheme` now exports `hydrateFromServer`, called from `AppLayout` with the server-side `settings.theme` — [useTheme.js:35-52](../../client/src/hooks/useTheme.js#L35), [AppLayout.jsx:101-102](../../client/src/components/layout/AppLayout.jsx#L101)); the export ZIP bundles `server/uploads/` into an `attachments/` folder ([export.js:139-181](../../server/routes/export.js#L139)); a reminders channel exists (bell + OS notification + a 5-module `/due` aggregate — [notifications.js](../../server/routes/notifications.js)); habit streaks are derived, calendar-rendered, and check-in-toggleable ([goals.model.js:280-378](../../server/models/goals.model.js#L280), [GoalDetailModal.jsx:123](../../client/src/components/goals/GoalDetailModal.jsx#L123)); the AI upstream is instrumented (`aiUpstreamDuration` observed in both chat paths + embeddings, two new Prometheus alert rules — [chat.js:215-280](../../server/routes/chat.js#L215), [alert_rules.yml:40-51](../../deploy/prometheus/alert_rules.yml#L40)); and the Engineer Sprint Board + Finance Overview consolidate thirteen fragmented pages into two one-screen dashboards, both reachable from the sidebar nav ([EngineerSprint.jsx](../../client/src/pages/EngineerSprint.jsx), [FinanceOverview.jsx](../../client/src/pages/FinanceOverview.jsx), [AppLayout.jsx:32,60](../../client/src/components/layout/AppLayout.jsx#L32)).

**The new code is, line for line, the best in the repository.** The Sprint Board and Finance Overview reuse existing components rather than re-declaring them (`FinanceOverview` pulls in `MonthYearSelector`, `ProgressBar`, and the `TransactionRow` badge — [FinanceOverview.jsx:27-29](../../client/src/pages/FinanceOverview.jsx#L27)), the new server endpoints reuse existing model functions and add **no new SQL** (`/api/engineer/sprint` calls `listOpenIssues()`/`getRoadmap()` — [engineer.js:158-160](../../server/routes/engineer.js#L158)), and the habit feature makes the textbook correct schema choice: **streaks are derived from consecutive `log_date` rows, not stored**, so there is nothing to keep in sync ([018_habit_logs.sql:6-9](../../server/db/migrations/018_habit_logs.sql#L6)). Migration `017` and `018` follow the §6.5 conventions to the letter. This is additive evolution executed exactly as the Six Invariants prescribe.

**But this is a verification audit, and honesty is the job — so here are the four things the fast wave left behind, none functional, all real.** First, **the working tree is dirty.** The entire Engineer/Finance consolidation — `App.jsx`, `AppLayout.jsx`, `engineer.js`, `finances.js` (modified) plus `EngineerSprint.jsx`, `FinanceOverview.jsx` (untracked) — is **uncommitted** (`git status`). This is the *exact* property V6 celebrated closing (V5 §7.3: "the goals fix made `main` and the working tree disagree… Resolved — `git status` is empty"). It has regressed. Second, **the contract did not grow.** OpenAPI is still 93 paths from 145 `addPath` calls — identical to V6 — which means **seven new endpoints** (`/engineer/sprint`, `/finances/overview`, three `/notifications/*`, two `/goals/:id/habit-log*`) ship **undocumented in the spec**. Third, **the test suite did not move at all** — server holds at 35 passed / 15 skipped, client at 8, Playwright at 46 / 15 pages — so a whole wave of product code, including the non-trivial streak-derivation logic, shipped with **zero new tests and no a11y audit of the two new dashboards**. Fourth, **the main bundle nearly doubled** (262.63 KB → 493.63 KB; gzip 83.29 → 130.01) because the two consolidation pages are eagerly imported. And a fifth, smaller echo of V6's own theme: **CONTRIBUTING.md is stale again** — it was fixed from `008_` to "latest is `016_`, next is `017_`," but the wave that added `017` and `018` left it pointing at `016` ([CONTRIBUTING.md:86](../../CONTRIBUTING.md#L86)).

**Verdict: the product leapt; the engineering held.** **PMF rises 7.6 → 8.3 (+0.7)** — the single largest mover — because four named V6 gaps closed at once: workflow consolidation (the biggest V6 workflow gap), attachments-in-export (true "everything" export), the theme read-path, and a real notification channel. **Technical-only holds flat at 8.6**: genuine gains in Observability (AI instrumentation, +0.2), Database (two exemplary migrations, +0.1), Security (egress disclosed, +0.1), and Sustainability (the forward roadmap now *exists*, +0.1) are offset, almost exactly, by the debt the wave accrued — Test (−0.2), DevOps (dirty tree, −0.2), API (undocumented endpoints, −0.1), Performance (bundle, −0.1). **The 13-dimension blended is 8.6** (PMF ×2.0, §14 excluded per scope), up ~0.1 on a like-for-like basis. The story of V7 is not "+0.2, all green." It is: *the system shipped its most valuable product wave to date and proved it can consolidate — and it now owes itself a short, cheap cleanup wave (commit the tree, document the seven endpoints, test the streak logic, split the bundle) before the next era begins.*

---

## Quality Gates — Actual Results

Every command executed on **2026-06-13** against the working tree. **9/9 green.** ⚠️ **Working tree is NOT clean** (see DevOps §7).

| Gate | Command | Result |
|------|---------|--------|
| Server audit | `npm audit` (server) | ✅ **found 0 vulnerabilities** |
| Server lint | `npm run lint` (server) | ✅ **clean** (`eslint . --max-warnings 0`, exit 0) |
| Server tests | `npm test` (server) | ✅ **35 passed / 15 skipped** (7 files passed / 4 integration files skip without `DATABASE_URL`) — `Duration 3.38s` — *unchanged from V6* |
| OpenAPI generation | `npm run openapi` | ✅ **93 paths written** (145 `addPath` calls) — *identical to V6; new endpoints not added* |
| Client audit | `npm audit` (client) | ✅ **found 0 vulnerabilities** |
| Client lint | `npm run lint` (client) | ✅ **clean** (exit 0) |
| Client build | `npm run build` | ✅ **clean** — main `index-D43P1_qQ.js` **493.63 KB / 130.01 KB gzip** (⬆ from V6's 262.63 / 83.29); `mdeditor` **1,059.81 KB / 363.28 KB gzip** (lazy); `prism` 85.37 KB (lazy); ⚠️ Vite >500 KB warning persists; **PWA sw.js** — **29 precache entries / 1,817 KiB**; `built in 1.85s` |
| Client tests | `npm test` (client) | ✅ **8 passed** (2 files) — *unchanged from V6* |
| Playwright | `npx playwright test --list` | ✅ **46 tests in 2 files** (`smoke.spec.js` + `a11y.spec.js`, 15 pages) — *unchanged from V6; new dashboards not audited* |

**Spot checks (all by command this audit):**

| Check | V6 | **V7** | Method |
|-------|----|--------|--------|
| `docs/openapi.json` paths | 93 | **93** | `npm run openapi` output |
| `addPath` calls in generator | 145 | **145** | `grep -c addPath server/scripts/generate-openapi.js` |
| Migration files | 20 | **22** | Glob `server/db/migrations/*.sql` (+`017`, +`018`) |
| Client pages | 29 | **31** | Glob `client/src/pages/*.jsx` (+`EngineerSprint`, +`FinanceOverview`) |
| Server routers | 19 | **20** | Glob `server/routes/*.js` (+`notifications.js`) |
| `deploy/prometheus/` yml | 2 | **2** | `prometheus.yml` + `alert_rules.yml` |
| `alert_rules.yml` rules | 6 | **8** | +`AIUpstreamHighLatency`, +`AIUpstreamTimeoutRate` |
| `client/src/lib/enums.js` | ✅ | ✅ | Glob |
| `client/src/lib/notifications.js` | ❌ | ✅ | Glob — Notification API + poll store |
| `HabitCalendar.jsx` | ❌ | ✅ | Glob — rendered in `GoalDetailModal` |
| `NotificationBell.jsx` | ❌ | ✅ | Glob — sidebar + mobile |
| `EngineerSprint.jsx` / `FinanceOverview.jsx` | ❌ | ✅ | Glob — nav-reachable |
| `export.js` attachment bundling | ❌ | ✅ | reads `uploads/`, archives `attachments/` |
| `server/routes/notifications.js` | ❌ | ✅ | subscribe / status / due |
| `metrics.js` `aiUpstreamDuration` | ❌ | ✅ | `productivity_ai_upstream_duration_seconds` |
| `useTheme` exports `hydrateFromServer` | ❌ | ✅ | called in `AppLayout` |
| **Working tree** | **clean** | **⚠️ dirty** | 4 modified + 2 untracked, uncommitted |

---

## Section Scores

| # | Dimension | Weight | V6 | **V7** | Δ |
|---|-----------|--------|-----|--------|---|
| 1 | Security & Authentication | ×2.0 | 9.0 | **9.1** | ▲ +0.1 |
| 2 | Backend Resilience & Reliability | ×1.5 | 8.7 | **8.7** | — |
| 3 | Database Integrity & Data Safety | ×1.5 | 8.7 | **8.8** | ▲ +0.1 |
| 4 | Frontend Reliability & Error Resilience | ×1.5 | 8.5 | **8.6** | ▲ +0.1 |
| 5 | API Design & Documentation | ×1.0 | 8.6 | **8.5** | ▼ −0.1 |
| 6 | Test Suite Quality & Coverage | ×1.25 | 8.5 | **8.3** | ▼ −0.2 |
| 7 | DevOps & CI/CD Maturity | ×1.25 | 8.7 | **8.5** | ▼ −0.2 |
| 8 | Observability & Debugging | ×1.0 | 8.6 | **8.8** | ▲ +0.2 |
| 9 | Performance & Scalability | ×1.0 | 7.7 | **7.6** | ▼ −0.1 |
| 10 | UI/UX Quality & Accessibility | ×1.0 | 8.6 | **8.6** | — |
| 11 | Code Quality & Maintainability | ×1.0 | 8.3 | **8.3** | — |
| 12 | Long-Term Sustainability & Roadmap | ×1.0 | 8.7 | **8.8** | ▲ +0.1 |
| 13 | **Product-Market Fit** | **×2.0** | 7.6 | **8.3** | ▲ **+0.7** |
| | **Technical-only (dims 1-12, Σ15.0)** | | 8.6 | **8.6** | — |
| | **Blended 13-dim (dims 1-13, Σ17.0, PMF ×2.0)** | | 8.5* | **8.6** | ▲ +0.1 |

> **\*Basis note.** V6's *headline* blended of **8.4** was over Σ19.0 and **included §14 (the 50-Year Lens) at ×2.0**. This audit excludes §14 by scope, so the comparable basis is the 13-dimension blend over Σ17.0. Stripping §14 from V6's numbers gives V6 a 13-dim blended of **8.5** (144.05 / 17.0); V7 is **8.6** (145.55 / 17.0). The +0.1 is honest and entirely PMF-driven.

**Blended math (V7, 13-dim):** Σ(score × weight) = **145.55** over Σweights **17.0** = **8.56 → 8.6.** Technical-only (dims 1-12) = **128.95 / 15.0 = 8.60 → 8.6.** Weights: dims 1-12 = 15.0; PMF ×2.0; total 17.0.

> **The shape, in one line.** Technical flat (8.6), PMF up sharply (+0.7), blended up a touch (+0.1). The wave bought *product*, not *engineering hardening* — and accrued a little debt doing it. That is the correct, honest shape for a consolidation audit, and it is different from "everything went up."

---

## 1. Security & Authentication — 9.1 / 10  (×2.0)

### Strengths
- **The project's longest-standing trust-debt is paid.** The AI egress to DeepSeek — un-actioned across V5 §1.1 and V6 §1.1, called "the one cheapest win" three audits running — is now documented in `docs/SECURITY.md`'s new **"Third-Party Data Egress"** section ([SECURITY.md:40-70](../SECURITY.md#L40)). It names the provider, the exact data categories transmitted (chat text + injected entity context; research text for embeddings), the destination (`DEEPSEEK_BASE_URL`), and the **local-only escape hatch** (`deepseek-r1-local` via Ollama → "No data leaves the host"). It even documents the AbortController ceilings. This is exactly the disclosure V6 demanded.
- **The three new surfaces inherited the discipline exactly.** `/api/notifications`, plus the new `/engineer/sprint` and `/finances/overview` endpoints, are all mounted behind `requireAuth` ([index.js:230,227,244](../../server/index.js#L226)); every query is `req.user.id`-scoped and parameterized ([notifications.js:71-115](../../server/routes/notifications.js#L71)); the push-subscribe body is Zod-validated with a `.url()` endpoint and a typed `keys` object ([notifications.js:24-27](../../server/routes/notifications.js#L24)); the `push_subscriptions` upsert is keyed on `UNIQUE (user_id, endpoint)` so one user can never overwrite another's subscription ([017_push_subscriptions.sql:32](../../server/db/migrations/017_push_subscriptions.sql#L32)).
- **Carried, intact:** helmet CSP + prod HSTS, session regeneration, bcryptjs cost 12, parameterized SQL everywhere, secrets server-side only, pre-upload ownership check, the export's 10k-row-per-module cap.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | **The root `SECURITY.md` is a stale duplicate.** The egress section was added to `docs/SECURITY.md`, but a second `SECURITY.md` at the repo root (dated 2026-06-11) still has **no egress section** — and the root is the file GitHub surfaces in the Security tab | Low (docs) | XS | Either delete the root copy in favour of `docs/SECURITY.md`, or backport the egress section. Two security policies that disagree is worse than one. |
| 1.2 | `/metrics` still unauthenticated at the app port ([index.js](../../server/index.js)) | Low | S | Carried from V5/V6. Edge-blocked by nginx; bind to localhost or add a bearer check for defence-in-depth. |
| 1.3 | No CSRF token — defence is `sameSite: lax` + CORS | Medium | M | Carried. Documented as a known limitation. |
| 1.4 | The export now bundles attachment **files** as well as rows, widening the unthrottled-request surface (§2/§9) | Low | S | Single-user-benign; add a per-user export rate limit if multi-tenant. |

**Net:** the fundamentals are pristine and the cheapest, oldest disclosure gap is finally closed — the one move that most earns a security bump. The only new note is a self-inflicted one: two `SECURITY.md` files now disagree. **9.1 (▲ +0.1).**

---

## 2. Backend Resilience & Reliability — 8.7 / 10  (×1.5)

### Strengths
- **The new endpoints are fail-safe by construction.** `/notifications/status` runs two queries via `Promise.all` and degrades gracefully — a missing settings row yields `enabled: true` rather than a 500 (`settings?.notifications_enabled ?? true`, [notifications.js:58](../../server/routes/notifications.js#L58)); `/notifications/due` bounds every module query with `LIMIT 10` and a 7-day window ([notifications.js:75-115](../../server/routes/notifications.js#L75)); the client poll store shares a single in-flight request and **leaves the last data intact on any failure** ([client notifications.js:58-72](../../client/src/lib/notifications.js#L58)).
- **The consolidation endpoints add no new failure modes.** `/engineer/sprint` and `/finances/overview` reuse existing, already-hardened model functions (`listOpenIssues`, `getRoadmap`, `listBudgets`, `listPortfolio`) rather than introducing new SQL ([engineer.js:158-160](../../server/routes/engineer.js#L158), [finances.js:171-173](../../server/routes/finances.js#L171)).
- **Carried:** AbortController on all three AI upstreams, `archive.on('error')` + `res.headersSent` guards in export, DB-aware `/health`, atomic `settleLedger`, graceful shutdown.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | The export now also reads the uploads directory and streams files mid-ZIP; a missing/locked file is caught and written as `attachments/_ERROR.txt` ([export.js:174-178](../../server/routes/export.js#L174)) — good, but the whole export remains one unbounded request | Low | M | Carried from V6 §2.3; stream module-by-module + per-user rate limit if data grows. |
| 2.2 | No retry/backoff on transient DB errors | Medium | M | Carried from V3-V6. |
| 2.3 | The reminder channel is **client-poll-driven** (1-hour `setInterval`), not server-pushed — if the tab is closed, no reminder fires | Low (by design) | M | The `push_subscriptions` table is the substrate for true VAPID web-push later (honestly documented at [017:4-7](../../server/db/migrations/017_push_subscriptions.sql#L4)). |

**Net:** the new code maintains the suite's fail-safe standard without adding a single new resilience mechanism or a single new risk. No movement either way. **8.7 (—).**

---

## 3. Database Integrity & Data Safety — 8.8 / 10  (×1.5)

### Strengths
- **`018_habit_logs.sql` makes the correct, hard schema choice.** Streaks are **derived** from consecutive `log_date` rows in `deriveStreak`, never stored ([goals.model.js:280-311](../../server/models/goals.model.js#L280)) — "so there is nothing to keep in sync" ([018:6-9](../../server/db/migrations/018_habit_logs.sql#L6)). Rows are insert/delete-only, so there is correctly **no `updated_at` and no trigger**; the table carries `UNIQUE (user_id, goal_id, log_date)` and two purpose-built indexes. The streak semantics are right: it counts back from today *or yesterday* — "a streak isn't broken until a whole day is missed" ([goals.model.js:282-283](../../server/models/goals.model.js#L282)). This is the kind of detail that separates an engineer from a generator.
- **`017_push_subscriptions.sql` is a §6.5 model citizen:** `SERIAL` PK, `user_id` FK `ON DELETE CASCADE`, `JSONB` keys, `TIMESTAMPTZ` timestamps, the shared `set_updated_at()` trigger, `UNIQUE (user_id, endpoint)` doubling as the upsert key, and `DROP … CASCADE` re-runnability.
- **`current_value` is kept honest.** Toggling a habit recomputes the streak and **mirrors it onto `goals.current_value`** ([goals.model.js:343-346](../../server/models/goals.model.js#L343)) so the existing `GoalCard`/stats surfaces reflect it without a schema change — additive evolution.
- **Carried:** the `getGoalStats` fix, `user_settings`, 22-type `entity_links` synced across three layers, the self-healing migration runner (now 22 files, sequential, no conflicts).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | Migrations remain forward-only (no `down`) | Low | L | Carried from V4-V6; conscious trade, recovery = restore-from-backup. |
| 3.2 | `recalcGoalProgress` still on-demand for non-habit goals | Low | — | Carried. |
| 3.3 | `research_attachments.file_path` remains dead weight | Low | S | Carried; the new export reads from the uploads dir + `filename`, confirming `file_path` is unused. |

**Net:** two new migrations, both exemplary, and the habit feature avoids an entire class of denormalization-drift bug by deriving rather than storing. The schema keeps evolving additively. **8.8 (▲ +0.1).**

---

## 4. Frontend Reliability & Error Resilience — 8.6 / 10  (×1.5)

### Strengths
- **The V6 §4.2 theme read-path gap is closed.** `useTheme` now exports `hydrateFromServer(serverTheme)` ([useTheme.js:35-52](../../client/src/hooks/useTheme.js#L35)); `AppLayout` calls it in an effect keyed on `settings?.theme` ([AppLayout.jsx:101-102](../../client/src/components/layout/AppLayout.jsx#L101)), so a fresh device now pulls the saved server theme instead of falling back to `prefers-color-scheme`. The "follow me across devices" promise is fully delivered.
- **The reminder surface is defensively built.** A module-level store with **one shared poll loop** keeps multiple `<NotificationBell>` instances (sidebar + mobile) in sync from a single fetch/interval, idempotent under StrictMode ([client notifications.js:33-120](../../client/src/lib/notifications.js#L33)); permission is requested **only on the bell click** (a user gesture), never auto-prompted on load ([NotificationBell.jsx:4](../../client/src/components/layout/NotificationBell.jsx#L4)); a failed poll leaves the last data intact.
- **Both new dashboards follow the four-state pattern** (loading skeleton — never a spinner — / error-with-retry / empty / data), with the `isEmpty` guard computed from the payload ([EngineerSprint.jsx:137-184](../../client/src/pages/EngineerSprint.jsx#L137), [FinanceOverview.jsx:146-189](../../client/src/pages/FinanceOverview.jsx#L146)).
- **Carried:** `ErrorBoundary` at the root, `429`≠`401`, post-unmount `setState` guards, lazy Research + Engineer toolkit pages, ⌘K palette, installable PWA.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | **Client unit coverage is still 2 files / 8 assertions** for **31** pages — and the wave's new surfaces (Sprint, Overview, the poll store, the theme hydrate path, the habit calendar) add **zero** tests | Medium | L | Carried and *widened* from V6 §4.1. The gap grew by two untested pages. |
| 4.2 | `FinanceOverview`/`EngineerSprint` are eagerly imported, unlike the lazy Engineer toolkit pages ([App.jsx:17-18](../../client/src/App.jsx#L17)) — a frontend-weight choice (§9) | Low | S | Lazy-load them behind `<Suspense>` like the rest. |
| 4.3 | SSE stream still has no client-side timeout/abort UI | Low | S | Carried from V5/V6. |

**Net:** the theme read-path — a named V6 gap — is closed, and the new surfaces are all built to fail safe. The persistent (now slightly wider) drag is the thin client unit-test base. **8.6 (▲ +0.1).**

---

## 5. API Design & Documentation — 8.5 / 10  (×1.0)

### Strengths
- **The envelope and validation held through every new endpoint.** `/notifications/*` returns `{ success, data }` and Zod-validates the subscribe body ([notifications.js:31,41](../../server/routes/notifications.js#L31)); `/goals/:id/habit-log` throws the standard `400 VALIDATION_ERROR` with a `field` hint when the goal isn't a habit ([goals.js:152-153](../../server/routes/goals.js#L152)); dates are normalised to `'YYYY-MM-DD'` via `to_char` so client calendar comparisons line up regardless of pg serialization — a thoughtful, documented contract detail ([notifications.js:13-14](../../server/routes/notifications.js#L13)).
- **The new endpoints reuse existing query shapes** rather than inventing new ones, keeping the surface legible.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | **Seven new endpoints are absent from the OpenAPI spec.** `addPath` is still **145** and the spec still **93 paths** — identical to V6 — yet this wave added `GET /engineer/sprint`, `GET /finances/overview`, `POST /notifications/subscribe`, `GET /notifications/status`, `GET /notifications/due`, `POST /goals/:id/habit-log`, `GET /goals/:id/habit-logs`. The contract now **under-documents** the system | **Medium** | S | Add the seven `addPath` calls. This is the first audit where the spec *regressed* in relative coverage. |
| 5.2 | **The CI OpenAPI gate still counts `addPath` in the script, not paths in the spec** ([ci.yml:61](../../.github/workflows/ci.yml#L61)) | Low | S | **Un-actioned from V4/V5/V6 §5.1.** And note the irony: because the gate counts the generator, it would not have caught 5.1 either. Parse `docs/openapi.json` and assert `Object.keys(paths).length`. |
| 5.3 | No API versioning | Low | M | Documented decision with a revisit trigger. |

**Net:** the design discipline (envelope, Zod, date normalization) is intact and the new endpoints are well-shaped — but for the first time the *documentation* fell behind the *implementation*, leaving seven endpoints out of the contract. A small, honest dock. **8.5 (▼ −0.1).**

---

## 6. Test Suite Quality & Coverage — 8.3 / 10  (×1.25)

### Strengths
- **The load-bearing gates from V6 still hold:** the server coverage floor (`--coverage.thresholds.lines=60 …`, no `continue-on-error`, [ci.yml:78](../../.github/workflows/ci.yml#L78)) and e2e-on-PR ([ci.yml:3-7](../../.github/workflows/ci.yml#L3)) are intact, and the existing suite is green (35 passed / 15 skipped server; 8 client; 46 Playwright).
- The `getGoalStats` regression test and the integration suite (`constraints`, `isolation`, `links`, `settle`) against real Postgres remain.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | **A full product wave shipped with zero new tests.** Server tests are *unchanged* at 35/15; the **`deriveStreak` streak logic** — the most algorithmically non-trivial new code, with off-by-one "broken only after a full missed day" semantics — has **no unit test**, exactly the kind of logic V6 praised covering for `getGoalStats` | **Medium** | M | Add unit tests for `deriveStreak`/`toggleHabitLog` and an integration test for `/notifications/due`. The streak edge cases (today-not-yet-logged, gaps) deserve assertions. |
| 6.2 | **The two new dashboards are not a11y-audited.** Playwright is *unchanged* at 46 / 15 pages; `EngineerSprint` and `FinanceOverview` — both nav-reachable — are absent from `a11y.spec.js` | Medium | S | Add the two pages to the axe sweep (the cheapest test win this wave). |
| 6.3 | **Client coverage floor still not in CI** — the client job is still plain `npm test` with no `--coverage` ([ci.yml](../../.github/workflows/ci.yml)) | Medium | S | Carried from V6 §6.1 (Roadmap 1.9, not done). Mirror the server floor, start low, ratchet. |

**Net:** nothing *broke* — the gates and the existing suite are green — but the test suite did not keep pace with a wave that added two pages, three routers' worth of endpoints, and a non-trivial streak algorithm. Test-debt accrued. **8.3 (▼ −0.2).**

---

## 7. DevOps & CI/CD Maturity — 8.5 / 10  (×1.25)

### Strengths
- **Monitoring got more capable.** `alert_rules.yml` grew from 6 to **8 rules** with two AI-specific additions — `AIUpstreamHighLatency` and `AIUpstreamTimeoutRate` ([alert_rules.yml:40-51](../../deploy/prometheus/alert_rules.yml#L40)) — now that the upstream is instrumented (§8). The Prometheus config remains deployable (commented-in compose service).
- **The pipeline rigor from V6 is intact:** lint (0 warnings), `npm audit`, OpenAPI completeness gate, real-Postgres migrations + integration tests, the server coverage floor, full Playwright with screenshot artifacts.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | **The working tree is dirty — a regression of a property V6 explicitly celebrated.** `git status` shows `App.jsx`, `AppLayout.jsx`, `engineer.js`, `finances.js` modified and `EngineerSprint.jsx`, `FinanceOverview.jsx` untracked — the **entire Engineer/Finance consolidation is uncommitted.** V6 §7 (resolving V5 §7.3) read: "The working tree is clean… `git status` is empty." That is no longer true | **Medium** | XS | **Commit the consolidation.** Until then `main` and the running code disagree — the exact integrity gap V5/V6 closed. |
| 7.2 | OpenAPI gate counts the script, not the spec ([ci.yml:61](../../.github/workflows/ci.yml#L61)) | Low | S | See §5.2; carried from V4-V6. |
| 7.3 | Client coverage still absent from CI ([Roadmap 1.9](../ROADMAP_FORWARD.md)) | Medium | S | See §6.3. |
| 7.4 | Backup-freshness alert / resource limits still absent | Low | M | Carried; `alert_rules.yml` is the home once a backup-timestamp metric exists. |

**Net:** the AI alert rules are a real monitoring gain, but two CI items remain open from V6 *and* the clean-working-tree property — a hard-won V5→V6 win — regressed. The dirty tree is the single most actionable item in the whole audit, and it costs this dimension. **8.5 (▼ −0.2).**

---

## 8. Observability & Debugging — 8.8 / 10  (×1.0)

### Strengths
- **The V6 §8.1 gap is closed precisely as prescribed.** `aiUpstreamDuration` (`productivity_ai_upstream_duration_seconds`, [metrics.js:29-30](../../server/lib/metrics.js#L29)) is `observe()`d in the `finally` block of **both** chat paths — Ollama and DeepSeek — with `{ provider, model, status }` labels and seconds duration ([chat.js:215-280](../../server/routes/chat.js#L215)), and in the embeddings fetch ([embeddings.js](../../server/lib/embeddings.js)). Because the label includes `status`, **timeouts and errors are captured, not just successes** — so the AbortController behaviour V6 added is now *measurable*. Two alert rules consume it (§7).
- **The new mutations are logged to the structured-event convention:** `HABIT_TOGGLE` logs userId/goalId/action/streak/reqId ([goals.js:159](../../server/routes/goals.js#L159)); the notification and consolidation routes inherit pino request logging.
- **Carried:** prom-client HTTP histogram/counter + pool gauge, pino redaction, Sentry-on-DSN, the 8-rule alert set.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | The export's new attachment-bundling has no size/duration metric | Low | M | Carried/extended from V6 §8.2; an `export_bytes` counter would catch the §9 memory concern. |
| 8.2 | No distributed tracing/APM | Low | L | Carried. |

**Net:** the highest-value missing instrument from V6 — AI upstream latency/timeout visibility — is now in place and alert-backed, and the new mutations are logged. The clearest technical win of the wave. **8.8 (▲ +0.2).**

---

## 9. Performance & Scalability — 7.6 / 10  (×1.0)

### Strengths
- **The new server endpoints are SQL-efficient.** `/finances/overview` and `/engineer/sprint` reuse existing aggregations (no N+1, no new SQL); `/notifications/due` is five **bounded** (`LIMIT 10`, 7-day-window) parallel queries; habit toggle/streak are single indexed lookups on `(user_id, goal_id, log_date)`.
- **AbortController still bounds AI tail latency**, now observable via the new histogram.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | **The main bundle nearly doubled: 262.63 KB → 493.63 KB (gzip 83.29 → 130.01).** The two consolidation pages are **eagerly imported** ([App.jsx:17-18](../../client/src/App.jsx#L17)) rather than lazy-loaded like the Engineer toolkit pages, and the wave's other client additions (bell, poll store, habit calendar) land in the main chunk too | **Medium** | S | Lazy-load `FinanceOverview`/`EngineerSprint` behind `<Suspense>`. 130 KB gzip is still acceptable in absolute terms, but a ~56% gzip jump in one wave is the wrong direction and the cheapest to reverse. |
| 9.2 | `mdeditor` chunk **1,059.81 KB** still trips Vite's >500 KB warning | Medium | M | Carried from V4-V6 (lazy + cached). |
| 9.3 | Export now loads rows **and** streams attachment files in one request | Low (single-user) | M | See §2.1. |
| 9.4 | Single-node uploads / in-process pool | Medium/Low | L | The consciously-deferred ceiling (Roadmap Phase 3, trigger-gated). |

**Net:** the backend stayed efficient, but the frontend initial payload grew materially in a single wave because the new pages weren't code-split. One easy fix would recover most of it. **7.6 (▼ −0.1).**

---

## 10. UI/UX Quality & Accessibility — 8.6 / 10  (×1.0)

### Strengths
- **Two genuine workflow dashboards landed, and they're polished.** The Sprint Board puts active projects (with open-critical counts), the P0/P1 queue, this week's check-in, and upcoming roadmap skills on **one screen** with quick-action buttons ([EngineerSprint.jsx](../../client/src/pages/EngineerSprint.jsx)); the Finance Overview puts net, receivables/payables aging, budget-vs-actual, portfolio, and recent transactions on one screen with a month/year selector ([FinanceOverview.jsx](../../client/src/pages/FinanceOverview.jsx)). Both are reachable from the sidebar ("Sprint Board," "Overview" — [AppLayout.jsx:32,60](../../client/src/components/layout/AppLayout.jsx#L32)) and additive — every detail page stays reachable.
- **The notification bell is a real, considered surface:** due-today badge, week-ahead dropdown, outside-click/Escape close, permission-on-gesture, dual placement (sidebar + mobile).
- **The theme now follows the user cross-device** (the §4.2 completion), and habit goals render a check-in **calendar with streak** in their detail modal ([GoalDetailModal.jsx:123](../../client/src/components/goals/GoalDetailModal.jsx#L123)).
- **Carried:** focus trap + restore, per-route titles, ⌘K palette, grouped sidebar, four-state lists, dark mode, global Export.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | **a11y coverage did not extend to the new dashboards** — `a11y.spec.js` is unchanged at 15 pages; `EngineerSprint`/`FinanceOverview` are unaudited (§6.2) | Medium | S | The two pages should join the axe sweep. |
| 10.2 | Modal-open / mid-SSE-stream states still aren't axe-audited | Low | M | Carried from V6 §10.1 — and the new habit calendar lives *inside* a modal, so this matters more now. |

**Net:** the wave delivered the richest UX additions since the AI chat — two consolidation dashboards, a notification bell, a habit calendar, cross-device theming — but a11y test coverage stood still while the page count grew. UX up, accessibility-assurance flat → net flat. **8.6 (—).**

---

## 11. Code Quality & Maintainability — 8.3 / 10  (×1.0)

### Strengths
- **The new code is the cleanest in the repo and rigorously additive.** `FinanceOverview` reuses `MonthYearSelector`/`ProgressBar`/`TransactionRow` ([FinanceOverview.jsx:27-29](../../client/src/pages/FinanceOverview.jsx#L27)); `EngineerSprint` reuses the `ProjectRow`/`IssueRow` variant maps ([EngineerSprint.jsx:24-28](../../client/src/pages/EngineerSprint.jsx#L24)); the consolidation endpoints reuse existing model functions and add **no new SQL**. Every new file opens with a *why*-comment tying it to its V6 finding.
- **The route→model→SQL and component→hook→API spines held without erosion** across two pages, three routers' worth of endpoints, and two migrations. A developer who knows one router knows these.
- **The habit feature's derive-don't-store design** is a maintainability asset: no denormalized streak to drift, no reconciliation job to forget.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | **CONTRIBUTING.md is stale again** — it says "Current latest is `016_user_settings.sql`, so the next would be `017_`" ([CONTRIBUTING.md:86](../../CONTRIBUTING.md#L86)), but the latest is now `018_habit_logs.sql`. This is V6 §11.1 *recurring* — the doc was fixed from `008` to `016/017`, then the wave that added `017`+`018` outran it | Low | XS | The same line *also* now says "Run `ls server/db/migrations/ \| tail -5`" — the self-correcting instruction V6 recommended. **Delete the hardcoded number entirely** and keep only the `ls` guidance, so it can never go stale a third time. |
| 11.2 | Two `SECURITY.md` files now disagree (§1.1) | Low | XS | De-duplicate. |
| 11.3 | No type checking (`checkJs`/TS) | Low | M | Carried from V4-V6. |

**Net:** the additions themselves are 8.5-quality — reuse, additive, documented — but the wave re-opened the exact doc-drift finding V6 closed (CONTRIBUTING) and spawned a second (duplicate SECURITY.md), plus the uncommitted tree. Excellent code, recurring housekeeping. Net flat. **8.3 (—).**

---

## 12. Long-Term Sustainability & Roadmap — 8.8 / 10  (×1.0)

### Strengths
- **The single thing V6 said it "cannot verify into existence" now exists.** `docs/ROADMAP_FORWARD.md` is a living forward roadmap (2026–2076) with the **Six Invariants** as load-bearing walls, Phases 1–5, and a gap-tracking table ([ROADMAP_FORWARD.md](../ROADMAP_FORWARD.md)). V6 §12.1 — "there is still no formal Wave 8+ roadmap… the one thing V6 cannot verify" — is closed. The next audit now has a spine, exactly as V4's roadmap gave V5 one.
- **The system again metabolized its audit:** of the ten V6 gaps, all ten are implemented (see Ledger), and the forward roadmap's own Phase-1 list is the proof-of-mechanism.
- **Docs are largely current and rationale-rich** (ARCHITECTURE, SECURITY-with-egress, the 8-rule alert set), and dependencies stay caret-ranged + lock-pinned with a clean `npm audit`.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | **The roadmap's own status table is stale.** `ROADMAP_FORWARD.md` still marks items 1.2–1.6 (attachments, web-push, habits, consolidation, AI metric) as **⬜ not done** — but this audit verified all five shipped. The doc undersells its own progress | Low | XS | Flip 1.2–1.6 to ✅; the same doc-drift class as §11.1. |
| 12.2 | No feature-flag mechanism (Roadmap 1.7) | Low | M | Carried from V6 §14.4; `user_settings` is still the natural home. |

**Net:** the absence of a forward roadmap was V6's signature sustainability gap, and it is now a 152-line living document with invariants and trigger-gated phases. Docked only because the doc lags its own shipped reality. **8.8 (▲ +0.1).**

---

## 13. Product-Market Fit for Personal Productivity — 8.3 / 10  (×2.0)

> Re-scored against the post-consolidation system. **V6: 7.6.** This is the wave's headline mover.

### 13.1 Cross-Module Integration — 2.8 / 3  *(V6: 2.7)*
The connective tissue is no longer merely *present and exported* — it is now **consumable as workflow**. The Finance Overview consolidates six fragmented finance pages and the Sprint Board consolidates four engineer pages into **two one-screen dashboards** ([FinanceOverview.jsx](../../client/src/pages/FinanceOverview.jsx), [EngineerSprint.jsx](../../client/src/pages/EngineerSprint.jsx)) — thirteen pages collapsed to two, each reading a single consolidated payload that reuses existing aggregations. Short of a full 3 only because some links remain manual and `recalcGoalProgress` is on-demand for non-habit goals.

### 13.2 Workflow Support — 1.85 / 2  *(V6: 1.6)*
**The biggest mover within PMF.** V6's largest named workflow gap was verbatim: "the two multi-page modules — Engineer (6 pages) and Finance (6 pages) — still lack a single sprint board / one-screen financial review… the clearest PMF opportunity left." **Both shipped.** Sprint planning is now one screen (active work + blockers + this week + what's next); monthly financial review is one screen (net + aging + budget + portfolio + recent). Add the reminder bell surfacing due items across five modules and the habit check-in loop, and the daily/weekly workflows are markedly tighter. Not a full 2 because the research/reading capture flows are unchanged and the reminder is poll-based (no push when the tab is closed).

### 13.3 Data Portability & Longevity — 1.85 / 2  *(V6: 1.7)*
**Closed the one named portability gap.** V6: "*Not a full 2* only because uploaded attachments are not in the export ZIP." They are now — `export.js` bundles `server/uploads/` files into an `attachments/` folder, de-dupes display names, queries `research_attachments` for original filenames, and records `attachments_exported` in the manifest ([export.js:139-181](../../server/routes/export.js#L139)). This is the **true "everything" export**: every DB row *and* every uploaded byte, in open formats, in one ZIP. Not a full 2 only because the export is still one unbounded, unthrottled request.

### 13.4 Personalization & Adaptability — 1.85 / 2  *(V6: 1.7)*
**Both V6 sub-gaps closed.** The theme cross-device *read* path is complete (`hydrateFromServer`, §4) so preferences truly follow the user; and the `notifications_enabled` preference — which V6 noted "exists before the channel" — now has a channel: the bell + OS notification + `/due` aggregate ([notifications.js](../../server/routes/notifications.js)). `default_model` is still consumed by AI Chat. Not a full 2 because the channel is poll-based, not true push, and there's still no general per-user feature-flag.

### 13.5 Missing Capabilities — −0.1 / (−1 … 0)  *(V6: −0.1)*
Genuinely shipped since V6: **habit streaks/calendar** (was "only a `goal_type` option") and a **reminder channel** (was "preference without channel"). Still missing and consciously deferred: **agentic AI / tool-calling** (Roadmap Phase 2), **true server-push web-push + multi-device** (Phase 3), and native mobile. The deduction stays near zero — what's missing is future-era, not present-gap.

### 13.6 Total for §13
2.8 + 1.85 + 1.85 + 1.85 − 0.1 = **8.25 → 8.3 / 10.**

**Interpretation:** V6 (7.6) named four PMF gaps — workflow consolidation, attachments-in-export, the theme read-path, and the personalization channel — and **all four closed in one wave**, plus habits landed as a real loop. On a ×2.0 weight this **+0.7** is the dominant contributor to the blended rise. The remaining sub-9 ceiling is no longer about *missing capability* or *completion* — it is about the genuinely *next-era* (agentic AI, true multi-device) and a few hardening notes (push vs poll, unthrottled export). **8.3 (▲ +0.7).**

---

## PMF Deep Dive — Summary

| Sub-dimension | V6 | **V7** | What moved |
|---------------|----|--------|------------|
| 13.1 Cross-Module Integration (0-3) | 2.7 | **2.8** | 13 pages → 2 consolidated dashboards |
| 13.2 Workflow Support (0-2) | 1.6 | **1.85** | Sprint + finance one-screen; reminders; habit loop |
| 13.3 Data Portability (0-2) | 1.7 | **1.85** | Attachments bundled → true "everything" export |
| 13.4 Personalization (0-2) | 1.7 | **1.85** | Theme read-path complete; notification channel live |
| 13.5 Missing Capabilities (−1…0) | −0.1 | **−0.1** | Habits + reminders shipped; agentic/multi-device deferred |
| **Total** | **7.6** | **8.3** | **▲ +0.7** |

---

## V6 → V7 Remediation Ledger

Every one of the ten V6 gaps, checked against shipped code on 2026-06-13.

| # | V6 Gap | Status | Evidence |
|---|--------|--------|----------|
| 1 | AI egress in SECURITY.md | ✅ **Closed** | [docs/SECURITY.md:40-70](../SECURITY.md#L40) — "Third-Party Data Egress": provider, data categories, local-only mode. ⚠️ root `SECURITY.md` is a stale duplicate (§1.1). |
| 2 | README reflects full system (18 modules) | ✅ **Closed** | [README.md:8-46](../../README.md#L8) — now lists Reading, Contacts, Ideas, Time, Goals, Weekly Review, Annual Report, Polymath, AI Chat, Export, Universal Links/Search, PWA, etc. |
| 3 | CONTRIBUTING migration number | ⚠️ **Partial / re-stale** | [CONTRIBUTING.md:86](../../CONTRIBUTING.md#L86) — fixed `008→016/017` *and* added the `ls \| tail -5` self-correct, but the wave that added `017`+`018` left the hardcoded number at `016`. The dynamic instruction saves it; the example is stale. |
| 4 | Theme cross-device read path | ✅ **Closed** | [useTheme.js:35-52](../../client/src/hooks/useTheme.js#L35) exports `hydrateFromServer`; [AppLayout.jsx:101-102](../../client/src/components/layout/AppLayout.jsx#L101) calls it with `settings.theme`. |
| 5 | Forward roadmap exists | ✅ **Closed** | [docs/ROADMAP_FORWARD.md](../ROADMAP_FORWARD.md) — 6 invariants, Phases 1-5, gap tracking. ⚠️ its own status table is stale (§12.1). |
| 6 | Attachments in export ZIP | ✅ **Closed** | [export.js:139-181](../../server/routes/export.js#L139) — bundles `uploads/` into `attachments/`, de-dupes, `attachments_exported` in manifest. |
| 7 | Web-Push Reminders | ✅ **Closed (v1 / poll-based)** | [notifications.js](../../server/routes/notifications.js) + [client notifications.js](../../client/src/lib/notifications.js) + [NotificationBell.jsx](../../client/src/components/layout/NotificationBell.jsx) + [017_push_subscriptions.sql](../../server/db/migrations/017_push_subscriptions.sql). **Honest caveat:** v1 is Notification API + 1-hour polling + an in-app bell; the `push_subscriptions` table is substrate for true VAPID push later — *not yet server-pushed.* |
| 8 | Habit Streaks/Calendar | ✅ **Closed** | [018_habit_logs.sql](../../server/db/migrations/018_habit_logs.sql); `deriveStreak`/`toggleHabitLog`/`getHabitCalendar` [goals.model.js:280-378](../../server/models/goals.model.js#L280); endpoints [goals.js:145-170](../../server/routes/goals.js#L145); UI [GoalDetailModal.jsx:123](../../client/src/components/goals/GoalDetailModal.jsx#L123). |
| 9 | AI upstream latency metrics | ✅ **Closed** | `aiUpstreamDuration` [metrics.js:29-30](../../server/lib/metrics.js#L29), observed in both chat paths [chat.js:215-280](../../server/routes/chat.js#L215) + embeddings; alerts `AIUpstreamHighLatency`/`AIUpstreamTimeoutRate` [alert_rules.yml:40-51](../../deploy/prometheus/alert_rules.yml#L40). |
| 10 | Engineer Sprint + Finance Overview | ✅ **Built & navigable** ⚠️ **uncommitted** | [EngineerSprint.jsx](../../client/src/pages/EngineerSprint.jsx) + `/engineer/sprint` [engineer.js:154-166](../../server/routes/engineer.js#L154); [FinanceOverview.jsx](../../client/src/pages/FinanceOverview.jsx) + `/finances/overview` [finances.js:168-174](../../server/routes/finances.js#L168); nav [AppLayout.jsx:32,60](../../client/src/components/layout/AppLayout.jsx#L32). **Working tree dirty — these files are uncommitted (§7.1).** |

**Tally: 8 fully closed, 2 closed-with-caveat** (#3 re-stale doc; #10 uncommitted), plus **#7 is a polling v1, not true server-push.** Every gap is implemented in shipped code — the load-bearing list is done. The caveats are housekeeping (commit, de-stale) and one honest scope note (poll vs push).

**New items this audit (the cost of a fast wave):** seven endpoints absent from OpenAPI (§5.1); zero new tests / no a11y for two new pages (§6); main bundle +56% gzip (§9.1); CONTRIBUTING re-stale + duplicate SECURITY.md (§11); dirty working tree (§7.1).

---

## Cross-Cutting Themes

**1. The system metabolizes audits — but the metabolism has a by-product, and it's always the same one: documentation and housekeeping drift.** This is now a *three-audit pattern*. V5's findings became V6's shipped code; V6's became V7's. Each time, the load-bearing work lands cleanly and the *paperwork* trails it: V6 left README/CONTRIBUTING/SECURITY stale; V7 closed those and promptly re-staled CONTRIBUTING (016 vs 018), spawned a duplicate SECURITY.md, left its own roadmap's status table wrong, and skipped seven OpenAPI entries. The fix is not a feature — it's a **release discipline**: treat README, CONTRIBUTING, SECURITY, OpenAPI, and the roadmap's status table as artifacts that ship *in the same commit* as the code, and replace every hardcoded "next migration is N" with the `ls | tail` that can't rot.

**2. The clean working tree is a load-bearing invariant, and it broke.** V5 flagged an uncommitted fix; V6 celebrated resolving it ("`git status` is empty"); V7 finds the entire consolidation uncommitted. For a 50-year single-maintainer system, "what's running == what's in `main`" is not pedantry — it's the disaster-recovery contract (Invariant 6: `pg_dump` + *source* = rebuild). Uncommitted source breaks the rebuild. This is the cheapest finding to fix (one commit) and the most important to internalize as a habit.

**3. Substrate-before-feature is now the project's deliberate cadence — and V7 shows both its power and its honesty.** V6 noticed `notifications_enabled` shipped before any channel. V7 deepens the pattern *and labels it*: the `push_subscriptions` table ships as substrate for VAPID web-push that doesn't exist yet, and the code **says so in comments** rather than overselling. The habit feature mirrors streaks into `current_value` so existing surfaces light up without a schema change. This is the right order for a long-lived system (the schema is the expensive part) — and the new code's willingness to document "this is v1 / substrate for later" is a maturity signal. The one place the *naming* outran the *reality* is calling it "Web-Push": it's a poll, not a push. Name it "Reminders (v1)" until the push job exists.

**4. The engineering held flat while the product jumped — and that is the honest signature of a consolidation wave.** V1→V5 raised technical scores because the system was being *built*; V6 flattened them because the foundation was *done*; V7 holds technical at 8.6 because this wave spent its budget on **product** (PMF +0.7), not hardening. The gains (AI observability, two exemplary migrations, egress disclosure, the forward roadmap) were paid back, almost to the decimal, by the debt (test-debt, dirty tree, bundle, undocumented endpoints). A reader expecting "+0.2, all green" should instead read this: *the most valuable product wave since the AI chat, delivered cleanly in substance, owing a short cleanup wave.* That trade was probably correct — but the cleanup is now the highest-ROI work on the board.

---

## The Complete Score Journey (V1 → V7)

```
| #  | Section                          | Wt   | V1  | V2  | V3  | V4  | V5  | V6  | V7  | Δ V6→V7 |
|----|----------------------------------|------|-----|-----|-----|-----|-----|-----|-----|---------|
| 1  | Security                         | ×2.0 | 5.5 | 8.0 | 8.8 | 8.9 | 9.0 | 9.0 | 9.1 | ▲ +0.1  |
| 2  | Backend Resilience               | ×1.5 | 6.0 | 7.0 | 7.6 | 8.2 | 8.5 | 8.7 | 8.7 |   —     |
| 3  | Database Integrity               | ×1.5 | 7.0 | 7.5 | 7.8 | 8.4 | 8.5 | 8.7 | 8.8 | ▲ +0.1  |
| 4  | Frontend Reliability             | ×1.5 | 6.5 | 7.5 | 7.6 | 7.9 | 8.4 | 8.5 | 8.6 | ▲ +0.1  |
| 5  | API Design & Docs                | ×1.0 | 7.0 | 7.5 | 6.8 | 8.2 | 8.5 | 8.6 | 8.5 | ▼ −0.1  |
| 6  | Test Suite                       | ×1.25| 3.0 | 6.0 | 7.2 | 7.8 | 8.1 | 8.5 | 8.3 | ▼ −0.2  |
| 7  | DevOps & CI/CD                    | ×1.25| 6.0 | 7.5 | 8.0 | 7.5 | 8.3 | 8.7 | 8.5 | ▼ −0.2  |
| 8  | Observability                    | ×1.0 | 4.5 | 6.5 | 6.8 | 8.3 | 8.4 | 8.6 | 8.8 | ▲ +0.2  |
| 9  | Performance                      | ×1.0 | 5.5 | 6.5 | 7.2 | 7.4 | 7.6 | 7.7 | 7.6 | ▼ −0.1  |
| 10 | UI/UX & Accessibility            | ×1.0 | 7.0 | 7.5 | 7.4 | 8.1 | 8.4 | 8.6 | 8.6 |   —     |
| 11 | Code Quality                     | ×1.0 | 7.0 | 7.5 | 8.0 | 7.8 | 8.0 | 8.3 | 8.3 |   —     |
| 12 | Sustainability                   | ×1.0 | 6.5 | 8.0 | 8.5 | 7.8 | 8.6 | 8.7 | 8.8 | ▲ +0.1  |
| 13 | Product-Market Fit               | ×2.0 |  —  |  —  |  —  | 2.8 | 6.4 | 7.6 | 8.3 | ▲ +0.7  |
| 14 | The 50-Year Lens                 | ×2.0 |  —  |  —  |  —  |  —  |  —  | 8.2 |  —  | (out of scope) |
|    | Technical only (12 dims, Σ15.0)  |      | 6.4 | 7.5 | 7.7 | 8.1 | 8.4 | 8.6 | 8.6 |   —     |
|    | Blended 13-dim (Σ17.0, no §14)   |      |  —  |  —  |  —  |  —  |  —  | 8.5 | 8.6 | ▲ +0.1  |
|    | Blended w/ §14 (Σ19.0) — V6 basis|      |  —  |  —  |  —  | 7.6 | 8.2 | 8.4 |  n/a| (§14 out of scope) |
```

**Blended math (V7):** Σ(score × weight) over dims 1-13 = **145.55** / Σ17.0 = **8.56 → 8.6.** Technical-only (dims 1-12) = **128.95 / 15.0 = 8.60 → 8.6.**

**Basis reconciliation:** V6's headline **8.4** included §14 (×2.0) over Σ19.0. Excluding §14 (out of scope here), V6's comparable 13-dim blended is **8.5** (144.05 / 17.0). So like-for-like, **blended rises 8.5 → 8.6 (+0.1)**, driven entirely by PMF; technical-only is **flat at 8.6.**

**The journey in one line:** V1 (6.4) was six apps behind one login; V2–V3 hardened them; V4 (7.6) named the product gap; V5 (8.2) closed it; V6 (8.4) proved the system absorbs its own audits and looked 50 years out; and **V7 consolidates** — the system collapses thirteen pages into two, completes its portability and personalization promises, lands habits and reminders, and in doing so spends its wave on *product* (PMF +0.7) while the engineering holds (technical flat 8.6) and quietly accrues a one-commit, few-test, seven-endpoint cleanup debt.

---

## Final Verdict

**1. Are all V6 gaps verifiably closed?** **Substantially yes — all ten are implemented in shipped code, verified against the artifacts, with two honest caveats and one scope note.** Eight are cleanly closed (egress doc, README, theme read-path, attachments-in-export, forward roadmap, habits, AI metrics, and the two consolidation dashboards exist and are nav-reachable). Two carry caveats: **#3 CONTRIBUTING** was fixed then re-staled by the same wave (016 vs the actual 018, though it now also carries a self-correcting `ls` instruction), and **#10 consolidation** is built and navigable but **uncommitted in the working tree.** And **#7 "Web-Push"** is honestly a *polling v1* (Notification API + 1-hour poll + in-app bell), with the `push_subscriptions` table as substrate for true VAPID push later — a real reminder channel, but not yet server-pushed. The load-bearing work is genuinely done.

**2. Did any regressions occur?** **No functional regressions — all 9/9 gates are green and no behaviour broke. But yes, real quality/process regressions occurred, and honesty requires naming them:** (a) the **clean working tree** — a property V5→V6 fought to establish — is **dirty again** (the entire consolidation uncommitted); (b) the **OpenAPI contract now under-documents the system** by seven endpoints (still 93 paths / 145 `addPath`); (c) the **test suite did not move** (35/8/46 unchanged) so a full product wave, including non-trivial streak logic, shipped untested and the two new pages are un-audited for a11y; (d) the **main bundle grew ~56% gzip** (262→493 KB raw) from eager-importing the new pages; (e) **CONTRIBUTING re-staled** and a **duplicate SECURITY.md** now disagree. None blocks production; all are cheap to fix.

**3. What is the honest blended score?** **Technical-only holds flat at 8.6** (gains in Observability/Database/Security/Sustainability offset, almost exactly, by debt in Test/DevOps/API/Performance). **PMF rises sharply to 8.3 (+0.7)** — four named gaps closed at once. **The 13-dimension blended (PMF ×2.0, §14 excluded by scope) is 8.6**, up ~+0.1 on a like-for-like basis from V6's comparable 8.5. This is the honest shape of a consolidation wave: **product up, engineering flat, blended up a touch.**

**4. Is Polymath OS complete for its current vision?** **For the foundation-plus-consolidation vision, essentially yes.** The morning/weekly/monthly workflows are now one-screen where it matters, the data is fully portable (every row *and* byte), preferences follow the user across devices, and the daily loop has habits and reminders. The open frontier is no longer *completion* — it is the consciously-deferred *next era*: **agentic AI / tool-calling** (Roadmap Phase 2) and **true server-push + multi-device** (Phase 3). Before that era opens, the highest-ROI work is the short cleanup this wave earned: **commit the working tree** (one commit), **add the seven OpenAPI entries** (one file), **unit-test `deriveStreak` and a11y-audit the two dashboards** (a few tests), **lazy-load the two new pages** (two lines), and **de-stale CONTRIBUTING + de-duplicate SECURITY.md** (two edits). Do those, and the consolidation is not just substantively done but *cleanly* done — and the system is ready to start working *alongside* its owner, not just for them.

---

*Audit V7 conducted 2026-06-13. All scores cite shipped code, migration files, or verbatim command output captured the same day. Unlike V6, the working tree was **not** clean at audit time (`git status` showed the uncommitted Engineer/Finance consolidation — §7.1). The 50-Year Lens (§14) was excluded by scope and lives in a separate document. This is the consolidation audit: the wave that turned V6's ten findings into shipped product, and earned itself a short cleanup before the next era.*
