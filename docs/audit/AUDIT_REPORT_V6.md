# Grand Final Audit V6 — Polymath OS: The 50-Year Foundation

**Auditor:** Distinguished Systems Architect & Principal SRE
**Date:** 2026-06-13
**Repository:** `productivity-project` (React 19 + Vite/Rolldown / Node 22 + Express 5 / PostgreSQL 16 + pgvector)
**Scope:** Definitive full-stack audit evaluating production readiness **AND 50-year architectural longevity**
**Previous Audits:** V1 (6.4, 2026-06-09) → V2 (7.5, 2026-06-10) → V3 (7.7, 2026-06-10) → V4 (7.6 blended / 8.1 technical, 2026-06-11) → V5 (8.2 blended / 8.4 technical, 2026-06-13)
**Post-V5 Fixes Applied (verified this audit):** Universal Export (10 modules → ZIP), AbortController hardening on all three AI upstream calls, goals `getGoalStats` fix committed + integration test, `user_settings` (migration `016` + API + hooks), Prometheus config shipped (`deploy/prometheus/`), Axe a11y extended 7 → 15 pages, client `enums.js` mirrored, CI coverage floor + e2e-on-PR, ARCHITECTURE.md brought current

---

## Executive Summary

**This is the first audit written for the next fifty years, not the last six waves.** Every prior report — V1 through V5 — asked a version of the same question: *does it work, and is it one system?* By V5 the answer to both was finally yes. The schema that V4 said "has not one foreign key between modules" carried a 22-type `entity_links` table; the morning screen V4 specified verbatim existed as the Today Dashboard; and a DeepSeek-powered chatbox streamed the user's own context over SSE. V5 closed at **8.2 blended / 8.4 technical**, with one explicit indictment list — the "Path Forward" table — naming exactly what remained: commit the goals fix, ship export-all, build `user_settings`, set a coverage floor, bound the AI timeouts, ship the Prometheus config, extend a11y, mirror the enums. **I re-ran every gate and read every changed file on 2026-06-13. That entire list has been executed.** Not the CHANGELOG's claim of it — the shipped code: `server/routes/export.js` streams a ZIP of ten modules ([export.js:45-138](../../server/routes/export.js#L45)); `016_user_settings.sql` exists with typed columns and a documented rationale ([016_user_settings.sql:23-39](../../server/db/migrations/016_user_settings.sql#L23)); the AI `fetch` calls now carry `AbortController` ceilings of 120 s / 60 s / 30 s ([chat.js:171-217](../../server/routes/chat.js#L171), [embeddings.js:45-46](../../server/lib/embeddings.js#L45)); CI enforces real coverage thresholds and runs e2e on PRs ([ci.yml:78](../../.github/workflows/ci.yml#L78)); and the `getGoalStats` 500 that was sitting uncommitted in V5's working tree is now committed, covered by an integration test, and the working tree is **clean** ([goals.model.js:174-175](../../server/models/goals.model.js#L174), `git status` empty).

**The headline shift in V6 is the lens, not the score.** A normal V6 would report "+0.2, all green, ship it." That is true — but it understates what changed. This audit introduces **§14, The 50-Year Lens (×2.0)**, which asks a harder question than any prior dimension: not "does this work in 2026?" but "is this architected to *evolve* to 2076?" Judged that way, Polymath OS is genuinely strong — and the reasons are structural, not cosmetic. The technology stack is deliberately boring and durable: PostgreSQL, Express, React — three of the most maintainable choices in software, all likely to be readable and runnable in decades. The architecture is *additive*: seven waves and a post-V5 fix-wave each added tables, routes, and pages **without modifying the core** ([index.js:241-242](../../server/index.js#L241) mounts export/settings as two more lines in an unchanged middleware stack). Every user record is exportable in open JSON/CSV and the whole database is rebuildable from `pg_dump` + source via a migration runner that self-heals dependency ordering and tolerates pre-existing schema ([migrate.js:42-47,118-143](../../server/db/migrate.js#L42)). And the design decisions now carry their *rationale*, not just their outcome — ARCHITECTURE.md documents *why* `/api` has no version prefix (and the precise trigger to add one), *why* sessions over JWT, *why* typed columns over an EAV settings table ([ARCHITECTURE.md:165-225](../ARCHITECTURE.md#L165)). For a system meant to be maintained by one person across a lifetime, that "why" is the single most valuable artifact in the repository.

**The gaps that remain are smaller than V5's and almost entirely about documentation drift and consciously-deferred ceilings — not foundation.** Three V5 carry-overs survived: the AI egress to DeepSeek is **still undocumented in SECURITY.md** ([SECURITY.md:70-75](../../SECURITY.md#L70) — no "third-party egress" section), `/metrics` is **still unauthenticated at the app port** (edge-blocked by nginx only, [index.js:191-199](../../server/index.js#L191)), and the CI OpenAPI gate **still counts `addPath` in the generator script** rather than parsing the emitted spec ([ci.yml:61](../../.github/workflows/ci.yml#L61)). Two *new* doc-staleness items surfaced precisely because the fix-wave moved fast: **CONTRIBUTING.md still tells a new contributor the next migration is `008_`** when it is `017_` ([CONTRIBUTING.md:86](../../CONTRIBUTING.md#L86) — the exact staleness class V5 flagged in ARCHITECTURE.md, fixed there but re-homed here), and **README.md still describes only the Wave-1 system** — it lists seven modules and omits the eleven that followed (Reading, Contacts, Ideas, Time, Goals, Weekly Review, Annual Report, Polymath Dashboard, AI Chat, Export, Settings). The first file a future developer opens undersells the system by more than half.

**Verdict: the foundation era is complete, and it closes strong.** Technical-only rises **8.4 → 8.6**; every V5 laggard recovered and nothing regressed. **PMF leaps 6.4 → 7.6** — Universal Export (V5's "single most cost-effective PMF win still on the table") shipped, and `user_settings` lifted personalization off `localStorage`. The new **§14 50-Year Lens scores 8.2** — high, and honest about its ceilings (single-node uploads, no feature-flag mechanism, README drift). With PMF re-weighted to ×2.0 and §14 added at ×2.0, the **blended score is 8.4 (+0.2)** over a total weight of 19.0. But the number is not the point of V6. The point is this: **after seven waves and a clean post-audit fix-wave, the system is not just working — it is built to keep being worked on.** The route→model→SQL spine, the additive schema, the open-format exports, and the documented "why" are the four invariants that make the next hundred features possible. Protect those, finish the last 10% (habits, reminders, agentic AI, the README), and this system can credibly serve its owner for the next fifty years.

---

## Quality Gates — Actual Results

Every command below was executed on **2026-06-13** against the working tree. Output is reported verbatim (trimmed). **9/9 green. Working tree clean.**

| Gate | Command | Result |
|------|---------|--------|
| Server audit | `npm audit` (server) | ✅ **found 0 vulnerabilities** |
| Server lint | `npm run lint` (server) | ✅ **clean** (`eslint . --max-warnings 0`, exit 0) |
| Server tests | `npm test` (server) | ✅ **35 passed / 15 skipped** (7 files passed, 4 integration files skip without `DATABASE_URL`) — `Duration 3.97s` |
| OpenAPI generation | `npm run openapi` | ✅ **93 paths written** (`145` `addPath` calls; ≥75 CI gate passes) |
| Client audit | `npm audit` (client) | ✅ **found 0 vulnerabilities** |
| Client lint | `npm run lint` (client) | ✅ **clean** (`eslint . --max-warnings 0`, exit 0) |
| Client build | `npm run build` | ✅ **clean** — main `index-Dv4_mK8k.js` **262.63 KB / 83.29 KB gzip**; `mdeditor` **1,059.81 KB / 363.28 KB gzip** (lazy); `prism` 85.37 KB (lazy); ⚠️ Vite >500 KB warning persists (mdeditor); **PWA service worker generated** (`dist/sw.js`, workbox, **30 precache entries / 1,583 KiB**); `built in 2.31s` |
| Client tests | `npm test` (client) | ✅ **8 passed** (2 files: markdown sanitization + QuickCapture) |
| Playwright | `npx playwright test --list` | ✅ **46 tests in 2 files** (`smoke.spec.js` ×8 + `a11y.spec.js` ×15) across `chromium-desktop` + `chromium-mobile` — *up from 30 in V5; a11y grew 7 → 15 pages* |

**Spot checks (all verified by command this audit):**

| Check | V5 | **V6** | Method |
|-------|----|--------|--------|
| `docs/openapi.json` paths | 91 | **93** | `Object.keys(paths).length` |
| `addPath` calls in generator | 142 | **145** | `grep -c "addPath" server/scripts/generate-openapi.js` |
| `LINKABLE_TYPES` (server enums) | 22 | **22** | `require('./server/lib/enums.js').LINKABLE_TYPES.length` |
| Migration files | 19 | **20** | `ls server/db/migrations/ | wc -l` (added `016`) |
| Client pages | 29 | **29** | `ls client/src/pages/*.jsx | wc -l` |
| Server routers | 17 | **19** | `ls server/routes/*.js | wc -l` (added `export.js`, `settings.js`) |
| Server models | 15 | **16** | `ls server/models/*.js | wc -l` (added `settings.model.js`) |
| `deploy/prometheus/` | ❌ | ✅ **2 yml** | `prometheus.yml` + `alert_rules.yml` (6 rules) |
| `client/src/lib/enums.js` | ❌ | ✅ **present** | mirrored, consumed by `LinkedItems`, `ContactDetailModal`, `Contacts` |
| `server/routes/export.js` | ❌ | ✅ **present** | 10-module ZIP, JSON/CSV |
| `server/routes/settings.js` | ❌ | ✅ **present** | GET/PUT, Zod-validated |
| `016_user_settings.sql` | ❌ | ✅ **present** | typed columns, `UNIQUE (user_id)`, trigger |

**Migrations 002–016 present, sequential, no numbering conflicts**; the original schema lives in 5 dated `20240101–20240103` files (20 migration files total). `migrate.js` groups the date-prefixed v1 files **before** the `NNN_` v2+ series ([migrate.js:42-47](../../server/db/migrate.js#L42)), so string-sort order (which would otherwise place `002_` before `20240101_`) is overridden deliberately.

---

## Section Scores

| # | Section | Weight | V4 | V5 | **V6** | Δ V5→V6 |
|---|---------|--------|-----|-----|--------|---------|
| 1 | Security & Authentication | ×2.0 | 8.9 | 9.0 | **9.0** | — |
| 2 | Backend Resilience & Reliability | ×1.5 | 8.2 | 8.5 | **8.7** | ▲ +0.2 |
| 3 | Database Integrity & Data Safety | ×1.5 | 8.4 | 8.5 | **8.7** | ▲ +0.2 |
| 4 | Frontend Reliability & Error Resilience | ×1.5 | 7.9 | 8.4 | **8.5** | ▲ +0.1 |
| 5 | API Design & Documentation | ×1.0 | 8.2 | 8.5 | **8.6** | ▲ +0.1 |
| 6 | Test Suite Quality & Coverage | ×1.25 | 7.8 | 8.1 | **8.5** | ▲ +0.4 |
| 7 | DevOps & CI/CD Maturity | ×1.25 | 7.5 | 8.3 | **8.7** | ▲ +0.4 |
| 8 | Observability & Debugging | ×1.0 | 8.3 | 8.4 | **8.6** | ▲ +0.2 |
| 9 | Performance & Scalability | ×1.0 | 7.4 | 7.6 | **7.7** | ▲ +0.1 |
| 10 | UI/UX Quality & Accessibility | ×1.0 | 8.1 | 8.4 | **8.6** | ▲ +0.2 |
| 11 | Code Quality & Maintainability | ×1.0 | 7.8 | 8.0 | **8.3** | ▲ +0.3 |
| 12 | Long-Term Sustainability & Roadmap | ×1.0 | 7.8 | 8.6 | **8.7** | ▲ +0.1 |
| 13 | **Product-Market Fit** | **×2.0** | 2.8 | 6.4 | **7.6** | ▲ **+1.2** |
| 14 | **The 50-Year Lens** | **×2.0** | — | — | **8.2** | ★ **NEW** |
| | **Technical only (12 dims, Σ15.0)** | | 8.1 | 8.4 | **8.6** | ▲ +0.2 |
| | **Blended (14 dims, Σweights = 19.0)** | | 7.6 | 8.2 | **8.4** | ▲ +0.2 |

> **Two numbers, by design — and a third lens.** *Technical-only = 8.6* is the engineering across 7 waves + the post-V5 fix-wave (+0.2; every V5 laggard recovered). *Blended = 8.4* folds in PMF (now ×2.0) and the new §14 (×2.0). PMF jumped +1.2 but its higher weight and below-mean value (7.6) damp the blended rise; §14 at 8.2 is likewise a touch below the technical mean. The blended +0.2 is honest: this was a *consolidation* audit, not a *transformation* one. The transformation was V5. V6 is the audit that proves the system can absorb its own audit's findings and execute them cleanly — which, for a 50-year project, matters more than any single number.

**Blended math (V6):** Σ(score × weight) = 160.45 over Σweights 19.0 = **8.44 → 8.4.** Technical-only = 128.85 over 15.0 = **8.59 → 8.6.** (Weights: dims 1-12 = 15.0; PMF ×2.0; §14 ×2.0; total 19.0.)

---

## 1. Security & Authentication — 9.0 / 10  (×2.0)

### Strengths
- **Zero `npm audit` vulnerabilities** on both packages (re-run 2026-06-13). The perimeter is unchanged and intact: helmet CSP (`default-src 'none'`) + prod HSTS ([ARCHITECTURE.md:153](../ARCHITECTURE.md#L153)); session regeneration on login; bcryptjs cost 12; parameterized SQL + `user_id` scoping in **every** model — now including the two new routers.
- **The two post-V5 routers inherited the discipline exactly.** `/api/export` and `/api/settings` are both mounted behind `requireAuth` ([index.js:241-242](../../server/index.js#L241)); `export.js` fetches *only* `req.user.id`-scoped data through each module's existing `list*` function ([export.js:45-69](../../server/routes/export.js#L45)); `settings.model.js` scopes every query to `user_id` and whitelists the three updatable columns ([settings.model.js:9,40-57](../../server/models/settings.model.js#L9)), so a crafted PUT body cannot set arbitrary fields. The settings PUT is Zod-validated with an enum on `theme` and a `.refine()` rejecting empty bodies ([settings.js:19-23](../../server/routes/settings.js#L19)).
- **AbortController closed a latent availability hole.** V5 §2.1 noted a hung AI connection could hold an SSE stream open against nginx's 3600 s read timeout. All three upstream calls now self-terminate (chat 120 s / 60 s, embeddings 30 s) — a resource-exhaustion vector is gone (see §2).
- **Carried, intact:** secrets stay server-side (DeepSeek/embedding keys are env-only, never in the client bundle, [SECURITY.md:53](../../SECURITY.md#L53)); pre-upload ownership check before multer touches disk; attachment delete reconstructs path from filename only; `002` migration aborts on a populated ledger.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | **AI egress is *still* undocumented in SECURITY.md.** Wave 7 chat + Wave 6 embeddings send prompt text **and** injected entity context to DeepSeek's cloud API; SECURITY.md's "Known Limitations" ([:70-75](../../SECURITY.md#L70)) names single-tenancy, no-2FA, disk storage, and no-CSRF — but says nothing about third-party data egress | Medium (privacy) | S | **Verbatim un-actioned from V5 §1.1.** Opt-in (key-gated) with a local Ollama path, so it is a *disclosure* gap, not a leak. Add a "Third-party data egress" section naming DeepSeek, the data categories sent, and the local-only alternative. |
| 1.2 | `/metrics` is **still unauthenticated at the app port** ([index.js:191-199](../../server/index.js#L191)) — the handler comment even says "restrict via nginx/Cloudflare in prod" | Low | S | **Carried from V5 §1.2.** Edge-blocked (nginx proxies only `/api`+`/health`), but a host on the internal Docker network can read it. Bind to localhost or add a bearer check for defence-in-depth. |
| 1.3 | No CSRF token — defence is `sameSite: lax` + CORS | Medium | M | Carried from V3/V4/V5. Documented in SECURITY.md as a known limitation. Upgrade to `sameSite: strict` or add a double-submit token if the origin ever changes. |
| 1.4 | The export ZIP is **unthrottled** beyond a 10,000-row-per-module cap ([export.js:24](../../server/routes/export.js#L24)) — a user with 10 maxed modules streams ~100k rows per request | Low | S | Single-user scope makes this benign; if multi-tenant, add a per-user export rate limit (e.g. 1/min) to prevent heap pinning. |

**Net:** the fundamentals are pristine and the two new routers were built with the same ownership-scoping and validation as the rest of the suite. The three carried items (egress disclosure, `/metrics` at app port, CSRF) are all known, documented or edge-mitigated, and none is a live exploit. The egress disclosure remains the one cheapest win. **9.0 (unchanged).**

---

## 2. Backend Resilience & Reliability — 8.7 / 10  (×1.5)

### Strengths
- **V5's #1 resilience gap is fixed, comprehensively.** Every upstream AI call now races an `AbortController` against a `setTimeout`, with `clearTimeout` in the success path: Ollama 120 s ([chat.js:171-206](../../server/routes/chat.js#L171)), cloud/DeepSeek 60 s ([chat.js:216-258](../../server/routes/chat.js#L216)), embeddings 30 s ([embeddings.js:45-67](../../server/lib/embeddings.js#L45)). A hung provider can no longer hold a connection open indefinitely. This is the textbook fix V5 §2.1 prescribed, applied in all three places, not one.
- **Export streaming is failure-safe.** `export.js` pipes an `archiver` ZIP straight to the response, registers an `archive.on('error')` handler, and guards the outer catch on `res.headersSent` so a mid-stream failure logs instead of double-sending ([export.js:120-142](../../server/routes/export.js#L120)) — the same `headersSent` discipline the SSE chat path uses.
- **Graceful degradation remains the system's signature.** `embeddings.model.js` tolerates a missing table (`42P01` → empty), `autoTagger.suggestTags` returns `[]` on any failure, and `014_pgvector.sql` is guarded by `pg_available_extensions`. The new `settings.model.js` extends the pattern: it **lazily materializes** the row on first read (`INSERT … ON CONFLICT DO NOTHING`), so existing accounts need no backfill and a missing settings row never 500s ([settings.model.js:16-29](../../server/models/settings.model.js#L16)).
- **Carried:** DB-aware `/health`, atomic `settleLedger`, env-driven pool, graceful shutdown draining HTTP → pool.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | No retry/backoff on transient DB errors (`ECONNREFUSED`/`57P03`) | Medium | M | Carried from V3/V4/V5 §2.2. A small retry wrapper for idempotent reads. |
| 2.2 | `/health` has no statement timeout; `migrate.js` diagnostic re-run (the "stuck" path at [migrate.js:137-138](../../server/db/migrate.js#L137)) runs outside a transaction | Low | S | Carried. The migrate re-run is only to surface the real error before aborting; acceptable. |
| 2.3 | Export `fetchAll` issues **10 parallel queries** with `per_page: 10000` ([export.js:46-69](../../server/routes/export.js#L46)) — a large account could spike memory and connection use for the duration of one request | Low (single-user) | M | Stream module-by-module instead of `Promise.all`-ing all ten into memory if data volumes grow large. |

**Net:** the one real V5 resilience gap (unbounded AI timeout) is closed across all three call sites, and the new export/settings paths were built fail-safe. The carried items (DB retry, health timeout) are minor and well-understood. **8.7 (▲ +0.2).**

---

## 3. Database Integrity & Data Safety — 8.7 / 10  (×1.5)

### Strengths
- **The V5 §3.1 correctness bug is committed *and* covered.** `getGoalStats` now uses direct date subtraction cast to float — `(NOW()::date - start_date)::float / NULLIF((target_date - start_date), 0)` ([goals.model.js:174-175](../../server/models/goals.model.js#L174)) — eliminating the `EXTRACT(EPOCH FROM integer)` that 500'd for any date-bounded goal. Critically, the working tree is now **clean** (`git status` empty), so `main` and the working copy finally agree, and there is a regression test: `constraints.int.test.js` inserts a goal with `start_date`/`target_date` and asserts `getGoalStats` returns `on_track` as a number ([constraints.int.test.js:77-104](../../server/test/integration/constraints.int.test.js#L77)). The exact V5 §6.2 coverage hole is closed.
- **`user_settings` is a model citizen of the schema conventions.** `016_user_settings.sql` follows §6.5 to the letter: `SERIAL` PK, `user_id` FK `ON DELETE CASCADE`, a `VARCHAR(20)` `theme` guarded by `CHECK (theme IN ('light','dark','system'))`, `TIMESTAMPTZ` timestamps, the shared `set_updated_at()` trigger, `UNIQUE (user_id)` (which doubles as the lookup index), and `DROP TABLE IF EXISTS … CASCADE` for re-runnability ([016_user_settings.sql:23-39](../../server/db/migrations/016_user_settings.sql#L23)). The design even documents *why typed columns over an EAV `value TEXT`* ([ARCHITECTURE.md:212-216](../ARCHITECTURE.md#L212)) — rationale, not just outcome.
- **`upsertSettings` avoids the classic ON CONFLICT trap.** Rather than a single `INSERT … ON CONFLICT DO UPDATE` (which on a first write would persist schema defaults for omitted columns), it splits ensure-row `INSERT` from a partial `UPDATE`, so a first-time write persists the *supplied* values ([settings.model.js:40-57](../../server/models/settings.model.js#L40), explained at [:31-39](../../server/models/settings.model.js#L31)). This is the kind of subtle, correct detail that signals a real engineer, not a generator.
- **`entity_links` discipline holds at 22 types**, provably in sync across three layers: the server `LINKABLE_TYPES` ([enums.js](../../server/lib/enums.js)), the new client mirror ([client/src/lib/enums.js:10-16](../../client/src/lib/enums.js#L10)), and the `chk_entity_link_types` CHECK in the migrations.
- **The migration runner is built for the long haul** (see §14.2): `compareMigrations` groups date-prefixed before `NNN_`, applies each file in its own transaction, multi-passes on `42P01` (missing dependency) to self-resolve ordering, and treats `42P07`/`42710` (already-exists) as "applied" so a hand-built legacy DB adopts cleanly ([migrate.js:42-90,118-143](../../server/db/migrate.js#L42)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | Migrations are **forward-only — no `down` step** ([migrate.js:2](../../server/db/migrate.js#L2)) | Low | L | Carried from V4/V5. For a single-user system the recovery path is restore-from-backup, which is acceptable, but a 50-year system should at least document the "roll back = restore" contract (it does, implicitly, via RUNBOOK). |
| 3.2 | `recalcGoalProgress` is on-demand, not trigger-driven — `current_value` can drift until the user clicks "Recalculate" | Low (by design) | — | Carried; add a "last recalculated" timestamp in the UI so on-demand isn't mistaken for stale. |
| 3.3 | `research_attachments.file_path` remains dead weight (delete reconstructs from `filename`) | Low | S | Carried; harmless, but a future migration could drop the column. |

**Net:** the one live correctness bug from V5 is committed, tested, and the tree is clean; the new settings table is exemplary and even avoids a subtle upsert pitfall; the runner is robust. Forward-only migrations are the only structural note, and it's a conscious trade. **8.7 (▲ +0.2).**

---

## 4. Frontend Reliability & Error Resilience — 8.5 / 10  (×1.5)

### Strengths
- **Server-side preferences are wired end-to-end, defensively.** `useSettings` loads once and **falls back to sane defaults if the request fails**, so the UI never blocks on preferences ([useSettings.js:18-27](../../client/src/hooks/useSettings.js#L18)); `useTheme` toggles locally first, then **fire-and-forgets** the server mirror so a settings-API failure can never break the dark-mode toggle ([useTheme.js:32-36](../../client/src/hooks/useTheme.js#L32)); `AIChat` applies the preferred `default_model` exactly once via a ref guard, so it never clobbers an open conversation's model ([AIChat.jsx:85-92](../../client/src/pages/AIChat.jsx#L85)). Every new integration degrades gracefully.
- **The enum drift risk is structurally reduced.** `client/src/lib/enums.js` is now the single client-side source for link display maps and contact badges, consumed by `LinkedItems`, `ContactDetailModal`, and `Contacts` — so a new linkable type changes two files (server + client mirror), not five components ([client/src/lib/enums.js:1-7](../../client/src/lib/enums.js#L1)).
- **Universal Export is reachable from the shell.** The export action lives in `AppLayout`, so it's a global affordance, not buried in one module ([AppLayout.jsx](../../client/src/components/layout/AppLayout.jsx)).
- **Carried:** `ErrorBoundary` wraps `<App/>`, `429` handled distinctly from `401`, `useApi` guards post-unmount `setState`, Research/Engineer pages `React.lazy` + `<Suspense>`, the `⌘K` 4-mode palette, installable PWA with `offline.html`.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | **Client unit coverage is still thin** — 2 test files / 8 assertions for 29 pages | Medium | L | **Carried verbatim from V5 §4.1.** The 8 Wave-3-7 pages, the SSE token accumulator, and now the settings/theme hooks have no RTL unit tests. The new CI coverage floor (§6) makes this measurable but the client job doesn't yet *run* coverage. |
| 4.2 | **`useTheme` initializes from `localStorage`, not from the server** ([useTheme.js:13-17](../../client/src/hooks/useTheme.js#L13)) — the write path to `user_settings` is complete but the **cross-device read path is not**: a fresh device falls back to `prefers-color-scheme`, not the user's saved server theme | Medium | S | Hydrate initial theme from `useSettings().settings.theme` (with `localStorage` as the fast-path cache). Without this, the "follow the user across devices" promise (§13.4) is half-delivered. |
| 4.3 | SSE stream has no client-side timeout/abort UI; `navigator.clipboard` no-ops on non-secure contexts | Low | S | Carried from V5 §4.2/§4.3; pair the SSE timeout UI with the new server-side AbortController. |

**Net:** the new preference/export surfaces are all built to fail safe, and the enum mirror cuts a real drift risk. The thin unit-test base is unchanged, and the theme read-path is the one place the new feature is half-wired. **8.5 (▲ +0.1).**

---

## 5. API Design & Documentation — 8.6 / 10  (×1.0)

### Strengths
- **The contract grew cleanly to 93 paths** (V5: 91; V4: 57), generated from **145 `addPath` calls**, now covering `/api/export` and `/api/settings` alongside the prior 19 routers. `docs/openapi.json` is valid JSON (verified `Object.keys(paths).length === 93`).
- **The envelope held through two more routers.** `settings.js` returns `{ success, data }` and validates with the shared `validate(updateSchema)` middleware; `export.js` returns a `400 VALIDATION_ERROR` with a `field` hint for a bad `format` param ([export.js:90-95](../../server/routes/export.js#L90)) — the exact error shape the rest of the suite uses.
- **ARCHITECTURE.md's route map is current** — all 19 routers listed with auth posture ([ARCHITECTURE.md:51-72](../ARCHITECTURE.md#L51)), including the two new ones, and the design-decision section explains the no-`/api/v1` choice *with its revisit trigger* ([:165-171](../ARCHITECTURE.md#L165)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | **The CI OpenAPI gate still counts `addPath` in the *script*, not paths in the *emitted spec*** ([ci.yml:61](../../.github/workflows/ci.yml#L61)) | Low | S | **Verbatim un-actioned from V4 §5.1 / V5 §5.1.** The proxy works (145 ≥ 75) but would pass on a malformed spec. Add a step that parses `docs/openapi.json` and asserts `Object.keys(paths).length ≥ 90` + valid JSON. |
| 5.2 | No API versioning (`/api/v1`); query params validated ad-hoc, not via Zod everywhere | Low | M | Both are *documented decisions* with revisit triggers ([ARCHITECTURE.md:165-171](../ARCHITECTURE.md#L165)) — exactly the right way to defer for a 50-year system. |

**Net:** a larger, consistently-shaped, current contract. The lone repeat finding is the script-vs-spec gate proxy, the cheapest remaining doc-integrity fix. **8.6 (▲ +0.1).**

---

## 6. Test Suite Quality & Coverage — 8.5 / 10  (×1.25)

### Strengths
- **The coverage gate is now real and load-bearing.** V5 §6.1 (and V4 §6.1, and V3 §6.1) flagged the same thing three audits running: the coverage step had no floor and was `continue-on-error`. It is now `npx vitest run --coverage --coverage.thresholds.lines=60 --coverage.thresholds.functions=50 --coverage.thresholds.branches=40 --coverage.thresholds.statements=60` with **no `continue-on-error`** anywhere in the file ([ci.yml:78](../../.github/workflows/ci.yml#L78)). A coverage regression now *fails the build*. This is the single most overdue fix in the project, finally landed.
- **e2e runs on PRs.** V5 §6.3: e2e ran on push only. The workflow now triggers on both `push` and `pull_request` to `main` ([ci.yml:3-7](../../.github/workflows/ci.yml#L3)), and the `e2e` job has no event guard — so a UI regression is caught *before* merge, not after.
- **The goals 500 has a regression test** ([constraints.int.test.js:77-104](../../server/test/integration/constraints.int.test.js#L77)) — the exact data shape (a date-bounded goal) that V5 proved was never exercised.
- **a11y nearly doubled** (7 → 15 pages, see §10). Server suite holds at 35 passed / 15 skipped; the integration set (`constraints`, `isolation`, `links`, `settle`) runs against real Postgres in CI ([ci.yml:69-78](../../.github/workflows/ci.yml#L69)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | **The client job does not run coverage** — the floor at [ci.yml:78](../../.github/workflows/ci.yml#L78) is in the *server* job only; the client `Tests` step is plain `npm test` ([ci.yml:111](../../.github/workflows/ci.yml#L111)) | Medium | S | Mirror the `--coverage` floor into the client job (start low, e.g. lines=25, given the thin base — §4.1 — then ratchet). Without it, the 29-page client has no coverage signal. |
| 6.2 | Client unit tests remain 2 files / 8 assertions; the new settings/theme hooks, the export flow, and the SSE accumulator are untested | Medium | L | Carried from V5 §4.1/§6.x. The server side is well-covered; the client is the gap. |
| 6.3 | Several models (chat.model, embeddings, time.model, `recalcGoalProgress`, the new settings.model) have no dedicated unit test | Low | M | The integration suite exercises some paths; add focused unit tests as the coverage floor ratchets up. |

**Net:** two of the three V5 test-infra findings — the no-floor coverage gate and e2e-on-PR — are *both fixed*, and the goals hole is closed. The client coverage signal and thin client unit base are the remaining drags. This is the dimension that moved most on substance. **8.5 (▲ +0.4).**

---

## 7. DevOps & CI/CD Maturity — 8.7 / 10  (×1.25)

### Strengths
- **The two highest-ROI V5 pipeline findings are both done.** Coverage floor (no longer `continue-on-error`, real thresholds) and e2e-on-PR — the items V5 called "the two highest-ROI pipeline upgrades, both carried verbatim from V4" — are executed ([ci.yml:3-7,78](../../.github/workflows/ci.yml#L3)). The pipeline is now genuinely *load-bearing*: lint (0 warnings), `npm audit --audit-level=high`, OpenAPI completeness, real Postgres migrations + integration tests, a coverage floor, and a full Playwright run with screenshot artifacts on failure.
- **Prometheus monitoring is now deployable, not just documented.** V5 §8.1 flagged that the alert rules lived only in the RUNBOOK. They ship now: `deploy/prometheus/prometheus.yml` (scrape config, job `polymath-api` → `api:3000`) and `deploy/prometheus/alert_rules.yml` with **6 rules** (HighErrorRate, P99LatencySpike, PoolExhaustion, PoolNearCapacity, HealthCheckFailing, ScrapeDown), plus a commented-out `prometheus` service in `docker-compose.yml` mounting them at `/etc/prometheus` ([docker-compose.yml:123-131](../../docker-compose.yml#L123)).
- **The working tree is clean.** V5 §7.3 flagged that the goals fix made `main` and the working tree disagree. Resolved — `git status` is empty.
- **Carried topology:** `pgvector/pgvector:pg16` in compose, `USER node`, Node 22 pinned, healthchecks, the off-host backup sidecar, and the SSE-aware nginx block.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | OpenAPI gate counts `addPath` in the script, not the spec | Low | S | See §5.1 — the lone remaining gate-rigor item. |
| 7.2 | Backup sidecar `apk add aws-cli` at container start; no "last backup age" alert; no resource limits/log-rotation on compose services | Medium/Low | M/S | Carried from V4/V5 §7.2. The new `alert_rules.yml` is the place to add a backup-freshness alert once a backup-timestamp metric exists. |
| 7.3 | The `prometheus` compose service is **commented out** ([docker-compose.yml:125](../../docker-compose.yml#L125)) — monitoring ships but isn't on by default | Low | XS | Intentional (keeps the default stack lean); document the one-line uncomment in RUNBOOK as the "turn on monitoring" step. |

**Net:** red → green was V5's story; V6's is *rigorous*-green — the gates now enforce coverage and PR-time e2e, and monitoring is shippable. The only repeat is the OpenAPI proxy. **8.7 (▲ +0.4).**

---

## 8. Observability & Debugging — 8.6 / 10  (×1.0)

### Strengths
- **The Prometheus config gap (V5 §8.1) is closed.** Six alert rules are committed and deployable ([alert_rules.yml](../../deploy/prometheus/alert_rules.yml)); RUNBOOK §6.2 references them and aligns the scrape job label to `polymath-api`. The expressions are sound: error-rate ratio, P99 from the duration histogram, pool waiting/capacity, `/health` 503 rate, and `up == 0`.
- **The audit trail extended to the new surfaces.** `EXPORT_ALL` logs userId/format/reqId ([export.js:97-100](../../server/routes/export.js#L97)); `SETTINGS_UPDATE` logs the changed keys ([settings.js:40-43](../../server/routes/settings.js#L40)) — both following the structured-event convention used across all 7 waves.
- **Carried:** prom-client HTTP histogram/counter + pool gauge; route label prefers `req.route?.path`; pino redaction of cookie/auth headers; Sentry on `SENTRY_DSN`.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | **AI upstream calls aren't instrumented** — there's now a 60/120/30 s timeout (§2) but no `chat_upstream_duration` histogram, so timeout frequency and latency are invisible to Prometheus | Medium | M | Add a histogram around the `fetch` in chat.js/embeddings.js and an alert rule for AI timeout rate. This makes the new AbortController behavior observable. |
| 8.2 | No distributed tracing/APM; the export ZIP duration/size isn't metered | Low | M | Carried; a per-request `export_bytes` counter would catch the §2.3 memory concern early. |

**Net:** alerts are deployable for the first time and the new mutations are logged; the unobserved AI upstream is the next-most-valuable instrument to add. **8.6 (▲ +0.2).**

---

## 9. Performance & Scalability — 7.7 / 10  (×1.0)

### Strengths
- **Aggregations stay in SQL; no N+1 crept into the new code.** Export fans out 10 module reads via `Promise.all` ([export.js:46-69](../../server/routes/export.js#L46)) rather than per-row queries; settings is a single indexed lookup on `UNIQUE (user_id)`. The dashboard/review/polymath fan-outs remain server-side.
- **AbortController bounds tail latency** — a slow provider now fails fast instead of pinning a connection for an hour.
- **Bundle discipline held.** Main chunk **262.63 KB / 83.29 KB gzip** (essentially flat vs V5's 262.35); `mdeditor` and `prism` stay lazy; PWA precaches 30 entries for near-instant repeat loads.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | `mdeditor` chunk **1,059.81 KB / 363.28 KB gzip** still trips Vite's >500 KB warning | Medium | M | Carried from V4/V5 §9.1; acceptable (lazy + cached), but it's the one persistent build warning. |
| 9.2 | Export loads all 10 modules (up to 100k rows) into memory before zipping ([export.js:46-83](../../server/routes/export.js#L46)) | Low (single-user) | M | See §2.3 — stream per-module if data grows. |
| 9.3 | Uploads on single-node local disk; in-process connection pool; lazy per-user `ensureDefaults` on read paths | Medium/Low | L/M | **The consciously-deferred ceiling** (see §14.1). Fine at single-user scale; the documented R2 migration plan (RUNBOOK §4) is the escape hatch. |

**Net:** the new features are efficient and the AbortController helps tail latency; the same two deferred ceilings (mdeditor weight, single-node) persist by choice. **7.7 (▲ +0.1).**

---

## 10. UI/UX Quality & Accessibility — 8.6 / 10  (×1.0)

### Strengths
- **a11y coverage nearly doubled — V5 §10.1 closed.** `a11y.spec.js` now audits **15 pages** across both viewports (30 a11y runs): the original 7 plus Reading, Contacts, Ideas, Goals, Weekly Review, Annual Report, Polymath Dashboard, and **AI Chat** ([a11y.spec.js:9-24](../../client/e2e/a11y.spec.js#L9)). AI Chat — the dynamic streaming surface V5 called "the highest-value untested" — is now axe-audited.
- **Cross-device preference UX.** The dark-mode toggle persists server-side ([useTheme.js:32-36](../../client/src/hooks/useTheme.js#L32)), and AI Chat pre-selects the user's preferred model ([AIChat.jsx:85-92](../../client/src/pages/AIChat.jsx#L85)) — preferences now feel like the system *knows* you, not just this browser.
- **Carried:** focus trap + restore via `useId()`, per-route titles, the `⌘K` palette, the grouped sidebar, four-state lists, dark mode, installable PWA, global Export action.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | **Modal-open / streaming states still aren't axe-audited** — the 15 pages are tested at rest, but not with a dialog open or mid-SSE-stream | Low | M | Add a focused axe pass with a modal open and during a chat stream (the most dynamic DOM). |
| 10.2 | The theme cross-device read path is half-wired (§4.2), so a new device may not reflect the saved theme on first paint | Low | S | Pairs with §4.2. |
| 10.3 | No documented contrast/keyboard walkthrough artifact | Low | S | Carried; capture an axe HTML report as a CI artifact. |

**Net:** a11y now matches the system's breadth (15 pages incl. the AI chat), and preferences add genuine personalization polish. The remaining items are dynamic-state coverage and the theme read-path. **8.6 (▲ +0.2).**

---

## 11. Code Quality & Maintainability — 8.3 / 10  (×1.0)

### Strengths
- **Three V5 code-quality findings closed.** (a) The client now has an `enums.js` mirror, consumed by `LinkedItems`/`ContactDetailModal`/`Contacts`, removing the per-component re-declaration V5 §11.1 flagged. (b) ARCHITECTURE.md's stale migration note is fixed — it documents `016_user_settings.sql` as shipped, with full schema and rationale ([ARCHITECTURE.md:186-238](../ARCHITECTURE.md#L186)), replacing V5 §11.2's "create `008_`" error. (c) The uncommitted working-tree change (V5 §11.3) is committed; the tree is clean.
- **The route→model→SQL and component→hook→API patterns held through the fix-wave without erosion.** `settings.js`/`settings.model.js` and `export.js` read like the rest of the codebase: same envelope, same `(userId, …)` argument order, same Zod-on-mutation, heavy JSDoc with *why*-comments ([settings.model.js:31-39](../../server/models/settings.model.js#L31) is a model example).
- **Design rationale is now first-class.** ARCHITECTURE.md's "Key Design Decisions" explains no-`/api/v1`, session-vs-JWT, disk-attachments, and typed-vs-EAV settings — each with a revisit trigger. This is the most maintainability-relevant change in the whole fix-wave.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | **CONTRIBUTING.md is now the stale one.** "Adding a DB Migration … the latest is `007_entity_links.sql`, so the next is `008_…`" ([CONTRIBUTING.md:86](../../CONTRIBUTING.md#L86)) — the latest is `016`, so the next is `017_`. This is the *exact* staleness class V5 §11.2 flagged in ARCHITECTURE.md, fixed there but re-homed here | Low | XS | Update to "the latest is `016_user_settings.sql`, so the next is `017_`." Better: have the doc point at "run `ls server/db/migrations/ | tail -1`" so it can never go stale. |
| 11.2 | CONTRIBUTING.md's CI description ([:58-59](../../CONTRIBUTING.md#L58)) omits the coverage, OpenAPI, migrate, and e2e steps that now exist | Low | S | Bring it level with the actual `ci.yml`. |
| 11.3 | No type checking (`checkJs`/TS) | Low | M | Carried from V4/V5. JSDoc is thorough but unenforced. |

**Net:** three V5 findings closed (enum mirror, ARCHITECTURE note, clean tree) and design rationale documented — a real maintainability gain. The catch is that the fix-wave's speed left two *new* doc-staleness items (CONTRIBUTING migration number, CI description). Net clearly positive. **8.3 (▲ +0.3).**

---

## 12. Long-Term Sustainability & Roadmap — 8.7 / 10  (×1.0)

### Strengths
- **The system absorbed its own audit and executed it.** V5's "Path Forward" listed eight concrete items; this audit verifies that **seven shipped** (export, settings, AbortController, coverage floor + e2e-on-PR, Prometheus config, a11y extension, enums mirror) and the eighth (the goals fix) is committed + tested. A project that can take a 522-line audit and turn its findings into shipped code in days is, by definition, sustainable.
- **The canonical docs are current and rationale-rich.** ARCHITECTURE.md, CHANGELOG.md ([Unreleased] → "Post-V5 Medium-Term Fixes" block), PROJECT_STATE.md (108 KB), RUNBOOK.md, SECURITY.md, and the OpenAPI spec form a near-complete picture (the README is the one laggard — see §14.3). Design decisions carry their *why* and their revisit triggers.
- **Dependencies are current and lock-pinned.** `npm ci` + committed lockfiles; ranges are caret (`^`) with one deliberate exact pin (`@uiw/react-md-editor: 4.1.1`, the heavy editor) — a sensible supply-chain posture (see §14.4).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | **There is still no formal "Wave 8+" roadmap.** V5 noted "the map is blank past here"; the fix-wave was reactive (closing V5 gaps), not a forward plan. Habits, reminders, agentic AI, multi-device are named in V5's "Moonshots for 2027" but not in a living roadmap doc | Medium | M | Promote the §8 roadmap below into a tracked `docs/ROADMAP` entry so the next decade has a spine, the way V4's roadmap gave V5 one. |
| 12.2 | README staleness (§14.3) undercuts the otherwise-current doc set | Low | S | See §14.3 — the first-read doc should reflect the 18-module reality. |
| 12.3 | No feature-flag mechanism for risky rollouts | Low | M | Carried; env-key gating works for AI but isn't general. The `user_settings` table is now the natural home for per-user feature toggles. |

**Net:** the strongest possible sustainability signal — an audit's findings executed in full — tempered by the absence of a *forward* roadmap and the README lag. **8.7 (▲ +0.1).**

---

## 13. Product-Market Fit for Personal Productivity — 7.6 / 10  (×2.0)

> Re-weighted to ×2.0 for V6 (the "expanded PMF re-eval"), and re-scored against the *post-fix-wave* system. **V5: 6.4.**

### 13.1 Cross-Module Integration — 2.7 / 3  *(V5: 2.6)*

The connective tissue V4 said was missing is now mature and *exported*: 22-type `entity_links`, 6-table unified search, AI context injection from 6 entity types, goal rollups across 6 types, and four correlated dashboards. The marginal gain since V5: **the export proves the integration** — `_SUMMARY.json` plus 10 module files in one ZIP is the first time the *whole* connected dataset is addressable as a unit ([export.js:104-136](../../server/routes/export.js#L104)). Still short of a full 3 because some links are manual and `recalcGoalProgress` is on-demand.

### 13.2 Workflow Support — 1.6 / 2  *(V5: 1.6)*

Unchanged: morning routine (Today Dashboard), research session (capture → tag → attach → link → timer → semantic search → Ask AI), reading, and the reflection loop are all end-to-end. The two multi-page modules — **Engineer (6 pages) and Finance (6 pages)** — still lack a single sprint board / one-screen financial review. This is the largest remaining *workflow* gap and the clearest PMF opportunity left.

### 13.3 Data Portability & Longevity — 1.7 / 2  *(V5: 1.0)*

**The big mover.** V5 called export-all "the single most cost-effective PMF win still on the table." It shipped: `GET /api/export` streams a ZIP of **all 10 data modules** as JSON (`?format=csv` for CSV), with a manifest counting rows per module ([export.js:87-138](../../server/routes/export.js#L87)). Combined with the Annual Report / Polymath multi-year views and "Save to Research," the user can now extract their entire corpus in open formats. *Not a full 2* only because **uploaded attachments are not in the export ZIP** (it covers DB rows, not the files on disk) — a true "everything" export would bundle `server/uploads/` too.

### 13.4 Personalization & Adaptability — 1.7 / 2  *(V5: 1.3)*

**The second mover.** `user_settings` ships server-side theme, default AI model, and notification preference, lazily seeded, Zod-validated ([016_user_settings.sql](../../server/db/migrations/016_user_settings.sql), [settings.js](../../server/routes/settings.js)). AI Chat consumes `default_model` ([AIChat.jsx:85-92](../../client/src/pages/AIChat.jsx#L85)); the theme toggle writes through. *Not a full 2* because the **cross-device read path is half-wired** (§4.2) — preferences *save* to the server but `useTheme` still *initializes* from `localStorage`, so a new device doesn't yet pull the saved theme on first load.

### 13.5 Missing Capabilities — −0.1 / (−1 … 0)  *(V5: −0.15)*

Still genuinely missing: **habit streaks/calendar** (only a `goal_type: 'habit'` option), **reminders/notifications** (PWA installable, no web-push — though `notifications_enabled` now exists in `user_settings`, so the *preference* is ready before the *channel*), and native mobile. The deduction is near zero.

### 13.6 Total for §13

2.7 + 1.6 + 1.7 + 1.7 − 0.1 = **7.6 / 10.**

**Interpretation:** V5 (6.4) had two named, costed gaps — portability and personalization — and both shipped. The remaining sub-7 ceiling is no longer about *missing capability*; it's about *completion* (attachments-in-export, theme read-path, the notification channel) and *consolidation* (Engineer/Finance sprint/finance views). On a ×2.0 weight, this +1.2 is the second-largest contributor to the blended rise after §14. **7.6 (▲ +1.2).**

---

## 14. The 50-Year Lens — 8.2 / 10  (×2.0) — NEW

> The defining dimension of V6. Not "does it work in 2026?" but "is it architected to evolve to 2076?" Scored across four sub-dimensions. For a 50-year system, **longevity *is* reliability.**

### 14.1 Architectural Longevity — 2.5 / 3

**The stack is deliberately, valuably boring.** PostgreSQL, Express, and React are three of the most durable, best-documented, most-hireable technologies in software. None is a framework-of-the-month; all have multi-decade trajectories and enormous communities. PostgreSQL in particular is the single best 50-year bet in the repository — its on-disk format, SQL surface, and tooling are stable across decades, and the schema uses *no* proprietary features that would lock it in (`VARCHAR + CHECK` instead of `ENUM` types specifically "for easier ALTER," [ARCHITECTURE.md:85](../ARCHITECTURE.md#L85)).

**The core abstractions are timeless and consistently applied.** route → model → SQL on the server, component → hook → API on the client — the same two shapes across 7 waves and the fix-wave, with no erosion. A developer who learns one router learns all 19. The middleware stack is documented in order ([ARCHITECTURE.md:145-160](../ARCHITECTURE.md#L145)), so the request lifecycle is legible.

**The migration runner is built to survive decades of schema change** ([migrate.js](../../server/db/migrate.js)): per-file transactions, multi-pass dependency resolution (`42P01` deferral), already-exists tolerance (so a hand-built DB adopts the runner without a rewrite), and an advisory lock against concurrent runs. This is the mechanism that lets the schema keep evolving without a "big bang" rebuild.

**The one hard ceiling: single-node assumptions.** Uploads live on local disk and the connection pool is in-process ([§9.3](#9-performance--scalability--77--10-10)), so horizontal scale / true multi-device requires the documented (but unbuilt) R2 migration. For a single-user 50-year tool this is *acceptable* — one human doesn't need horizontal scale — but it's the architectural decision most likely to need revisiting if the user's life changes (a team, a family, multiple writers). It costs the half-point.

**Score: 2.5 / 3** — timeless abstractions, a durable stack, a self-healing migrator; docked only for the single-node ceiling.

### 14.2 Data Longevity & Portability — 2.5 / 3

**All user data is exportable in open, documented formats.** `GET /api/export` produces a ZIP of 10 modules as pretty-printed JSON or CSV, with a `_SUMMARY.json` manifest ([export.js:104-136](../../server/routes/export.js#L104)). There are **no proprietary or binary formats** anywhere in the data model — research content is Markdown text, links are rows, settings are typed columns. In 50 years, JSON and CSV will still be trivially readable; that is the whole point.

**The system is rebuildable from `pg_dump` + source alone.** The schema is fully documented in ARCHITECTURE.md (every table, every key column), `migrate.js` reconstructs it from the committed SQL, and the off-host backup sidecar pushes nightly `pg_dump`s to S3/R2 ([SECURITY.md:64](../../SECURITY.md#L64)). A complete disaster-recovery path exists: restore the dump, `npm run migrate` (idempotent), deploy the source. The migration runner's already-exists tolerance means even a partial/legacy DB adopts cleanly.

**The one gap: attachments aren't in the portable bundle.** Uploaded files live on disk and are *not* included in the export ZIP (§13.3) — so "export everything" today means "export every DB row," not "export every byte." For true 50-year portability the export should bundle `server/uploads/`, and the R2 migration plan should make attachment URLs durable. Forward-only migrations (no `down`) are a minor note — the recovery contract is "restore from backup," which is reasonable but should be stated explicitly.

**Score: 2.5 / 3** — open formats, full DB rebuildability, off-host backups; docked for attachments-outside-export.

### 14.3 Self-Documentation — 1.6 / 2

**The canonical docs are strong and — crucially — explain *why*.** ARCHITECTURE.md is a genuine single source of truth (stack, data flow, route map, schema conventions, middleware order, env vars) and its "Key Design Decisions" section documents the *rationale and revisit trigger* for each major choice: no-`/api/v1` (and exactly when to add it), session-vs-JWT, disk-attachments, typed-columns-vs-EAV ([ARCHITECTURE.md:165-225](../ARCHITECTURE.md#L165)). CHANGELOG, PROJECT_STATE, RUNBOOK, SECURITY, and the 93-path OpenAPI spec complete the picture. A new developer can onboard via CONTRIBUTING.md's setup steps in well under 30 minutes — clone, `.env`, `npm install`, `npm run migrate`, two dev servers ([CONTRIBUTING.md:17-36](../../CONTRIBUTING.md#L17)).

**But the first door is the wrong shape.** README.md — the *first* file anyone (including future-you) opens — still describes only the **Wave-1 system**: it lists Dashboard, Todo, Finance, Research, Learning, Engineering, and Universal Links, and **omits the eleven modules built since**: Reading, Contacts, Ideas, Time, Goals, Weekly Review, Annual Report, Polymath Dashboard, AI Chat, Export, and Settings ([README.md:7-15](../../README.md#L7)). A reader who stops at the README would believe the system is less than half its actual size. And CONTRIBUTING.md's migration-number guidance is stale (§11.1). For a self-documenting 50-year system, the entry-point doc going stale is the highest-leverage self-doc gap there is.

**Score: 1.6 / 2** — excellent rationale-bearing canonical docs; docked because the README (the entry point) lags the system by 11 modules and CONTRIBUTING has a stale pointer.

### 14.4 Evolvability — 1.6 / 2

**The architecture is genuinely additive — proven, not asserted.** Seven waves and a post-V5 fix-wave each *added* tables, routers, models, pages, and enum entries **without rewriting the core**. The fix-wave is the cleanest evidence: adding Universal Export and Settings meant two new files each and *two new lines* in `index.js` ([:241-242](../../server/index.js#L241)) — the middleware stack, error handler, and auth were untouched. New linkable types are additive (append to `enums.js` + the mirror + the CHECK). This is exactly the property that makes "the next 100 features" plausible.

**Components are replaceable in isolation.** The route→model split means the SQL engine could change behind a model without touching routes; the hook→API split means the UI could be rebuilt against the same `/api` contract (the OpenAPI spec makes that contract machine-readable). The local-vs-cloud AI backend is already swappable via `provider` ([chat.js](../../server/routes/chat.js)).

**Two evolvability gaps.** (a) **No general feature-flag mechanism** — risky rollouts are gated by env-key *presence* (AI) only; there's no per-feature toggle, though `user_settings` is now the natural home for one. (b) **No API versioning yet** — correctly deferred *with* a documented trigger, so this is a managed risk, not an oversight. Dependencies are caret-ranged with committed lockfiles and a clean `npm audit` — a reasonable supply-chain stance for surviving the churn of the next decade, though exact-pinning the most security-sensitive deps would harden it further.

**Score: 1.6 / 2** — proven additive architecture and replaceable components; docked for the missing feature-flag mechanism and (managed) lack of versioning.

### 14.5 Total for §14

2.5 + 2.5 + 1.6 + 1.6 = **8.2 / 10.**

**Interpretation:** Polymath OS is, by the standards of a 50-year system, **architected to last** — the durable trifecta stack, the additive route/model/component spine, open-format exports, a self-healing migrator, and (the rarest property) documented rationale for its big decisions. The four half-points it loses are honest and actionable: the single-node ceiling (14.1), attachments-outside-export (14.2), the README lag (14.3), and the missing feature-flag mechanism (14.4). None is structural; all are completion. **8.2 — the highest a brand-new, deliberately-demanding dimension could credibly earn.**

---

## Cross-Cutting Themes

**1. The system can now metabolize its own audits — and that is the real 50-year signal.** V4 diagnosed a product gap and V5 verified the seven-wave roadmap that closed it. V6 verifies that V5's *own* eight-item Path Forward shipped almost in full, in days, against the actual code. A 50-year project will be audited dozens of times; what matters is not any single score but whether findings reliably become fixes. This one did — coverage floor, e2e-on-PR, export, settings, AbortController, Prometheus, a11y, enums. The mechanism that turns critique into committed code is the most valuable thing the project has demonstrated.

**2. "Boring on purpose" is the architecture's deepest strength.** PostgreSQL + Express + React, `VARCHAR + CHECK` over `ENUM`, JSON/CSV over any binary format, sessions over JWT, typed columns over EAV — at every fork the project chose the durable, legible option over the clever one, and *documented why*. For a system meant to be maintained by one person for decades, boredom is a feature: it minimizes the surface that can rot, the knowledge that can be lost, and the dependencies that can disappear. This is the single trait most responsible for the 8.2 in §14.

**3. The remaining gaps have migrated from *structure* to *documentation drift*.** V4's gaps were architectural (no cross-module links). V5's were completion (no export, no settings). V6's most characteristic gaps are *docs lagging shipped code*: the README still describes the Wave-1 system, CONTRIBUTING still says the next migration is `008_`, the CI OpenAPI gate still counts the script not the spec, SECURITY still omits the AI egress. None breaks anything today. But for a self-documenting 50-year system, *the docs are part of the product*, and a fast fix-wave outran them. The cure is a discipline, not a feature: treat the README/CONTRIBUTING/SECURITY as release artifacts that ship *with* the code.

**4. The "single door in the closed loop" is now bounded but still undisclosed.** For six waves the system never sent data off-host; Wave 7 opened a deliberate door to DeepSeek. V6's AbortController bounds it operationally (no infinite hang) and the local Ollama path makes it optional — but SECURITY.md still doesn't tell the user the door exists. The engineering around the egress is careful; the *disclosure* is the one piece of trust-debt the project carries. For a tool that holds a person's research, finances, and reflections for 50 years, naming exactly what leaves the host is non-negotiable, and it's a one-paragraph fix.

**5. Personalization shipped the preference before the channel — a pattern worth noticing.** `user_settings.notifications_enabled` exists before any notification channel; `default_model` exists and is consumed; `theme` saves but doesn't yet fully read back cross-device. The project is laying *substrate* ahead of *feature* — which is the right order for a long-lived system (the schema is the expensive, slow-to-change part), but it means several capabilities are "90% wired." The next wave's job is less to build new substrate than to complete the last 10% of wiring on what's already there: theme read-path, the push channel behind the preference, attachments into the export.

**6. The score has plateaued in the high-8s, and that is the correct shape.** V1→V5 rose fast because the system was being *built*. V6's +0.2 is small because the foundation is *done* — what remains is polish, completion, and the genuinely new (habits, agentic AI). A 50-year project should expect this: the steep part of the curve is the founding decade; the next four decades are a long, gentle climb of refinement. The flattening is not stagnation — it's maturity.

---

## Complete Feature Inventory V6

| Wave | Feature | Status | Evidence |
|------|---------|--------|----------|
| 1 | Universal Links (`entity_links`, 22 types) | ✅ | [007_entity_links.sql](../../server/db/migrations/007_entity_links.sql); [enums.js](../../server/lib/enums.js); client mirror [enums.js:10-16](../../client/src/lib/enums.js#L10) |
| 1 | Ownership-validated link API (both sides, 404-on-miss) | ✅ | [links.js](../../server/routes/links.js); SECURITY.md |
| 1 | `<LinkedItems>` + `<LinkPickerModal>` shared components | ✅ | consume `client/src/lib/enums.js` |
| 2 | Today Dashboard (date-scoped, 5 modules incl. Engineer) | ✅ | [dashboard.js](../../server/routes/dashboard.js); TodayDashboard.jsx |
| 2 | QuickCapture command palette (⌘K, 4 modes) | ✅ | QuickCapture.jsx |
| 3 | Reading Tracker (shelves, timer, ratings) | ✅ | `008_reading_tracker.sql`; Reading.jsx |
| 3 | Unified Search (`UNION ALL`, 6 tables) | ✅ | search.model.js |
| 4 | Contacts CRM | ✅ | contacts.js; `009_contacts.sql`; client enums badges |
| 4 | Ideas Tracker | ✅ | ideas.js; `011_ideas.sql` |
| 4 | Revenue tx type (founder income) | ✅ | `010_revenue_tx_type.sql` |
| 5 | Time Tracking (server-computed duration, timer UI) | ✅ | `012_time_entries.sql`; time.model.js |
| 5 | Weekly Review (7-module rollup) | ✅ | review.js `/weekly` |
| 5 | Goals/OKRs (linked-entity progress) | ✅ | `013_goals.sql`; goals.model.js |
| 5 | Annual Report (8-module) | ✅ | review.js `/annual` |
| 6 | Semantic Search (pgvector, ivfflat) | ✅ | `014_pgvector.sql`; embeddings.model.js |
| 6 | Local AI Auto-Tag | ✅ | autoTagger.js; research.js `/suggest-tags` |
| 6 | PWA (installable, offline, autoUpdate) | ✅ | vite.config.js; `dist/sw.js` (30 precache) |
| 6 | Polymath Dashboard (multi-year, 6 modules) | ✅ | polymath.js |
| 7 | AI Chatbox (DeepSeek, dual backend) | ✅ | chat.js; AIChat.jsx |
| 7 | SSE Streaming (token-by-token, headersSent guard) | ✅ | [chat.js:158-272](../../server/routes/chat.js#L158) |
| 7 | AI context injection (6 entity types, `user_id`-scoped) | ✅ | chat.model.js |
| 7 | "Ask AI" deep links (4 modules) + Save-to-Research | ✅ | AIChat.jsx |
| **Post-V5** | **Universal Export (10 modules, JSON/CSV ZIP, manifest)** | ✅ | [export.js:45-138](../../server/routes/export.js#L45); `archiver` dep; AppLayout action |
| **Post-V5** | **`user_settings` (theme/model/notifications, cross-device)** | ✅ | [016_user_settings.sql](../../server/db/migrations/016_user_settings.sql); settings.js; settings.model.js; useSettings.js |
| **Post-V5** | **AbortController on all 3 AI upstream calls** | ✅ | [chat.js:171-217](../../server/routes/chat.js#L171); [embeddings.js:45-46](../../server/lib/embeddings.js#L45) |
| **Post-V5** | **Prometheus config shipped (6 alert rules)** | ✅ | [deploy/prometheus/alert_rules.yml](../../deploy/prometheus/alert_rules.yml); prometheus.yml |
| **Post-V5** | **Axe a11y 7 → 15 pages** | ✅ | [a11y.spec.js:9-24](../../client/e2e/a11y.spec.js#L9) |
| **Post-V5** | **Client enums mirrored** | ✅ | [client/src/lib/enums.js](../../client/src/lib/enums.js) |
| **Post-V5** | **goals `getGoalStats` fix committed + tested** | ✅ | [goals.model.js:174-175](../../server/models/goals.model.js#L174); [constraints.int.test.js:77-104](../../server/test/integration/constraints.int.test.js#L77) |
| **Post-V5** | **CI coverage floor (60/50/40/60) + e2e-on-PR** | ✅ | [ci.yml:3-7,78](../../.github/workflows/ci.yml#L3) |
| **Post-V5** | **ARCHITECTURE.md current (016 + rationale)** | ✅ | [ARCHITECTURE.md:186-238](../ARCHITECTURE.md#L186) |
| — | Attachments inside the export ZIP | ❌ | export covers DB rows, not `server/uploads/` (§13.3) |
| — | Web-push reminders | ❌ | `notifications_enabled` exists; no push channel |
| — | Habit streaks/calendar | ⚠️ | `goal_type: 'habit'` exists; no streak UI |
| — | Theme cross-device *read* path | ⚠️ | writes server-side; `useTheme` still inits from `localStorage` (§4.2) |
| — | README reflecting 18-module reality | ❌ | README still describes Wave-1 (§14.3) |

---

## V5 → V6 Remediation Ledger — Verified

Every V5 "Path Forward" item and every numbered V5 gap, checked against shipped code on 2026-06-13. This is the evidence that the system metabolized its own audit (Cross-Cutting Theme 1).

| V5 Item | V5 Priority | Done? | Evidence |
|---------|-------------|-------|----------|
| **Commit the `getGoalStats` fix** (V5 §3.1) | **Critical** | ✅ | [goals.model.js:174-175](../../server/models/goals.model.js#L174); working tree clean |
| **Universal Export** — `GET /api/export` ZIP of per-table JSON/CSV (V5 §13.3) | High | ✅ | [export.js:45-138](../../server/routes/export.js#L45); 10 modules; `_SUMMARY.json` manifest |
| **`user_settings` table (`016_`)** — server-side prefs (V5 §12.2/§13.4) | High | ✅ | [016_user_settings.sql](../../server/db/migrations/016_user_settings.sql); settings.js; settings.model.js; useSettings.js |
| **Coverage floor + e2e-on-PR** (V5 §6.1/§6.3) | High | ✅ | [ci.yml:78](../../.github/workflows/ci.yml#L78) (60/50/40/60, no `continue-on-error`); [ci.yml:3-7](../../.github/workflows/ci.yml#L3) (PR trigger) |
| **AbortController on AI `fetch`** (V5 §2.1) | Medium | ✅ | [chat.js:171-217](../../server/routes/chat.js#L171) (120/60 s); [embeddings.js:45-46](../../server/lib/embeddings.js#L45) (30 s) |
| **Ship Prometheus config** (`deploy/prometheus/`) (V5 §8.1) | Medium | ✅ | [alert_rules.yml](../../deploy/prometheus/alert_rules.yml) (6 rules); prometheus.yml; compose service |
| **Extend axe a11y** to new pages incl. AIChat (V5 §10.1) | Medium | ✅ | [a11y.spec.js:9-24](../../client/e2e/a11y.spec.js#L9) — 15 pages |
| **Mirror `enums.js` to the client** (V5 §11.1) | Low | ✅ | [client/src/lib/enums.js](../../client/src/lib/enums.js); consumed by LinkedItems/Contacts |
| **Goals stats integration test** (V5 §6.2) | Medium | ✅ | [constraints.int.test.js:77-104](../../server/test/integration/constraints.int.test.js#L77) |
| **Fix ARCHITECTURE migration note** (V5 §11.2) | Low | ✅ | [ARCHITECTURE.md:186-238](../ARCHITECTURE.md#L186) — documents `016_` with rationale |
| **Document AI egress in SECURITY.md** (V5 §1.1) | Medium | ❌ | **Un-actioned** — [SECURITY.md:70-75](../../SECURITY.md#L70) has no egress section |
| **Lock `/metrics` at the app port** (V5 §1.2) | Low | ⚠️ | Edge-blocked by nginx only; still unauthenticated at app port ([index.js:191](../../server/index.js#L191)) |
| **OpenAPI gate parses spec, not script** (V5 §5.1) | Low | ❌ | **Un-actioned** — [ci.yml:61](../../.github/workflows/ci.yml#L61) still greps `addPath(` |
| Engineer/Finance workflow consolidation (V5 §13.2) | Polish | ❌ | Deferred — still 6+6 pages, no sprint/finance one-screen view |
| Habit streaks/calendar (V5 §13.5) | Polish | ❌ | Deferred — `goal_type: 'habit'` only; no streak UI |

**Tally: 10 fully done, 1 partial, 4 not done.** The done items are the entire load-bearing list (the bug, export, settings, gate rigor, timeouts, monitoring, a11y, enums, the regression test, the doc fix). The not-done cluster around *disclosure* (egress doc), *gate polish* (OpenAPI proxy), and *future product* (Engineer/Finance consolidation, habits) — none structural, and the egress doc is the one High-value miss.

**New items surfaced this audit** (the cost of a fast fix-wave): CONTRIBUTING.md migration note now stale (§11.1); README still describes the Wave-1 system, omitting 11 modules (§14.3); theme cross-device *read* path half-wired (§4.2); attachments not in the export ZIP (§13.3/§14.2).

---

## The Complete Score Journey (V1 → V6)

```
| #  | Section                          | Wt   | V1  | V2  | V3  | V4  | V5  | V6  | Δ V5→V6 |
|----|----------------------------------|------|-----|-----|-----|-----|-----|-----|---------|
| 1  | Security                         | ×2.0 | 5.5 | 8.0 | 8.8 | 8.9 | 9.0 | 9.0 |   —     |
| 2  | Backend Resilience               | ×1.5 | 6.0 | 7.0 | 7.6 | 8.2 | 8.5 | 8.7 | ▲ +0.2  |
| 3  | Database Integrity               | ×1.5 | 7.0 | 7.5 | 7.8 | 8.4 | 8.5 | 8.7 | ▲ +0.2  |
| 4  | Frontend Reliability             | ×1.5 | 6.5 | 7.5 | 7.6 | 7.9 | 8.4 | 8.5 | ▲ +0.1  |
| 5  | API Design & Docs                | ×1.0 | 7.0 | 7.5 | 6.8 | 8.2 | 8.5 | 8.6 | ▲ +0.1  |
| 6  | Test Suite                       | ×1.25| 3.0 | 6.0 | 7.2 | 7.8 | 8.1 | 8.5 | ▲ +0.4  |
| 7  | DevOps & CI/CD                    | ×1.25| 6.0 | 7.5 | 8.0 | 7.5 | 8.3 | 8.7 | ▲ +0.4  |
| 8  | Observability                    | ×1.0 | 4.5 | 6.5 | 6.8 | 8.3 | 8.4 | 8.6 | ▲ +0.2  |
| 9  | Performance                      | ×1.0 | 5.5 | 6.5 | 7.2 | 7.4 | 7.6 | 7.7 | ▲ +0.1  |
| 10 | UI/UX & Accessibility            | ×1.0 | 7.0 | 7.5 | 7.4 | 8.1 | 8.4 | 8.6 | ▲ +0.2  |
| 11 | Code Quality                     | ×1.0 | 7.0 | 7.5 | 8.0 | 7.8 | 8.0 | 8.3 | ▲ +0.3  |
| 12 | Sustainability                   | ×1.0 | 6.5 | 8.0 | 8.5 | 7.8 | 8.6 | 8.7 | ▲ +0.1  |
| 13 | Product-Market Fit               | ×2.0 |  —  |  —  |  —  | 2.8 | 6.4 | 7.6 | ▲ +1.2  |
| 14 | The 50-Year Lens                 | ×2.0 |  —  |  —  |  —  |  —  |  —  | 8.2 |  NEW    |
|    | Technical only (12 dims, Σ15.0)  |      | 6.4 | 7.5 | 7.7 | 8.1 | 8.4 | 8.6 | ▲ +0.2  |
|    | Blended (14 dims, Σwt = 19.0)    |      | 6.4 | 7.5 | 7.7 | 7.6 | 8.2 | 8.4 | ▲ +0.2  |
```

**Blended math (V6):** Σ(score × weight) = 160.45 over Σweights 19.0 = **8.44 → 8.4.** Weights: dims 1-12 = 15.0; PMF ×2.0 (raised from ×1.5 for the expanded re-eval, +0.5); §14 ×2.0 (NEW). Technical-only (dims 1-12) = 128.85 / 15.0 = **8.59 → 8.6.**

**The journey in one line:** V1 (6.4) was six promising tools; V2–V3 (7.5–7.7) hardened them; V4 (7.6) diagnosed that engineering had outrun product; V5 (8.2) was the audit where product caught up; and **V6 (8.4) is the audit where the system proved it can absorb its own findings *and* showed — through the new 50-year lens — that what was built is built to last.**

---

## The 50-Year Roadmap

### What must NEVER change — the invariants

These are the architectural decisions that earned the §14 score. Treat them as load-bearing walls; everything else is renovation.

1. **The data lives in PostgreSQL, in open formats, fully exportable.** No proprietary stores, no binary formats, no data that can't leave. This is the bedrock of 50-year portability.
2. **The route → model → SQL and component → hook → API spine.** Two shapes, applied uniformly. It's why one developer can hold the whole system in their head, and why the next 100 features stay legible.
3. **Additive evolution.** New capability = new tables + new routers + new pages + new enum entries. The core middleware, error envelope, and auth must keep being *extended*, not *rewritten*.
4. **`user_id` scoping on every query, ownership validated at the API.** The security model that has held for six waves and two new routers.
5. **Documented rationale for every major decision.** The "why," not just the "what" — the single most valuable thing for a future maintainer (including future-you).
6. **`pg_dump` + source = a complete rebuild.** The disaster-recovery contract. Never introduce state that lives only in a running process or a third-party service.

### What SHOULD evolve — continuously improved, never sacred

- **The AI layer** (DeepSeek/Ollama, models, prompts, context injection) — the fastest-moving part of the stack; expect to swap models and providers many times. The `provider` abstraction already supports this.
- **The frontend framework and build tooling** — React 19/Vite today; in 20 years it may be something else. The hook→API split and the OpenAPI contract make the UI replaceable without touching the server.
- **The dependency set** — caret ranges + lockfile; audit and bump regularly; exact-pin the security-sensitive ones.
- **The dashboards and reports** — these reflect the user's evolving life and should be revisited as priorities shift.
- **Storage topology** — single-node disk today; the documented R2 migration when/if multi-device or scale demands it.

### What's next (2026–2027) — the last 10% and the first new wave

| Item | Type | Priority | Effort |
|------|------|----------|--------|
| **Document AI egress in SECURITY.md** (§1.1) | Trust | **High** | XS |
| **Fix the README** to reflect all 18 modules; fix CONTRIBUTING migration note (§14.3/§11.1) | Docs | **High** | S |
| **Complete the theme cross-device read path** (hydrate from `user_settings`, §4.2) | Product | High | S |
| **Bundle attachments into the export ZIP** (§13.3/§14.2) — true "everything" export | Product | High | M |
| **Web-push reminders** behind the existing `notifications_enabled` preference | Product | High | M |
| **Habit tracking as a real loop** (streaks/calendar on `goal_type: 'habit'`) | Product | Medium | M |
| **Engineer & Finance workflow consolidation** (sprint board + one-screen finance, §13.2) | Product | Medium | L |
| **Instrument AI upstream latency** + a feature-flag mechanism on `user_settings` (§8.1/§14.4) | Tech | Medium | M |
| **OpenAPI gate parses the spec, not the script** (§5.1) | Tech | Low | S |

### What's next (2027–2036) — the decade ahead

- **Agentic AI.** The context-injection foundation is built; the natural next step is letting the chatbox *act* — create a linked todo, start a timer, draft a research entry — via tool-calling against the existing routes, always with confirmation. This is the capability that turns Polymath OS from a system you *query* into one that *works alongside you*.
- **Multi-device, done right.** `user_settings` is the first step off `localStorage`; the full version means the R2 attachment migration and a sync story. This is the decision point where the single-node ceiling (§14.1) gets revisited.
- **The system grows with the life.** A startup that hires (the single-tenant assumption meets its trigger); a research career that accumulates a decade of linked papers (semantic search becomes the primary navigation); a family (shared vs. private data). The schema's additive nature is what makes these survivable.
- **Knowledge compounding.** With 10 years of `entity_links`, the graph itself becomes the product — "show me everything connected to this idea across a decade" is a query the foundation already supports.

### What's next (2036–2076) — the lifetime vision

A personal productivity system that serves one person for 50 years is not a product — it's an **externalized memory and second brain that outlives every framework it was built on.** The bet this architecture makes is the right one: that PostgreSQL and open formats will still be readable in 2076, that the data matters more than the UI, and that a documented "why" lets a future maintainer (a 70-year-old version of the owner, or whoever inherits it) understand a decision made half a century earlier. The UI will be rewritten three or four times. The AI will be unrecognizable. But the `entity_links` graph, the research corpus, the financial ledger, the reading history — exported as JSON, restored from `pg_dump`, rebuilt from source — these are the through-line. **The job of the next 50 years is to never break that through-line, and to keep the "why" current.**

---

## Final Verdict

**1. Is Polymath OS production-ready?** **Yes — unambiguously, for its single-user scope.** Zero `npm audit` vulnerabilities on both packages, **9/9 quality gates green**, a clean working tree, a DB-aware health check, atomic financial settles, graceful shutdown, container hardening, an off-host backup sidecar, and — new in V6 — bounded AI timeouts, a load-bearing coverage floor, e2e-on-PR, and deployable Prometheus alerts. The one live correctness bug from V5 (`getGoalStats`) is committed and regression-tested. There is no blocking defect.

**2. Is Polymath OS maintainable?** **Yes — and this is its standout property.** Two abstractions (route→model→SQL, component→hook→API) applied without erosion across 7 waves and a fix-wave; a single-source enum set (now mirrored to the client); canonical docs that explain *why*, not just *what*; and a self-healing migration runner. A developer — including a future version of the owner — can onboard in under 30 minutes and understand any module by reading one other. The maintainability tax is real but small: the README and CONTRIBUTING docs lagged the fast fix-wave and need to catch up.

**3. Is Polymath OS scalable?** **For its single-user scope across decades, yes; for multi-tenant/multi-device, not yet — by design.** SQL-side aggregation, dual-direction link indexes, an ivfflat vector index, lazy bundle chunks, and PWA precaching push the single-user ceiling far higher than the workload needs. The honest limits — single-node uploads, in-process pool — are *documented* with a migration plan (RUNBOOK §4) and a revisit trigger (ARCHITECTURE.md). For one human's 50 years, the architecture scales with the *life*, not with traffic, and the additive schema is what makes that growth survivable.

**4. Is the vision achieved?** **Substantially, yes.** V4's benchmark — a single morning screen pulling tasks, budget, receivables, reading progress, linked papers, an open P0, and logged hours — exists (Today Dashboard + Links + Time + Reading + Engineer). Around it: unified search, an AI that knows your context, weekly/annual/multi-year reflection, goals that roll up linked work, and now **the ability to export your entire corpus and carry your preferences across devices.** The system genuinely serves the researcher (linked corpus + semantic search), the engineer (the toolkit + sprint data), the founder (contacts + ideas + revenue), and the polymath (the cross-module graph). The open 10% is completion (attachments-in-export, theme read-path, the notification channel) and the genuinely new (habits, agentic AI) — not foundation.

**5. What is the single most important thing to protect?** **The data through-line: PostgreSQL + open-format exports + `pg_dump`-rebuildability + documented schema.** Everything else — the React UI, the Express server, the DeepSeek integration, even the specific features — can be rewritten, replaced, or lost and the system survives. What *cannot* be lost is the user's accumulated corpus and the ability to read it in 50 years. The moment any data lives only in a binary blob, a proprietary service, or an undocumented schema, the 50-year promise breaks. Guard the through-line above all else.

**6. What is the single most impactful next step?** **Document the AI egress in SECURITY.md — then write the forward roadmap.** The egress disclosure is a one-paragraph fix that closes the project's only real trust-debt (a tool holding a lifetime of research and finances must name exactly what leaves the host). And the absence of a *forward* roadmap (§12.1) is the one thing V6 cannot verify into existence: V4 and V5 each succeeded because the *prior* audit drew the map. The most impactful thing for the *next* 50 years is to draw the next map — promote this §8 roadmap into a living `docs/ROADMAP` so 2027's audit has a spine the way 2026's did.

---

**The journey:** V1 (6.4) was six good apps behind one login. V2–V3 hardened them. V4 (7.6) named the gap between engineering and product. V5 (8.2) closed it. And **V6 (8.4)** — the last audit of the foundation era and the first of the 50-year journey — confirms a system that not only works, but is *built to keep being built*: durable in its stack, additive in its structure, portable in its data, and documented in its reasoning. The foundation is laid. It is a good foundation. **Now build the next fifty years on it — and keep the "why" current as you go.**

---

*Audit V6 conducted 2026-06-13. All scores cite shipped code, migration files, or verbatim command output captured the same day. The working tree was clean at audit time (`git status` empty). This is the foundation document for a lifetime of development.*
