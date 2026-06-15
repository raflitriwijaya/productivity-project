# Grand Final Audit V9 — Polymath OS: The Input-Correctness Reckoning

**Auditor:** Distinguished Systems Architect, Principal SRE & QA Director (40+ yrs)
**Date:** 2026-06-14
**Repository:** `project-productivity` (React 19 + Vite/Rolldown / Node 22 + Express 5 / PostgreSQL 16 + pgvector)
**Scope:** The most rigorous audit in project history. Verify that the IDR ×100 fix is *real*, that the new multi-layered test suite is *meaningful*, that **every money input field** roundtrips correctly, and that the Six Invariants hold. Introduce and score **§15 — UX Input Validation Correctness (×2.0)**, the dimension V1–V8 missed.
**Previous Audits:** V1 (6.4) → V2 (7.5) → V3 (7.7) → V4 (7.6) → V5 (8.2) → V6 (8.4) → V7 (8.6) → V8 (8.7, 14-dim)
**The Constitution:** `docs/audit/50_YEAR_LENS.md`

---

## Executive Summary

**The working tree is finally clean, a real feature shipped, and the test suite grew enormously — but the dimension this audit was created to examine reveals that the famous ×100 bug was fixed by swapping it for a quieter cousin, and the celebrated 20,000-iteration money test suite validates a function production no longer calls.**

Three things are unambiguously better than V8. First, **Invariant 6 is restored**: `git status` is clean (`git status --porcelain` returns nothing) — breaking the three-audit dirty-tree pattern (V6 clean → V7 dirty → V8 dirty → **V9 clean**). Second, a **genuine feature shipped**: Custom Learning Roadmaps (migration `019`, `roadmaps.js`, `roadmap.model.js`, two pages, six components, 13 endpoints) — purely additive, exemplary schema hygiene, `user_id`-scoped throughout. Third, the **test surface expanded dramatically**: property-based (20,000 iterations), fuzzing, database integrity (9 real-DB checks), performance baselines, visual regression, full smoke, and a mutation-testing config.

**But §15 — the new dimension — exposes the system's blind spot, and it is the same blind spot that let the original bug survive eight audits.** The fix removed `formatIdrInput`/`parseIdrInput` from the money forms (killing the ×100 *over*-correction) and replaced them with a raw `Number()` call over a string stripped to `[0-9.]`. That strip **keeps the dot**. So `Number("50.000")` → **50**, not 50000. The literal input from the original bug report — `"50.000"` — *still produces a wrong stored value* in every money field; the error simply flipped from ×100-over (5,000,000) to ×1000-under (50). And the Account opening-balance field is worse: `Number("1.500.000") || 0` silently stores **0** with no validation. Meanwhile **`parseIdrInput` — the function that maps `"50.000"` → 50000 correctly — is referenced only in `formatIdr.js` and the two test files. No form, page, or component calls it.** The property suite asserts `parseIdrInput('50.000') === 50000` ten thousand times against a function the submit path never invokes. *This is the V8 lesson recurring inside the very tests written to prevent it.*

**The numbers tell an honest story: technical dimensions held or rose, the new feature lifted PMF, but §15 holds the headline flat.** Technical-only (dims 1–12) is **8.8 (flat)**. The 14-dim comparable rises to **8.8 (+0.1)** on the clean tree, the new feature, and the integrity tests. But the **15-dim blended is 8.7** — because §15 scores **7.5**, and at ×2.0 it absorbs the gains everywhere else. That is the correct outcome: the system got materially better, *and* the one lens that mattered most found that the most important class of bug is not yet truly defended against.

**Verdict: production-ready, not yet input-correct.** The Foundation Era is one fix away from complete. That fix is small (wire `parseIdrInput` into the five form submit handlers, or strip the dot in `onChange`), but until it lands, a user typing money the way Indonesians write money gets the wrong number, silently.

---

## Quality Gates — Actual Results

Every command executed on **2026-06-14** against the working tree. **Working tree is CLEAN.** ✅

| Gate | Command | V8 Result | **V9 Result** | Δ |
|------|---------|-----------|---------------|----|
| Server audit | `npm audit` (server) | ✅ 0 vulns | ⚠️ **2 moderate** (`qs` DoS via `typed-rest-client`) | ▼ **regression** |
| Server lint | `npm run lint` (server) | ✅ clean | ✅ **clean** (exit 0) | — |
| Server tests | `npm test` (server) | ✅ 42 passed / 15 skipped | ✅ **46 passed / 38 skipped** (8 files passed, 6 skipped) — `Duration 5.35s` | ▲ +4 passed |
| OpenAPI generation | `npm run openapi` | ✅ 100 paths | ✅ **108 paths** — `OpenAPI spec written … 108 paths` | ▲ +8 |
| Client audit | `npm audit` (client) | ✅ 0 vulns | ✅ **found 0 vulnerabilities** | — |
| Client lint | `npm run lint` (client) | ✅ clean | ✅ **clean** (exit 0) | — |
| Client tests | `npm test` (client) | ✅ 8 passed (2 files) | ✅ **71 passed (4 files)** — incl. property + fuzz | ▲ **+63** |
| Client build | `npm run build` | ✅ main 265.00 KB / 84.12 KB gzip | ✅ main `index-DCo7T2xY.js` **265.95 KB / 84.35 KB gzip**; `mdeditor` 1,059.81 KB (lazy); `prism` 85.37 KB (lazy); ⚠️ Vite >500 KB warning; PWA **33 entries / 1,607.89 KiB**; `built in 1.86s` | ~ flat |
| Playwright | `npx playwright test --list` | ✅ 50 tests / 2 files | ✅ **128 tests / 4 files** (smoke, a11y, +visual, +smoke-full) — latter two **opt-in/skipped** | ▲ +78 (mostly opt-in) |

**Spot checks (all by command this audit):**

| Check | V8 | **V9** | Method |
|-------|----|--------|--------|
| `docs/openapi.json` paths | 100 | **108** | `Object.keys(paths).length` |
| `addPath` calls in generator | 152 | **165** | `grep -c addPath server/scripts/generate-openapi.js` |
| Migration files | 22 | **23** | `ls server/db/migrations/*.sql \| wc -l` (+`019_learning_roadmaps.sql`) |
| Client pages | 31 | **33** | `ls client/src/pages/*.jsx \| wc -l` (+`LearningRoadmaps`, +`RoadmapDetail`) |
| Server routers | 20 | **21** | `ls server/routes/*.js \| wc -l` (+`roadmaps.js`) |
| Server models | 17 | **17** | `ls server/models/*.js \| wc -l` (+`roadmap.model.js`, −0 net listed) |
| `deploy/prometheus/alert_rules.yml` rules | 8 | **8** | `grep -c 'alert:'` |
| `LINKABLE_TYPES` server == client | 22 == 22 | **24 == 24** | `node -e …` both files |
| **Working tree** | **⚠️ dirty (3 files)** | ✅ **CLEAN** | `git status --porcelain` → empty |

**8/9 quality gates green; the binary "is `git status` clean?" check now PASSES.** The one regression is `npm audit` on the server (0 → 2 moderate).

---

## Section Scores

| # | Dimension | Weight | V8 | **V9** | Δ |
|---|-----------|--------|-----|--------|---|
| 1 | Security & Authentication | ×2.0 | 9.2 | **9.0** | ▼ −0.2 |
| 2 | Backend Resilience & Reliability | ×1.5 | 8.7 | **8.7** | — |
| 3 | Database Integrity & Data Safety | ×1.5 | 8.8 | **9.0** | ▲ +0.2 |
| 4 | Frontend Reliability & Error Resilience | ×1.5 | 8.8 | **8.8** | — |
| 5 | API Design & Documentation | ×1.0 | 9.0 | **9.1** | ▲ +0.1 |
| 6 | Test Suite Quality & Coverage | ×1.25 | 8.6 | **8.5** | ▼ −0.1 |
| 7 | DevOps & CI/CD Maturity | ×1.25 | 8.6 | **8.7** | ▲ +0.1 |
| 8 | Observability & Debugging | ×1.0 | 8.8 | **8.8** | — |
| 9 | Performance & Scalability | ×1.0 | 8.1 | **8.2** | ▲ +0.1 |
| 10 | UI/UX Quality & Accessibility | ×1.0 | 8.8 | **8.8** | — |
| 11 | Code Quality & Maintainability | ×1.0 | 8.5 | **8.4** | ▼ −0.1 |
| 12 | Long-Term Sustainability & Roadmap | ×1.0 | 9.0 | **9.0** | — |
| 13 | Product-Market Fit | ×2.0 | 8.3 | **8.5** | ▲ +0.2 |
| 14 | 50-Year Readiness | ×2.0 | 8.8 | **9.1** | ▲ +0.3 |
| 15 | **UX Input Validation Correctness (NEW)** | **×2.0** | — | **7.5** | ★ |
| | **Technical-only (dims 1–12, Σ15.0)** | | 8.8 | **8.8** | — |
| | **Blended 14-dim (dims 1–14, Σ19.0)** | | 8.7 | **8.8** | ▲ +0.1 |
| | **Blended 15-dim (dims 1–15, Σ21.0)** | | — | **8.7** | ★ |

**Blended math (V9, 15-dim):** Σ(score × weight) = **181.75** over Σweights **21.0** = **8.65 → 8.7.**
Technical-only (dims 1–12) = **131.55 / 15.0 = 8.77 → 8.8.**
14-dim comparable (no §15) = **166.75 / 19.0 = 8.78 → 8.8** (+0.1 vs V8).

> **The shape, in one line.** Most dimensions improved (clean tree, new feature, integrity tests, complete contract). The new §15 at 7.5 — heavy at ×2.0 — pulls the 15-dim blended back to 8.7. The system is better than V8 in everything the previous audits measured, and the new measurement is exactly where it needs work.

---

## 1. Security & Authentication — 9.0 / 10  (×2.0)

### Strengths
- **Auth core intact:** `requireAuth` → `req.session.userId` → `req.user.id`; bcryptjs cost 12; session regeneration; parameterized SQL everywhere; secrets server-side only; `helmet` CSP + prod HSTS.
- **New feature added no new auth surface.** `roadmaps.js` is mounted `app.use('/api/roadmaps', requireAuth, roadmapsRouter)` ([server/index.js](../../server/index.js)); every model function in `roadmap.model.js` is `user_id`-scoped; `links.js` gained ownership validators for the two new linkable types.
- **Egress documentation, CSP, export cap, pre-upload ownership check** all carried from V8 intact.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | **`npm audit` regressed 0 → 2 moderate** on the server: `qs 6.11.1–6.15.1` (remotely-triggerable DoS in `qs.stringify`, GHSA-q8mj-m7cp-5q26) pulled in transitively via `typed-rest-client`. | Medium | S | `cd server && npm audit fix`. The vulnerable `qs` is nested under `typed-rest-client` (not the runtime Express request path), and the app is single-user behind a Cloudflare Tunnel, so real-world exposure is low — but a clean `npm audit` was a V8 property and is now broken. |
| 1.2 | `/metrics` unauthenticated at the app port | Low | S | Carried V5–V8. Edge-blocked by nginx. |
| 1.3 | No CSRF token — defence is `sameSite: lax` + CORS | Medium | M | Carried. Documented limitation. |

**Net:** the architecture is unchanged and the new feature was added securely, but the `npm audit` regression is real and breaks a clean-bill property V8 highlighted. **9.0 (▼ −0.2).**

---

## 2. Backend Resilience & Reliability — 8.7 / 10  (×1.5)

### Strengths
- **The new roadmap layer is resilient by construction.** `recalcProgress` runs after every milestone mutation and rewrites track + roadmap progress as `completed ÷ non-skipped` — progress is *derived*, never user-set (the same discipline as `deriveStreak`). Roadmap creation with inline starter tracks is wrapped in a transaction (per CHANGELOG; consistent with `settle` atomicity patterns).
- **All V8 resilience patterns intact:** AbortController bounds on AI upstreams; export streaming with `archive.on('error')` + `res.headersSent` guard; graceful shutdown; DB-aware `/health`.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | No retry/backoff on transient DB errors | Medium | M | Carried V3–V8. |
| 2.2 | Export remains one unbounded request | Low | M | Carried. |
| 2.3 | `recalcProgress` is on-demand (recomputed per mutation) | Low | — | Acceptable at single-user scale; could thrash on a milestone bulk-import. |

**Net:** the new feature added derived-state discipline, not risk. **8.7 (—).**

---

## 3. Database Integrity & Data Safety — 9.0 / 10  (×1.5)

### Strengths
- **The integrity test file codifies the schema contract as runnable assertions** ([server/test/integrity.test.js](../../server/test/integrity.test.js)) — 9 checks against a real Postgres: core tables exist, `chk_entity_link_types` CHECK present, no orphaned `entity_links`, **every `user_id` FK is `ON DELETE CASCADE`** (with a non-vacuous-pass guard `rows.length > 0`), the transactions non-zero CHECK, the transfer dedup index, the `uq_entity_link` UNIQUE, the `habit_logs` one-per-day UNIQUE, and `set_updated_at()`. This is the first audit where Invariant-6-relevant constraints are *tested*, not just asserted in prose. It correctly reuses the integration harness and skips cleanly with no DB.
- **Migration 019 is exemplary additive evolution** ([server/db/migrations/019_learning_roadmaps.sql](../../server/db/migrations/019_learning_roadmaps.sql)): SERIAL PK, `user_id` FK `ON DELETE CASCADE` on all three new tables, VARCHAR enums via CHECK (never `ENUM`), `TIMESTAMPTZ`, the shared no-arg `set_updated_at()` trigger, `idx_{table}_{cols}` indexes, `DROP TABLE IF EXISTS … CASCADE` re-runnability, and the `entity_links` CHECK re-added with all 22 prior types preserved + 2 new (24 total).
- **Clean working tree restores the rebuild contract** (see §14).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | Migrations forward-only (no `down`) | Low | L | Carried; conscious trade. |
| 3.2 | The integrity suite does not run in the default `npm test` lane (skips without `DATABASE_URL`); it runs only in CI after `migrate` | Low | S | Acceptable, but note the local `npm test` gives no integrity signal. |

**Net:** the constraint contract is now tested in real Postgres, the new migration is textbook, and the tree is clean. **9.0 (▲ +0.2).**

---

## 4. Frontend Reliability & Error Resilience — 8.8 / 10  (×1.0… ×1.5)

### Strengths
- **Money forms never throw on hostile input.** Every money `onChange` strips to `[0-9.]` and every submit coerces with `Number()`; invalid input becomes `NaN`/`0` and is caught by per-field validation or reset — verified in `Budget`, `Portfolio`, `Accounts`, `CreateTransactionModal`, `PortfolioModal`, `LedgerModal`. No form-submit crash path exists (the fuzz suite confirms `parseIdrInput` never throws, and `Number()` never throws either).
- **New roadmap pages follow the four-state pattern** (CHANGELOG: card grid with stat cards/filter pills/create modal/all four states; detail page with progress + track lanes + Connections). The attachment Content-Type fix is in place (`api.js` no longer sets a default `Content-Type`).
- **Carried:** root `ErrorBoundary`, `429 ≠ 401`, lazy Research/Engineer pages, ⌘K palette, installable PWA.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | **The money inputs silently mis-coerce dot-grouped values** (see §15.1). The frontend doesn't crash — it stores the wrong number. This is a *reliability of result*, not *reliability of process*, gap. | **High** | S | Wire `parseIdrInput` into the submit handlers, or strip `.` in `onChange`. |
| 4.2 | Commented-out dead `axios.create` block persists in `api.js` ([api.js:19-23](../../client/src/lib/api.js#L19)) — and now carries mixed-language (Indonesian) comments | Low | XS | Carried from V8 §4.3. Delete the commented block. |
| 4.3 | Client unit coverage of *pages* is still thin (the 71 passing tests are concentrated in `formatIdr`, `forms.fuzz`, `MarkdownSanitization`, `QuickCapture` — not page-level) | Medium | L | Carried V6–V8. |

**Net:** processes are resilient (no crashes), but the input layer produces silently-wrong results. The frontend doesn't fall over; it quietly lies. **8.8 (—)** — held flat, with the correctness penalty taken in §15 where it belongs.

---

## 5. API Design & Documentation — 9.1 / 10  (×1.0)

### Strengths
- **The contract stayed complete through a feature wave.** `addPath` calls 152 → **165**; emitted spec 100 → **108 paths**. The 13 new roadmap endpoints (`/stats`, tracks, milestones, `/:id`, `/recalc`) are all documented under a new `Roadmaps` tag.
- **Route hygiene held for the new router.** Verified literal-before-parameterized ordering in `roadmaps.js`: `/stats` (132), `/tracks/:trackId` (177), `/milestones/:milestoneId` (235) all registered *before* `/:id` (275) — the exact ordering CLAUDE.md mandates. `validate(schema)` is present on all seven mutating routes.
- Envelope `{ success, data }`/`{ success, error }` intact; `user_id` scoping universal.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | **CI OpenAPI gate still counts `addPath` in the generator, not paths in the emitted spec** ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)) | Low | S | Carried V4–V8. Parse `docs/openapi.json` and assert `Object.keys(paths).length`. |
| 5.2 | No API versioning | Low | M | Documented decision. |

**Net:** the spec absorbed a 13-endpoint feature without falling behind, with correct route ordering. **9.1 (▲ +0.1).**

---

## 6. Test Suite Quality & Coverage — 8.5 / 10  (×1.25)

### Strengths
- **Breadth exploded.** New: `formatIdr.property.test.js` (property-based + exhaustive edge cases, 20,000 random iterations across roundtrip/idempotence/×100-guard), `forms.fuzz.test.js` (hostile-string battery), `integrity.test.js` (9 real-DB constraint checks), `performance.test.js` (14 endpoint latency baselines), `visual.spec.js` (10-page screenshot regression), `smoke-full.spec.js` (29-route crash sweep), and a Stryker mutation config. Client tests 8 → **71**; server **46 passed**.
- **The integrity and property files are genuinely well-built** — deterministic, calibrated against the real implementation (the NBSP `U+00A0` separator is pinned; the parse-rejection block documents the hardening rationale).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | **🔴 The money test suite validates a function production no longer calls.** `formatIdr.property.test.js` and `forms.fuzz.test.js` import and assert `parseIdrInput`/`formatIdrInput` — but a repo-wide grep shows those two functions are referenced **only** in `formatIdr.js` and the two test files. The forms submit via `Number()`. The fuzz file's own header claims *"Every money `<input>` … funnels its raw string through `parseIdrInput` at submit time"* — this is **false**. The suite asserts `parseIdrInput('50.000') === 50000` 10,000× while the live path computes `Number('50.000') === 50`. **This is the exact failure mode (tests don't exercise the real input path) that let the ×100 bug survive 8 audits — reproduced inside the regression suite written to prevent it.** | **Critical** | M | Either (a) wire `parseIdrInput` into the five submit handlers and keep the tests, or (b) add a test that drives the *actual* `onChange → Number()` form path. The current tests give false confidence. |
| 6.2 | **The most powerful new suites don't run by default or in CI.** `visual.spec.js` (`RUN_VISUAL`), `smoke-full.spec.js` (`RUN_SMOKE`), `performance.test.js` (`TEST_SERVER`), and `integrity.test.js` (needs `DATABASE_URL`) all skip in the standard lanes. Of 128 Playwright tests listed, the visual + full-smoke majority are opt-in. Mutation testing has a config but no recorded score and no CI job. | Medium | M | Wire integrity into the CI post-migrate lane (likely already intended); generate + commit visual baselines; schedule a periodic mutation run. |
| 6.3 | Client coverage floor still absent from CI (plain `npm test`, no `--coverage`) | Medium | S | Carried V6–V8 (Roadmap 1.9). |
| 6.4 | Mutation config targets `models/*.js`, `AppError`, `enums` — **not `formatIdr.js`** | Low | S | Add `lib/formatIdr.js` equivalent to the client mutation scope; it is the single most safety-critical pure function in the app. |

**Net:** an impressive quantitative leap that, on the one axis this audit exists to check, tests the wrong function and leaves the real path uncovered — while its strongest suites sit outside the default lane. Breadth up, but the targeting defect is serious. **8.5 (▼ −0.1).**

---

## 7. DevOps & CI/CD Maturity — 8.7 / 10  (×1.25)

### Strengths
- **The dirty-tree pattern is broken.** `git status --porcelain` is empty. After V6 (clean) → V7 (dirty) → V8 (dirty), V9 is **clean** — the single most-flagged process gap across three audits is closed.
- Pipeline rigor intact: real-Postgres migrations + integration tests, server coverage floor, e2e-on-PR, 8 Prometheus alert rules.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | **New high-value suites are not in CI** (visual/full-smoke/performance opt-in; integrity needs DB; mutation has no job) — see §6.2 | Medium | M | The suites exist but the pipeline doesn't exercise them; latent value, not realized value. |
| 7.2 | `npm audit` regression (server 0 → 2 moderate) | Medium | S | `npm audit fix`; consider an `npm audit --audit-level=high` CI gate. |
| 7.3 | OpenAPI gate counts the script, not the spec | Low | S | Carried (§5.1). |

**Net:** the clean tree is a real maturity win; offset by the new suites living outside CI and the audit regression. **8.7 (▲ +0.1).**

---

## 8. Observability & Debugging — 8.8 / 10  (×1.0)

### Strengths
- New roadmap mutations log structured `ROADMAP_*` audit events with `userId`/`reqId` (CHANGELOG); pino request logging covers the new router.
- Carried: prom-client HTTP histogram/counter + pool gauge, AI upstream duration histogram, pino redaction, Sentry-on-DSN, 8-rule alert set.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | No metric for `recalcProgress` cost or export attachment-bundling size/duration | Low | M | Carried/new-minor. |
| 8.2 | No distributed tracing/APM | Low | L | Carried. |

**Net:** instrumentation conventions extended cleanly to the new feature. **8.8 (—).**

---

## 9. Performance & Scalability — 8.2 / 10  (×1.0)

### Strengths
- **Bundle held flat through a feature wave:** main 265.95 KB / 84.35 KB gzip (V8: 265.00 / 84.12) — the two new pages did not inflate the main chunk (roadmap pages are reachable via the route tree without bloating the entry).
- **Performance baselines are now codified** ([server/test/performance.test.js](../../server/test/performance.test.js)) — 14 endpoints with explicit ms ceilings (e.g. `/polymath` ≤ 2000 ms, `/dashboard/today` ≤ 1000 ms). A regression will fail loudly *once wired into a live-server lane*.
- New roadmap queries are indexed (`idx_milestones_due` is a partial index `WHERE status != 'completed'`).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | `mdeditor` chunk **1,059.81 KB** still trips Vite's >500 KB warning | Medium | M | Carried V4–V8 (lazy + cached). |
| 9.2 | Performance baselines never run without `TEST_SERVER` | Low | S | Add a smoke perf run against the ephemeral CI server. |

**Net:** flat bundle + codified (if opt-in) baselines. **8.2 (▲ +0.1).**

---

## 10. UI/UX Quality & Accessibility — 8.8 / 10  (×1.0)

### Strengths
- New roadmap UX is rich: progress rings, track lanes, checkbox-toggle milestones with expandable resource links, category filter pills, full dark-mode variants (CHANGELOG + component inventory).
- Carried: focus trap + restore, per-route titles, ⌘K palette, grouped sidebar, four-state lists, global Export, notification bell.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | **The two new pages are NOT in the axe a11y sweep.** `a11y.spec.js` covers 17 pages; `grep roadmap` returns 0 hits. This is the same class as V7 §10.1 (new pages not a11y-audited) — recurring. The `smoke-full.spec.js` sweep includes `/roadmaps` but is opt-in and only checks for crashes, not a11y. | Medium | S | Add `/roadmaps` and a `/roadmaps/:id` (seeded) entry to `a11y.spec.js`. |
| 10.2 | **Money fields give no input-format affordance** — no helper text, no live grouping, placeholder is just `0`. An Indonesian user typing `50.000` sees their dots preserved in the field, reinforcing the belief they typed fifty-thousand, then it stores 50. (See §15.) | Medium | S | Add helper text ("digits only, no separators") or live `formatIdrInput` display. |

**Net:** strong new UX, but a recurring a11y-coverage gap and a money-field affordance gap. **8.8 (—).**

---

## 11. Code Quality & Maintainability — 8.4 / 10  (×1.0)

### Strengths
- **New feature code is clean and convention-following:** named router export, `validate()` middleware, derived progress, enum mirroring, OpenAPI registration — all per CLAUDE.md.
- Clean working tree; CONTRIBUTING self-correcting; SECURITY de-duplicated (carried from V8).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | **Two exported functions are dead in production yet presented as load-bearing.** `parseIdrInput` and `formatIdrInput` are never imported by any form/page/component (grep-verified), but they are exported, extensively tested, and their JSDoc + the test headers imply the forms use them. Dead code masquerading as critical code is a maintainability hazard: a future dev will "fix a bug" in `parseIdrInput` and see no production effect. | **High** | S | Decide: either re-wire them into the forms (preferred — they're *correct*), or delete them and rewrite the tests against the real path. |
| 11.2 | **Two 50-Year Lens documents still coexist** — `50_YEAR_LENS.md` and `50_YEAR_LENS-deepseek.md` both present. Carried from V8 §11.2/§12.2; now committed (so no longer an Invariant 6 issue) but the dual-constitution ambiguity remains. | Medium | XS | Pick one canonical lens; merge/delete the other. |
| 11.3 | Commented-out dead `axios.create` block in `api.js` (now with mixed-language comments) | Low | XS | Carried V8 §11.1. Delete. |

**Net:** the new code is good, but two dead exported functions with misleading docs, a persisting dual-constitution, and carried dead code accumulate. **8.4 (▼ −0.1).**

---

## 12. Long-Term Sustainability & Roadmap — 9.0 / 10  (×1.0)

### Strengths
- **The audit metabolism produced both a cleanup (V8→clean tree) and a feature (Roadmaps) in one cycle** — and the feature explicitly replaces a hardcoded 12-month roadmap with an unlimited user-defined system "for any discipline … a 50-year, fully-customizable feature" (CHANGELOG). This is Invariant 3 (additive evolution) used to *retire* rigidity without rewriting the old path.
- CHANGELOG is current and detailed; the constitution exists; nine audit cycles deep.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | No feature-flag mechanism (Roadmap 1.7) | Low | M | Carried; `user_settings` is the home. |
| 12.2 | Dual 50-Year Lens documents (§11.2) | Medium | XS | Resolve. |

**Net:** the system grows additively and documents itself. **9.0 (—).**

---

## 13. Product-Market Fit — 8.5 / 10  (×2.0)

### 13.1 Cross-Module Integration — 2.9 / 3 *(V8: 2.8)*
The new roadmaps are first-class `entity_links` participants (2 new linkable types, validators in `links.js`, Connections section on the detail page). The graph grew from 22 to 24 types. **+0.1.**

### 13.2 Workflow Support — 1.9 / 2 *(V8: 1.85)*
Custom learning roadmaps directly serve the polymath persona ("ESP32-S3, STM32, ROS2, gardening, car building, languages") — a concrete new workflow (plan a discipline → tracks → milestones → auto-progress) that didn't exist in V8. **+0.05.**

### 13.3 Data Portability & Longevity — 1.85 / 2 *(V8: 1.85)*
Unchanged in function; new data is open (Postgres rows, JSONB `resources` arrays). Export coverage of the new tables should be confirmed (not separately verified this audit).

### 13.4 Personalization & Adaptability — 1.85 / 2 *(V8: 1.85)*
Roadmaps are entirely user-defined (icon/color/category/tracks). Strong personalization, already near-max.

### 13.5 Missing Capabilities — −0.0 / (−1…0) *(V8: −0.1)*
The hardcoded-roadmap limitation V8 implicitly carried is now resolved. Remaining gaps are next-era (agentic AI, multi-device push).

### 13.6 Total
2.9 + 1.9 + 1.85 + 1.85 − 0.0 = **8.5 / 10.** **+0.2** — a genuine feature wave, the first real PMF lift since V7.

---

## 14. The 50-Year Readiness Dimension (§14, ×2.0) — 9.1 / 10

### 14.1 Constitutional Integrity — 2.9 / 3.0
- **Invariant 1 (open, exportable data):** ✅ All new data in Postgres, open formats.
- **Invariant 2 (route→model→SQL & component→hook→API spine):** ✅ Verified in `roadmaps.js` (route→`roadmap.model.js`→SQL) and the two new pages (component→`api`→envelope).
- **Invariant 3 (additive evolution):** ✅ Migration 019 adds tables and *preserves* the old engineer-roadmap path; `MODEL_COMPAT` (V8) preserved.
- **Invariant 4 (`user_id` scoping):** ✅ Every roadmap/track/milestone query scoped; integrity test asserts every `user_id` FK is `ON DELETE CASCADE`.
- **Invariant 5 (documented rationale):** ✅ CHANGELOG documents the schema-adaptation decision (no `set_updated_at(text)` helper) and the additive rationale.
- **Invariant 6 (`pg_dump` + source = rebuild):** ✅ **RESTORED.** `git status` is clean — the V8 Critical violation is fixed. The integrity suite now *tests* that the rebuilt schema carries its constraints.

**Deduction:** −0.1 — the dual-constitution (§11.2) is a minor blemish on "documented rationale."

### 14.2 Documentation Ecosystem — 1.9 / 2.0
Lens exists, CHANGELOG current, OpenAPI complete (108 paths), SECURITY de-duplicated, enums mirrored 24/24. **−0.1** for the persisting `-deepseek` duplicate lens.

### 14.3 Data Portability & Survivability — 2.0 / 2.0
Clean tree means `main` + `pg_dump` now genuinely rebuilds the running system (the V8 −0.2 is recovered). Backup sidecar + open formats intact. New JSONB `resources` is plain JSON.

### 14.4 Evolvability & Technical Debt — 2.3 / 3.0
- ✅ Clean tree; ✅ contract complete; ✅ constraints tested.
- ⚠️ **−0.4:** dead `parseIdrInput`/`formatIdrInput` (§11.1) + the test suite's false-confidence targeting (§6.1) — debt that actively *misleads* a future maintainer is worse than debt that merely sits.
- ⚠️ **−0.3:** the residual money-input correctness gap (§15) is a latent data-quality landmine for the next 50 years of stored amounts.

### 14.5 Total
2.9 + 1.9 + 2.0 + 2.3 = **9.1 / 10.** Weight ×2.0 = 18.2.

**Interpretation:** The foundation is the strongest it has ever been on the structural axes — six of six invariants hold, the rebuild contract is real and tested, and the system grows additively. The deductions are all about the *input boundary*: dead-but-tested code and an un-defended corruption path. Fix those, and §14 is a 9.5.

---

## 15. UX Input Validation Correctness (§15, ×2.0) — 7.5 / 10  ★ NEW

> The dimension V1–V8 missed. Scored from the **actual production code path**, not the helper functions in isolation.

### How money actually flows (the critical trace)
Every money field uses the **same** pattern: `onChange={e => set(e.target.value.replace(/[^0-9.]/g, ''))}` then submit `amount: Number(form.amount)`. The strip **keeps `.`**, and `Number()` reads `.` as a **decimal point**. `parseIdrInput` (which reads `.` as a **thousands separator**, id-ID convention) is **never called by any form** (grep: referenced only in `formatIdr.js` + the two test files).

### 15.1 IDR / Money Input Fields — 2.5 / 4

Roundtrip per field, with the **real** `Number()` path:

| Field | `50000` | `50.000` (dots) | `1.500.000` | `-50000` | `5e10` | `--50000` |
|-------|---------|-----------------|-------------|----------|--------|-----------|
| Transaction Amount | ✅ 50000 | ❌ **50** | ⚠️ NaN → "non-zero" error | stripped→50000 (or −50000 if adjustment) | strip→`510`→**510** | strip→`50000` |
| Budget Amount | ✅ 50000 | ❌ **50** | ⚠️ NaN → **silent reset to old value, no error** | <0 → silent reset | →**510** | →50000 |
| Portfolio Avg/Current Price | ✅ | ❌ **50** | ⚠️ NaN → "valid price" error | n/a (stripped) | →**510** | →50000 |
| Receivables / Payables Amount | ✅ | ❌ **50** | ⚠️ NaN → "valid positive" error | ≤0 rejected | →**510** | →50000 |
| **Account Opening Balance** | ✅ | ❌ **50** | ❌ **0** (`Number(NaN)\|\|0`, no validation) | →0 | →**510** | →50000 |

**Findings:**
- **🔴 The canonical bug input still corrupts.** `"50.000"` → **50** in *every* money field (×1000 under-correction). The error flipped direction from the ×100-over of the original report; it was not eliminated. **Priority: High. Effort: S.**
- **🔴 Account opening balance has no numeric validation** — `Number(initial || '0') || 0` turns any dot-grouped or invalid entry into **0** silently. Typing `1.500.000` as an opening balance stores `0`. **Priority: High. Effort: S.**
- **🟠 The "hardening" is unreachable.** `parseIdrInput` rejects `5e10`/`0x1A`/`--50000` — but the `onChange` strip removes `e`/`x`/extra-minus *before* `Number()` ever sees them, and `parseIdrInput` isn't called anyway. `5e10` becomes `510`, `--50000` becomes `50000`. The celebrated rejection tests defend a path that doesn't exist. **Priority: Medium.**
- ✅ **What works:** raw-integer entry (`50000`) is correct everywhere; stored→display→submit roundtrips are correct (`toAmountInput` returns ungrouped digits, so editing an existing amount is safe); the ×100 *over*-correction is genuinely gone; multi-dot inputs are at least rejected (not corrupted) in the modal forms.

**Score 2.5/4:** the common path and stored-roundtrip are solid and the worst historical bug is gone, but the literal trigger input still silently corrupts across all six fields, one field coerces invalid→0, and the safe function is benched.

### 15.2 Non-Money Numeric Inputs — 1.7 / 2
- **Goals target value:** `type="number"`, `parseFloat`, validates `Number.isNaN` → "Must be a number." Decimals OK. ✅
- **Learning total/spent hours:** `type="number" step="0.5"`, `parseFloat`, NaN-validated. ✅
- **Learning progress:** `type="number" min=0 max=100`, validated 0–100. ✅
- **Time duration:** server-driven start/stop (`Timer.jsx`) — no manual numeric entry, no corruption surface. ✅
- ⚠️ Minor: no upper bound on hours/target (a user could enter 1e9 hours); `type=number` still reads `.` as decimal, but decimals are legitimate here and these aren't currency. **−0.3.**

### 15.3 Text Input Robustness — 1.6 / 2
- `O'Brien`, `Müller`: ✅ safe — parameterized SQL throughout; the placeholder literally uses `O'Reilly`.
- Long text: Zod caps (`description z.string().max(1000)`, `person max(255)`, names `max(100/255)`) — server rejects over-length cleanly.
- Newlines in textarea: ✅ preserved (TEXT columns).
- Whitespace: ✅ `.trim()` on every text submit.
- Empty vs null: ✅ `field.trim() || null` consistently.
- ⚠️ Client doesn't pre-validate length (relies on server Zod) — a 10k-char paste round-trips to a server 400 rather than an inline hint. **−0.4.**

### 15.4 Date Input Handling — 0.8 / 1
- `type="date"` pickers; `.slice(0, 10)` normalization; server `DATE_RE` regex (`YYYY-MM-DD`); `|| null` when empty; `target_date < start_date` cross-field check on goals.
- ⚠️ Stored as `DATE` strings (no time/timezone) — correct for this domain, but `new Date().toISOString().slice(0,10)` for "today" uses **UTC**, so a user in WIB (UTC+7) near midnight can get yesterday's date. **−0.2.**

### 15.5 Select / Dropdown Correctness — 0.9 / 1
- All enums sourced from the mirrored `enums.js`; sensible defaults (`type:'Expense'`, `priority:'medium'`); load coerces ids via `String()` so the controlled `<select>` matches; type-change resets stale account/category fields (`CreateTransactionModal.set('type')`). ✅
- ⚠️ Tiny: priority `<option value={1}>` is numeric while most selects are strings — works, but inconsistent. **−0.1.**

### 15.6 Total for §15
2.5 + 1.7 + 1.6 + 0.8 + 0.9 = **7.5 / 10.** Weight ×2.0 = 15.0.

**Interpretation:** Non-money, text, date, and select inputs are solid. Money — the dimension's reason for existing — is half-fixed: the over-correction died, but a quieter under-correction (and a silent →0 on one field) lives, and the function that would fix it is wired only to tests. **7.5.**

---

## Test Suite Quality Audit (Phase 4)

| Suite | File | Verdict |
|-------|------|---------|
| Property tests | `formatIdr.property.test.js` | ✅ Pass, well-built, NBSP-pinned — but ❌ tests `parseIdrInput`, **not** the form path. The "x100 GUARD" 10K-iteration test guards a function the forms don't call. |
| Fuzz tests | `forms.fuzz.test.js` | ✅ Pass, never-throws confirmed — but header **falsely** claims forms funnel through `parseIdrInput`. |
| Visual regression | `visual.spec.js` | ⚠️ Opt-in (`RUN_VISUAL`); 10 pages; baselines must be generated/committed first — likely none committed yet. |
| Performance baselines | `performance.test.js` | ✅ 14 sensible thresholds — ⚠️ opt-in (`TEST_SERVER`); never runs in CI. |
| Database integrity | `integrity.test.js` | ✅ Excellent — 9 real constraint checks, non-vacuous-pass guard; runs in CI-with-DB. |
| Full smoke | `smoke-full.spec.js` | ✅ 29 routes, error-boundary + pageerror assertions — ⚠️ opt-in (`RUN_SMOKE`). |
| Mutation testing | `stryker.config.json` | ⚠️ Configured (models/AppError/enums, break=50) — but no recorded score, no CI job, and **`formatIdr.js` is not in scope**. |

**Theme:** the suite is broad and the *server-side* additions (integrity) are load-bearing. The *client money* additions are the weak link — they validate a benched function and don't run the real path — and the heaviest e2e suites are opt-in, so day-to-day CI sees little of the new investment.

---

## Cross-Module Regression Check (Phase 5)

- **All 21 routers mount under `requireAuth`; all 33 pages route** (smoke-full enumerates 29 authenticated routes with crash assertions — opt-in but structurally verified against `App.jsx`). No regressions detected in existing modules.
- **AI Chat:** V4 Flash/Pro + R1 local, `MODEL_COMPAT` backward-compat intact (V8-verified; unchanged this cycle).
- **Export:** JSON/CSV + attachments (V8-verified). ⚠️ Not separately confirmed that the three new roadmap tables are in the export bundle — **flag for next audit**.
- **PWA:** 33 precache entries / 1,607.89 KiB; `sw.js` generated.

---

## The Six Invariants Check (Phase 6)

| # | Invariant | V9 Status | Evidence |
|---|-----------|-----------|----------|
| 1 | Data in PostgreSQL, open formats, fully exportable | ✅ | 23 migrations; new data in `learning_roadmaps`/`roadmap_tracks`/`roadmap_milestones`; JSONB `resources` is plain JSON. |
| 2 | route→model→SQL & component→hook→API spine | ✅ | `roadmaps.js` → `roadmap.model.js` → SQL; new pages use `api` + envelope. Route order correct. |
| 3 | Additive evolution — never rewrite core | ✅ | 019 adds tables, preserves old engineer roadmap; no core middleware touched. |
| 4 | `user_id` scoping on every query | ✅ | All new queries scoped; integrity test asserts every `user_id` FK is `ON DELETE CASCADE`. |
| 5 | Documented rationale for every major decision | ✅ | CHANGELOG documents the schema adaptation + additive intent. ⚠️ dual-constitution is a minor smudge. |
| 6 | `pg_dump` + source = complete rebuild (clean tree) | ✅ | **`git status` clean** — the V8 Critical violation is fixed. |

**All six invariants hold.** First audit since V6 with a clean sweep.

---

## V8 → V9 Remediation Ledger (Phase 7)

| V8 Finding | Status | Evidence |
|------------|--------|----------|
| Dirty working tree (Invariant 6 violation, Critical) | ✅ **Closed** | `git status --porcelain` empty. Three-audit pattern broken. |
| IDR input format bug (×100) | 🟠 **Partially** | ×100 over-correction gone; but `"50.000"` → 50 (×1000 under) and Account balance → 0 persist (§15.1). |
| `parseIdrInput` hardened | ⚠️ **Hollow** | Hardening is correct but unreachable — forms call `Number()`, not `parseIdrInput` (§6.1, §15.1). |
| Test suite built (7 new files) | ✅ **Built** / 🟠 **mis-targeted** | All 7 exist and pass; money suite tests a benched function; strongest suites are opt-in (§6). |
| DeepSeek V4 migration | ✅ **Holds** | `MODELS` + `MODEL_COMPAT` intact (unchanged). |
| Attachment upload fix (Content-Type) | ✅ **Holds** | `api.js` active client sets no default Content-Type. |
| Commented dead code in `api.js` (§4.3/§11.1) | ❌ **Not closed** | Block still present (lines 19-23), now with Indonesian comments. |
| Dual 50-Year Lens (§11.2/§12.2) | ❌ **Not closed** | Both files still present. |
| OpenAPI CI gate counts script not spec (§5.1) | ❌ **Not closed** | Carried. |
| New pages not a11y-audited (V7 §10.1 pattern) | ❌ **Recurred** | Roadmap pages absent from `a11y.spec.js`. |

---

## Cross-Cutting Themes (Phase 8)

**1. The format bug survived 8 audits because no audit ran the *real* input path — and that is still true.** Every prior audit (and now the new property/fuzz suite) examined `formatIdr.js` functions in isolation. None drove a value through `onChange → Number() → submit`. The fix changed *which* function the forms avoid (now they avoid `parseIdrInput` instead of mis-using `formatIdrInput`), but the **test methodology never crossed the form boundary**, so it cannot see that `Number("50.000")=50`. The lesson of V8 was procedural, not code-specific, and the procedure didn't change. *The single highest-leverage action in this entire report is to write one test that fills a real form field and asserts the stored value.*

**2. Dead code that is loudly tested is more dangerous than dead code that is silent.** `parseIdrInput`/`formatIdrInput` are correct, exported, and validated 20,000×, with headers asserting the forms depend on them. A maintainer in 2030 will trust that and be wrong. The combination of (correct function) + (extensive tests) + (false usage claims) + (no production callers) is a uniquely deceptive artifact — it *looks* like the most-protected code in the repo and is actually unreachable.

**3. The system's structural foundation is now genuinely strong — the weakness has migrated to the boundary.** Invariants hold, the tree is clean, the schema is tested, the contract is complete, a real feature shipped additively. Every "interior" axis is 8.7–9.1. The remaining risk is entirely at the **input boundary** (money coercion) and the **CI boundary** (powerful suites not wired in). The 50-year risk is no longer "will the architecture hold?" — it's "will the data going *in* be correct?"

**4. Quantity of tests is not coverage of risk.** Client tests went 8 → 71 and Playwright 50 → 128, yet the one roundtrip that caused the founding crisis is still untested in production form, and most of the new e2e weight is opt-in. A 20,000-iteration suite on the wrong function scores worse, on the dimension that matters, than 3 assertions on the right one would.

**5. A feature wave and a cleanup wave landed together — the healthiest possible cycle — but the audit cadence must now add an input-correctness gate.** V7 was product, V8 was cleanup, V9 was both. The metabolism is excellent. The missing organ is a standing **"fill the form, read it back"** check in CI, so §15 can never silently regress again.

---

## The Complete Score Journey (Phase 9) — V1 → V9

| Audit | Headline | Basis | Note |
|-------|----------|-------|------|
| V1 | 6.4 | early | foundation |
| V2 | 7.5 | | |
| V3 | 7.7 | | |
| V4 | 7.6 | blended | |
| V5 | 8.2 | blended | |
| V6 | 8.4 | blended (13-dim) | |
| V7 | 8.6 | blended (13-dim) | product wave (PMF +0.7) |
| V8 | 8.7 | blended (14-dim) | cleanup wave; §14 introduced; dirty tree (Critical) |
| **V9** | **8.7** | **blended (15-dim)** | **feature + cleanup; §15 introduced (7.5); clean tree; technical 8.8, 14-dim 8.8** |

The headline holds at 8.7 not because the system stalled, but because the new ×2.0 lens (§15) measures a real, previously-invisible gap. On the V8 basis (14-dim), V9 is **8.8 (+0.1)**.

---

## Final Verdict (Phase 10)

1. **Production-ready AND user-ready?** Production-ready: **yes** (clean tree, complete contract, tested constraints, resilient processes). User-ready: **mostly** — with one real caveat: an Indonesian user typing money with dot separators gets a silently wrong value. For a *finance* app, that caveat is not cosmetic.

2. **Remaining input-validation bugs?** **Yes, two, both in money:** (a) `"50.000"` → 50 across all six money fields; (b) Account opening balance coerces any invalid/dot-grouped entry to 0 with no validation. Both High, both Effort-S.

3. **Is the test suite adequate to catch regressions for 50 years?** **Not yet on the one axis that matters.** The integrity tests are 50-year-grade. The money tests are not — they validate a benched function and never drive the real form path, so they would not catch §15.1 regressing. Add one form-roundtrip test and put `formatIdr.js` in mutation scope.

4. **Are all Six Invariants holding?** **Yes — all six.** First clean sweep since V6 (Invariant 6 restored by the clean tree).

5. **Single most important thing to protect?** **The integer stored in every money column.** It is the irreversible artifact; a wrong amount, once saved and trusted, propagates through budgets, net worth, and reports forever.

6. **Single most impactful next step?** **Write one test that fills a money `<input>` with `"50.000"` and asserts the stored value is `50000`** — then make it pass (wire `parseIdrInput` into the submit handlers, or strip `.` in `onChange`). This both fixes the bug and finally closes the 8-audit methodology gap.

7. **Is the Foundation Era complete — ready for Phase 2 (Agentic AI)?** **One fix away.** Structurally, yes — invariants hold, tree clean, feature additive. But building an agent that *writes* financial data on top of an input layer that silently mis-scales money would let the agent inherit and amplify the corruption. **Fix §15.1 first, then begin Phase 2.**

8. **Confidence (1–10) that no silent data-corruption bug reaches production?** **6/10.** Up from what would have been ~3 pre-fix (the ×100 path is genuinely closed and processes don't crash), but capped because a *known, demonstrated* silent corruption (`"50.000"` → 50) is live right now, and the test suite that should catch its class instead validates a function production doesn't call. Close §15.1 and wire the form-roundtrip test, and this rises to 9.

---

## Appendix — Evidence Index

- **Money form path:** `Budget.jsx:29-41`, `Portfolio.jsx:33-45`, `Accounts.jsx:45`, `CreateTransactionModal.jsx:117-163`, `PortfolioModal.jsx:49-86`, `LedgerModal.jsx:53-87` — all `replace(/[^0-9.]/g,'')` + `Number()`.
- **`parseIdrInput`/`formatIdrInput` callers:** grep over `client/src` → only `formatIdr.js` + `formatIdr.property.test.js` + `forms.fuzz.test.js`. **Zero form/page/component callers.**
- **`Number("50.000")` === 50; `Number("1.500.000")` === NaN** (standard JS).
- **Server amount validation:** `finances.js:64` `amount: z.number(...)`, `:95` `initial_balance: z.number().optional()` — accepts whatever number the client sends; no string-parse guardrail.
- **Gates:** server `npm test` 46 passed/38 skipped; client `npm test` 71 passed; `openapi` 108 paths; `addPath` 165; `git status` clean; LINKABLE_TYPES 24==24; server `npm audit` 2 moderate (`qs`/`typed-rest-client`); client `npm audit` 0.
- **Invariant/feature:** `019_learning_roadmaps.sql` (additive, CASCADE, CHECK, trigger, 24-type entity_links); `roadmaps.js` (literal-before-param, validate, requireAuth).
- **Carried-open:** `api.js:19-23` dead block; `docs/audit/50_YEAR_LENS{,-deepseek}.md` both present; `a11y.spec.js` no roadmap entry.

---

*Audit V9 complete. The Foundation Era is one money-input fix and one form-roundtrip test from done.*
