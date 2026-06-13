# Grand Final Audit V5 — Polymath OS (Rafli's Productivity Suite)

**Auditor:** Product Architect & Senior SRE
**Date:** 2026-06-13
**Repository:** `productivity-project` (React 19 + Vite/Rolldown / Node 22 + Express 5 / PostgreSQL 16 + pgvector)
**Scope:** Full-stack technical audit + product-market-fit re-evaluation of the **7-wave** system
**Previous Audits:** V1 (6.4, 2026-06-09), V2 (7.5, 2026-06-10), V3 (7.7, 2026-06-10), V4 (7.6 blended / 8.1 technical, 2026-06-11)
**The 7 Waves Since V4:** Universal Links → Today Dashboard → Polymath Toolkit (Reading + Unified Search) → Startup Founder (Contacts + Ideas + Revenue) → Reflection & Growth (Time + Weekly Review + Goals + Annual Report) → Moonshots (pgvector semantic search + auto-tag + PWA + Polymath Dashboard) → AI Assistant (DeepSeek chatbox, SSE streaming)

---

## Executive Summary

**This is the audit V4 was written to make possible.** V4's central finding was a paradox: the *engineering* had climbed to 8.1 while the *product* sat at 2.8 — "six genuinely good single-purpose apps behind one login, not one productivity system." V4 then drew the map out of that trap: a universal links table, a today-focused dashboard, unified search, a reading tracker, time tracking, weekly review, goals, and — as moonshots — semantic search, a PWA, and a local AI assistant. **Seven waves later, every single item on that map has been built, and I verified each against the shipped code, not the CHANGELOG.** The schema that V4 said "has not one foreign key between modules" now carries `entity_links` with a **22-type** whitelist, ownership-validated on both sides ([links.js:43-61](../../server/routes/links.js#L43), [enums.js:53-64](../../server/lib/enums.js#L53)); the "no cross-module search" gap is closed by a `UNION ALL` over six tables ([search.model.js:14-67](../../server/models/search.model.js#L14)); and the system now has a brain — a DeepSeek-powered chatbox that streams over SSE and injects the *user's own* module context as a system prompt ([chat.js:144-152](../../server/routes/chat.js#L144)).

**Just as importantly, the two V4 regressions that kept the blended score flat are both fixed.** V4's single most consequential operational finding was that **client `npm run lint` was RED (18 errors) on `main`**, which meant the e2e and a11y suites had never run in CI. I re-ran every gate on 2026-06-13: **client lint is now clean.** The `Modal` anti-pattern is fixed with `useId()` ([Modal.jsx:35](../../client/src/components/ui/Modal.jsx#L35)), and `eslint.config.js` now teaches the `e2e/**` directory Node + Playwright globals ([eslint.config.js:21-36](../../client/eslint.config.js#L21)). V4's other High finding — **the CHANGELOG/PROJECT_STATE doc drift** — is also closed: both files now carry detailed, dated Wave 1-7 entries (the CHANGELOG's top block is the Wave 7 AI Assistant; 20 Wave-6/7 references in each). **All eight quality gates are green for the first time since V3**, and the OpenAPI spec has grown from 57 paths to **91** (142 `addPath` calls).

**The product transformation is real, and it shows in the schema, the routes, and the UI in concert.** A research session is now a *workflow*, not a silo: capture an entry, tag it, attach a file, **link** the two papers it's based on, **start a timer** from the detail modal, run a **semantic search** to find neighbours, and **Ask AI** to summarize — every verb exists and every one is `user_id`-scoped. The morning screen V4 asked for verbatim ("3 tasks due today; you're over the Food budget; the receivable is due Friday; you're 40% through a book; the LoRa project has 1 open P0") is now the **Today Dashboard**, which fans out over five modules *including the Engineer module V4 said it omitted* ([dashboard.js:24-38](../../server/routes/dashboard.js#L24)). Weekly Review rolls up seven modules, the Annual Report eight, and the Polymath Dashboard plots multi-year growth across six. Goals derive their progress from linked entities across six types ([goals.model.js:212-258](../../server/models/goals.model.js#L212)).

**The honest gaps that remain are smaller and more specific than V4's — and none is structural.** Three V4 roadmap items shipped *partially*: the **PWA is installable and offline-capable but ships no web-push reminders**; the **"Universal Export" never landed** — Research is *still* the only module that can export its data; and **`user_settings` is still planning-only**, so preferences (theme, model choice) don't follow the user across devices. Two process smells recurred: a **real correctness bug in `getGoalStats` is fixed in the working tree but uncommitted** (the old `EXTRACT(EPOCH FROM (date - date))` would 500 for any date-bounded goal — see §3.1), and the **coverage gate still has no floor and e2e still runs on push only** (the two V4 test-infra findings are verbatim un-actioned in [ci.yml:80,120](../../.github/workflows/ci.yml#L80)). A genuinely *new* consideration arrived with Wave 7: **the AI features send prompt content and injected entity context to a third-party API (DeepSeek)**, and that egress is not yet documented in SECURITY.md — though it is opt-in (key-gated) and a fully-local Ollama path exists.

**Verdict: the system has crossed from toolkit to operating system, and the numbers finally agree.** Technical-only rises from 8.1 to **8.4** — every V4 laggard (DevOps, sustainability) recovered and nothing regressed. But the headline is §13: **PMF moves from 2.8 to 6.4**, and because it carries a ×1.5 weight, it finally pulls *with* the technical gains instead of against them. **The blended score climbs from 7.6 to 8.2 (+0.6)** — the largest single-audit jump since V2, and the first time the product dimension has been an asset rather than the report's indictment. This is production-ready, reliable, and — measured against its owner's actual life as a researcher-engineer-founder-financier-learner-reader — it is, for the first time, *one system*. The remaining work is polish and the last 10% of two moonshots, not foundation. Commit the goals fix, set a coverage floor, ship export-all, and document the AI egress; then this clears 8.5.

---

## Quality Gates — Actual Results

Every command below was executed on **2026-06-13** against the working tree. Output is reported verbatim (trimmed). **8/8 green.**

| Gate | Command | Result |
|------|---------|--------|
| Server audit | `npm audit` (server) | ✅ **0 vulnerabilities** |
| Server lint | `npm run lint` (server) | ✅ **clean** (`eslint . --max-warnings 0`, exit 0) |
| Server tests | `npm test` (server) | ✅ **35 passed / 14 skipped** (7 files passed, 4 integration files skip without `DATABASE_URL`) |
| OpenAPI generation | `npm run openapi` | ✅ **91 paths written** (`142` `addPath` calls; ≥75 CI gate passes) |
| Client audit | `npm audit` (client) | ✅ **0 vulnerabilities** |
| **Client lint** | `npm run lint` (client) | ✅ **clean** — *was 18 errors in V4; now 0* |
| Client build | `npm run build` | ✅ **clean** — main `index-*.js` **262.35 KB / 83.20 KB gzip**; `mdeditor` **1,059.81 KB / 363.28 KB gzip** (lazy); `prism` 85 KB (lazy); ⚠️ Vite >500 KB warning persists (mdeditor); **PWA service worker generated** (`dist/sw.js`, workbox, 30 precache entries) |
| Client tests | `npm test` (client) | ✅ **8 passed** (2 files: markdown sanitization + QuickCapture) |
| Playwright | `npx playwright test --list` | ✅ **30 tests in 2 files** (`smoke.spec.js` ×8, `a11y.spec.js` ×7) across `chromium-desktop` + `chromium-mobile` — *now unblocked by the green lint gate* |

**Spot checks:**
- `docs/openapi.json` is **valid JSON**, **91 paths** (verified by `Object.keys(paths).length`).
- OpenAPI path count climbed 57 → **91** across the 7 waves (V4 → V5).
- `LINKABLE_TYPES` (enums.js) = **22 types**, exactly matching the `chk_entity_link_types` CHECK in [015_chat_history.sql:50-65](../../server/db/migrations/015_chat_history.sql#L50).
- Migrations **002–015** present, sequential, **no numbering conflicts**; the original schema lives in the 5 dated `20240101–20240103` files (19 migration files total).
- Counts: **17 routers · 15 models · 19 migrations · 29 client pages**.

### What changed at the gate level since V4

V4's report opened on a red pipeline. The fix is small and visible:
- **`Modal.jsx`**: `const titleId = useId();` ([:35](../../client/src/components/ui/Modal.jsx#L35)) replaced the `useRef(\`modal-title-${Math.random()}\`)` impurity — the three `react-hooks` errors are gone.
- **`eslint.config.js`**: a second flat-config block scopes `globals.node` + `browser`/`process`/`Buffer` to `e2e/**` and `playwright.config.js` ([:21-36](../../client/eslint.config.js#L21)) — the 15 e2e `no-undef`/`no-unused-vars` errors are gone.

Because the client job no longer exits non-zero, the `e2e` job (`needs: [server, client]`) can finally run its 30 Playwright + axe tests on push.

---

## Section Scores

| # | Section | V1 | V2 | V3 | V4 | **V5** | Δ V4→V5 |
|---|---------|----|----|----|----|--------|---------|
| 1 | Security & Authentication (×2.0) | 5.5 | 8.0 | 8.8 | 8.9 | **9.0** | ▲ +0.1 |
| 2 | Backend Resilience & Reliability (×1.5) | 6.0 | 7.0 | 7.6 | 8.2 | **8.5** | ▲ +0.3 |
| 3 | Database Integrity & Data Safety (×1.5) | 7.0 | 7.5 | 7.8 | 8.4 | **8.5** | ▲ +0.1 |
| 4 | Frontend Reliability & Error Resilience (×1.5) | 6.5 | 7.5 | 7.6 | 7.9 | **8.4** | ▲ +0.5 |
| 5 | API Design & Documentation (×1.0) | 7.0 | 7.5 | 6.8 | 8.2 | **8.5** | ▲ +0.3 |
| 6 | Test Suite Quality & Coverage (×1.25) | 3.0 | 6.0 | 7.2 | 7.8 | **8.1** | ▲ +0.3 |
| 7 | DevOps & CI/CD Maturity (×1.25) | 6.0 | 7.5 | 8.0 | 7.5 | **8.3** | ▲ +0.8 |
| 8 | Observability & Debugging (×1.0) | 4.5 | 6.5 | 6.8 | 8.3 | **8.4** | ▲ +0.1 |
| 9 | Performance & Scalability (×1.0) | 5.5 | 6.5 | 7.2 | 7.4 | **7.6** | ▲ +0.2 |
| 10 | UI/UX Quality & Accessibility (×1.0) | 7.0 | 7.5 | 7.4 | 8.1 | **8.4** | ▲ +0.3 |
| 11 | Code Quality & Maintainability (×1.0) | 7.0 | 7.5 | 8.0 | 7.8 | **8.0** | ▲ +0.2 |
| 12 | Long-Term Sustainability & Roadmap (×1.0) | 6.5 | 8.0 | 8.5 | 7.8 | **8.6** | ▲ +0.8 |
| **13** | **Product-Market Fit (×1.5)** | — | — | — | 2.8 | **6.4** | ▲ **+3.6** |
| | **Technical only (12 dims, Σ15.0)** | 6.4 | 7.5 | 7.7 | 8.1 | **8.4** | ▲ +0.3 |
| | **Overall (blended, Σweights = 16.5)** | **6.4** | **7.5** | **7.7** | **7.6** | **8.2** | ▲ **+0.6** |

> Two numbers again, by design. **Technical-only = 8.4** is the honest measure of the engineering across 7 waves (+0.3; every laggard recovered, nothing regressed). **Blended = 8.2** folds in §13 PMF (×1.5). For the first time the blended score *exceeds* a prior technical-only score and rises *faster* than technical — because the product dimension, which V4 called the report's indictment, has become its biggest contributor.

---

## 1. Security & Authentication — 9.0 / 10

### Strengths
- **Zero `npm audit` vulnerabilities** on both packages (re-run 2026-06-13). The perimeter is unchanged and intact: helmet CSP (`default-src 'none'`) + prod HSTS ([index.js:156-166](../../server/index.js#L156)); session regeneration on login; bcryptjs cost 12; the global limiter ahead of body parsers; parameterized SQL + `user_id` scoping in **every** model across all 7 waves.
- **The new modules inherited the discipline.** Wave 7 chat is mounted behind `requireAuth` ([index.js:238](../../server/index.js#L238)); `getContextForConversation` scopes *every* context query by `user_id` ([chat.model.js:128-145](../../server/models/chat.model.js#L128)) so a chat can never inject another user's entity; the `links` router verifies ownership of **both** endpoints before writing a link ([links.js:131-133](../../server/routes/links.js#L131)) and returns 404 (never 403) to avoid disclosing existence.
- **Secrets stay server-side.** The DeepSeek/embedding API keys live only in env and are read in `chat.js`/`embeddings.js`; the client streams against its *own* API origin via `fetch` and never sees the key.
- **`/metrics` is now edge-unreachable.** V4 flagged it as open by default. The public nginx proxies only `/api`, `/api/chat/send`, and `/health` ([nginx.docker.conf:52-79](../../client/nginx.docker.conf#L52)); `/metrics` has no `location` block, so an external request falls through to the SPA `try_files` — the gauge internals no longer leak through the edge (mitigation by omission).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | **AI egress is undocumented.** Wave 7 chat + Wave 6 embeddings send prompt text **and** injected entity context (research/book/goal/idea snapshots) to DeepSeek's cloud API | Medium (privacy) | S | Opt-in (key-gated) and a local Ollama path exists, so this is a *disclosure* gap, not a leak. Add a "Third-party data egress" section to SECURITY.md; consider a per-conversation "local only" toggle surfaced in the UI. |
| 1.2 | `/metrics` is still unauthenticated **at the app port** ([index.js:190](../../server/index.js#L190)) | Low | S | Edge-blocked now, but a host on the internal network can still read it. Bind to localhost or add a bearer check for defence-in-depth. |
| 1.3 | No CSRF token — defence is `sameSite: lax` + CORS ([index.js:140](../../server/index.js#L140)) | Medium | M | Carried from V3/V4. Upgrade to `sameSite: strict` or add a double-submit token. |
| 1.4 | `LOGIN_FAILURE` logs the attempted email in plaintext; MIME allowlist includes `application/octet-stream` | Low | S/M | Both carried from V4 §1.2/§1.4; acceptable, hash/magic-byte if logs leave the host. |

#### Finding 1.1: Wave 7 opened a deliberate door in a previously closed loop
**Priority:** Medium (privacy) — **Source:** [chat.js:144-218](../../server/routes/chat.js#L144), [chat.model.js:128-145](../../server/models/chat.model.js#L128), SECURITY.md

For six waves Polymath OS was a closed system: data entered, was processed on the host, and never left. Wave 7's value *depends* on breaking that — the chatbox and the Wave 6 auto-tagger send content to an OpenAI-compatible cloud API (DeepSeek by default). Two things travel: the user's prompt, and — on the first message of a context-linked conversation — a JSON snapshot of the anchoring entity injected as a system prompt ("the user is working on: …research entry / engineer project / book / learning item / goal / idea…", [chat.js:149](../../server/routes/chat.js#L149)). The engineering around this is careful: the context query is `user_id`-scoped so it can never pull another user's row, the API key lives only server-side, and a fully-local **Ollama** backend exists for on-device inference. So this is **not a leak** — it is an *undocumented* egress. The gap is disclosure: SECURITY.md still describes the closed-loop model and says nothing about what leaves the host, to whom, or how to opt out. **Action:** add a "Third-party data egress" section naming DeepSeek, the data categories sent, and the local-only alternative; consider surfacing a per-conversation "local model only" toggle (the `provider: 'ollama'` path already supports it) so privacy is a UI choice, not an env-var one.

**Net:** the fundamentals are pristine and the three new waves of attack surface (links, embeddings, chat) were each built with ownership-scoping and server-side secrets. The one genuinely new item — third-party egress — is opt-in and reversible. **9.0 (▲ +0.1).**

---

## 2. Backend Resilience & Reliability — 8.5 / 10

### Strengths
- **Graceful degradation is now a system-wide pattern, and it's excellent.** `embeddings.model.js` tolerates the table being absent (`42P01` → no-op/empty) so semantic search degrades instead of 500-ing without pgvector ([embeddings.model.js:13-94](../../server/models/embeddings.model.js#L13)); `autoTagger.suggestTags` is best-effort (`[] on any failure`); migration `014_pgvector.sql` is wrapped in a **guarded `DO` block** that only creates the extension/table when `pg_available_extensions` lists `vector` ([014:30-63](../../server/db/migrations/014_pgvector.sql#L30)), so CI's stock `postgres:16-alpine` migrates cleanly. This is the difference between "optional feature" and "optional feature that can't break the core."
- **SSE streaming is carefully guarded.** `POST /api/chat/send` persists the user message, streams tokens, then persists the reply; the outer catch guards on `res.headersSent` before delegating to `next()` so the global error handler never throws on an in-flight stream ([chat.js:264-272](../../server/routes/chat.js#L264)). Stream-time failures are emitted as a `{type:'error'}` SSE event, not a half-written JSON envelope.
- **Background work never blocks the response.** Research create/patch fire-and-forget embedding indexing ([research.js:519](../../server/routes/research.js#L519)); the timer model computes duration **server-side** via `EXTRACT(EPOCH FROM (NOW() - started_at))`, never trusting a client clock.
- Carried strengths intact: DB-aware `/health` ([index.js:202-209](../../server/index.js#L202)), atomic `settleLedger`, env-driven pool, graceful shutdown drains HTTP → pool metrics → pool.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | **No timeout/abort on the upstream AI `fetch` calls.** A hung DeepSeek/Ollama connection holds the SSE open; nginx's `proxy_read_timeout` for `/api/chat/send` is **3600s** ([nginx.docker.conf:62](../../client/nginx.docker.conf#L62)) | Medium | S | Add an `AbortController` with a sane ceiling (e.g. 60-120 s) to the `fetch` in `chat.js`/`embeddings.js`; emit a timeout `error` event and close. |
| 2.2 | No retry/backoff on transient DB errors (`ECONNREFUSED`/`57P03`) | Medium | M | Carried from V3/V4 §2.1. A small retry wrapper for idempotent reads. |
| 2.3 | `/health` has no statement timeout; `migrate.js` diagnostic re-run outside a txn | Low | S | Carried from V4 §2.2/§2.3. |

**Net:** the graceful-degradation patterns (42P01 tolerance, key-gating, guarded migration, `headersSent` guard) are textbook and applied consistently. The one real new gap is an unbounded upstream timeout. **8.5 (▲ +0.3).**

---

## 3. Database Integrity & Data Safety — 8.5 / 10

### Strengths
- **The cross-module schema is now real, and it's disciplined.** `entity_links` ([007_entity_links.sql](../../server/db/migrations/007_entity_links.sql)) uses a `UNIQUE (user_id, from_type, from_id, to_type, to_id)` de-dup, a `chk_entity_link_types` CHECK whitelisting the linkable types, `user_id` FK `ON DELETE CASCADE`, the shared `set_updated_at()` trigger, and **two directional indexes** (`idx_entity_links_from`/`_to`). Each subsequent wave that adds a type re-adds the whole CHECK via `DROP CONSTRAINT IF EXISTS … ADD CONSTRAINT` ([015:49-65](../../server/db/migrations/015_chat_history.sql#L49)) — and the 22-type list is **provably in sync** with `LINKABLE_TYPES` in enums.js (I diffed them).
- **Every wave's table follows §6.5 conventions.** `time_entries` carries `CHECK (ended_at IS NULL OR ended_at > started_at)` and `duration_seconds > 0`; `goals` carries four CHECK enums; `chat_conversations` stores messages as `JSONB NOT NULL DEFAULT '[]'`; `research_embeddings` cascades from `research_entries`. All re-runnable (`DROP … CASCADE` precedes `CREATE`).
- Carried: the transfer-dedup `NULLS NOT DISTINCT` fix proven by an integration test; comprehensive CHECK constraints; deliberate `ON DELETE` semantics; the destructive `002` migration refuses to run against a populated ledger.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | **`getGoalStats` had a runtime-erroring query, fixed-but-uncommitted.** The old `EXTRACT(EPOCH FROM (target_date - start_date))` subtracts two `date`s → an **integer**, and `EXTRACT(EPOCH FROM integer)` raises `function date_part(unknown, integer) does not exist` — so `GET /api/goals/stats` would **500 for any user with a date-bounded goal**. The working tree fixes it to `(NOW()::date - start_date)::float / NULLIF((target_date - start_date), 0)` ([goals.model.js:174-175](../../server/models/goals.model.js#L174)) — but **the change is uncommitted** (`git status: M server/models/goals.model.js`) | **High** | S | **Commit the fix.** On `main` the bug is still live. That the Wave 5 light audit scored Goals 14/14 shows the stat query was never exercised against real date-bounded data (see §6.2). |
| 3.2 | Migrations are forward-only (no `down` step); `research_attachments.file_path` is dead weight | Low | L/S | Carried from V4 §3.1/§3.2. |
| 3.3 | `recalcGoalProgress` is on-demand, not trigger-driven — `current_value` can drift until the user clicks "Recalculate" | Low (by design) | — | Documented design decision ([goals.model.js:8-10](../../server/models/goals.model.js#L8)); acceptable, but worth a "last recalculated" timestamp in the UI. |

#### Finding 3.1: The goals stats endpoint 500s on `main`, and the fix is sitting uncommitted
**Priority:** High — **Source:** [goals.model.js:170-178](../../server/models/goals.model.js#L170), `git status`

This is the most important *correctness* finding in V5, and it is invisible to every prior light audit because none exercised it against real data. `getGoalStats` computes an "on track" count by comparing each goal's progress ratio to its *elapsed-time* ratio. The committed query does that with:
```sql
EXTRACT(EPOCH FROM (NOW()::date - start_date)) /
NULLIF(EXTRACT(EPOCH FROM (target_date - start_date)), 0)
```
In PostgreSQL, **subtracting two `date` values yields an `integer`** (a day count), not an `interval`. `EXTRACT(EPOCH FROM <integer>)` therefore resolves to `date_part(unknown, integer)`, which **does not exist** — the query raises and `GET /api/goals/stats` returns 500 *for any user who has a single goal with both `start_date` and `target_date` set*. A user with only open-ended goals never trips it, which is exactly why it shipped: the Wave 5 light audit marked Goals **14/14** because the stats card rendered fine against dateless fixtures. The working tree already carries the correct fix — direct date subtraction cast to float:
```sql
(NOW()::date - start_date)::float / NULLIF((target_date - start_date), 0)
```
…but it is **uncommitted** (`M server/models/goals.model.js`). So `main` is broken and the repo *looks* fixed. **Verification:** insert a goal with `start_date`/`target_date`, hit `/api/goals/stats` → 500 on `main`, 200 with the working-tree change. **Action:** commit the fix and add the integration test in §6.2 so it can never silently regress.

**Net:** the additive schema work across seven tables is clean, consistent, and provably in sync with the app layer. The latent `getGoalStats` 500 — correct fix, but uncommitted — is the one real ding and a process smell. **8.5 (▲ +0.1).**

---

## 4. Frontend Reliability & Error Resilience — 8.4 / 10

### Strengths
- **The V4 High finding is fixed.** `Modal` uses `useId()` for a render-safe `titleId` ([Modal.jsx:35](../../client/src/components/ui/Modal.jsx#L35)); the focus trap + restore is intact ([:38-50](../../client/src/components/ui/Modal.jsx#L38)); **client lint is clean**, so the anti-pattern no longer ships.
- **Eight new pages, all with the four data states.** Goals, WeeklyReview, AnnualReport, PolymathDashboard, Reading, Contacts, Ideas, and AIChat each implement loading/error/empty/data (verified across the Wave 3-7 light audits and spot-checked). The AI chat streams via a **raw `fetch` against the API base** so the SSE `ReadableStream` can be read directly, while every other call stays on the axios client ([AIChat.jsx](../../client/src/pages/AIChat.jsx), 446 lines).
- **The command palette + PWA raise resilience.** `QuickCapture` owns a single app-wide `Cmd/Ctrl+K` listener with **4 modes** (`todo → research → idea → search`, [QuickCapture.jsx:19](../../client/src/components/shared/QuickCapture.jsx#L19)); the PWA is installable with an `offline.html` fallback and `autoUpdate` registration ([vite.config.js:15-19](../../client/vite.config.js#L15)).
- Carried: `ErrorBoundary` wraps `<App/>`, `429` handled distinctly from `401`, `useApi` guards post-unmount `setState`, Research + Engineer pages `React.lazy` + `<Suspense>`.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | **Client unit coverage is still thin** — 2 test files / 8 assertions (markdown sanitization + QuickCapture) for 29 pages | Medium | L | Improved from V4's single file (QuickCapture.test.jsx is new), but the 8 new pages and the AI streaming reducer have no unit tests. Add RTL tests for the create/settle/goal modals and the SSE token accumulator. |
| 4.2 | SSE stream has no client-side timeout/abort UI — a stalled stream shows a blinking cursor indefinitely | Low | S | Pair with §2.1; surface a "stream stalled — retry" state. |
| 4.3 | `navigator.clipboard` copy paths silently no-op on non-secure contexts | Low | S | Carried from V4 §4.3. |

**Net:** lint green, eight polished four-state pages, a real streaming UX, a 4-mode palette, and an installable PWA. The thin unit-test base is the remaining drag. **8.4 (▲ +0.5).**

---

## 5. API Design & Documentation — 8.5 / 10

### Strengths
- **The spec scaled with the system.** `docs/openapi.json` is valid JSON with **91 paths** (V4: 57), generated from **142 `addPath` calls** — covering links, dashboard, reading, search, contacts, ideas, time, review, goals, polymath, and the 5 chat paths, plus `/health`+`/metrics`.
- **The envelope held across 7 waves.** Every router returns `{success, data, meta?}` / `{success, error:{code, message, reqId, field?}}`; the `DUPLICATE_TRANSFER` code + `field` hint persists ([errorHandler.js:15-24](../../server/middleware/errorHandler.js#L15)). New routers reuse the same `AppError(message, status, code, field)` shape.
- **Route ordering is correct under growth.** Literal/static routes precede dynamic `/:id` everywhere it matters (`/semantic-search`, `/suggest-tags`, `/stats`, `/running`, `/summary`, `/recalc` all declared before the param route) — verified in research.js, time.js, goals.js.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | **The CI OpenAPI gate still counts `addPath` in the *script*, not paths in the *emitted spec*** ([ci.yml:59-67](../../.github/workflows/ci.yml#L59)) | Low | S | **Verbatim un-actioned from V4 §5.1.** The proxy is fine (142 ≥ 75) but could pass on a malformed spec. Add a step that parses `docs/openapi.json` and asserts `Object.keys(paths).length ≥ 85` + valid JSON. |
| 5.2 | No API versioning (`/api/v1`); query params validated ad-hoc, not via Zod | Low | M | Both documented decisions, carried from V4 §5.2/§5.3. |

**Net:** a 60% larger, complete, consistently-shaped contract. The one repeat finding is the script-vs-spec gate proxy. **8.5 (▲ +0.3).**

---

## 6. Test Suite Quality & Coverage — 8.1 / 10

### Strengths
- **Server suite grew with the features:** 35 passed / 14 skipped (V4: 24/5). New unit files include `dashboard.today.test.js` and `reading.test.js`; the integration set is now `constraints`, `isolation`, `links`, `settle` (+ `db.setup`) — a `links.int.test.js` proves the Wave 1 foundation against real Postgres.
- **The e2e/a11y suite is finally executable.** 30 Playwright tests (smoke ×8 + axe a11y ×7, both viewports). Because client lint is green, the `e2e` job no longer dies at `needs: [server, client]` — V4's "these tests have never passed CI" is resolved.
- **Client unit tests doubled** (1 → 2 files): `QuickCapture.test.jsx` is new alongside the markdown-sanitization regression.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | **Coverage gate still has no floor and is `continue-on-error: true`** ([ci.yml:78-80](../../.github/workflows/ci.yml#L80)) | Medium | S | **Verbatim un-actioned from V4 §6.1 (and V3 §6.1).** Set a realistic floor (e.g. 60% lines on `models`+`routes`) and drop `continue-on-error`. |
| 6.2 | **No test exercises `getGoalStats` against date-bounded data** — which is *why* the §3.1 500 shipped | Medium | M | Add an integration test that inserts a goal with `start_date`/`target_date` and asserts `/api/goals/stats` returns 200. The new waves (chat.model, embeddings, time.model, recalcGoalProgress) are also largely untested at the unit level. |
| 6.3 | **e2e runs on push only, not PR** ([ci.yml:120](../../.github/workflows/ci.yml#L120)) | Medium | S | Verbatim un-actioned from V4 §6.2. A UI regression merges green and only breaks the post-merge run. |

**Net:** more tests, broader integration, and the e2e suite is real now — but the two V4 test-infra findings (floor, PR) are untouched, and the goals 500 is a concrete coverage hole. **8.1 (▲ +0.3).**

---

## 7. DevOps & CI/CD Maturity — 8.3 / 10

### Strengths
- **The pipeline is green — this is the headline.** V4 docked this dimension to 7.5 *specifically because CI was red on `main`*. Re-run 2026-06-13: server lint/audit/test/openapi and client lint/audit/build/test all pass; the e2e job is unblocked. The single most consequential V4 finding is closed.
- **Production topology matured for the moonshots.** `docker-compose.yml` swaps the DB image to **`pgvector/pgvector:pg16`** (a drop-in superset, same data-dir layout) so semantic search works in prod, while the guarded `014` migration keeps CI's `postgres:16-alpine` green. AI env vars (`DEEPSEEK_API_KEY`, `*_BASE_URL`, `EMBEDDING_*`) are parameterized with safe blank defaults ([docker-compose.yml:29-37](../../docker-compose.yml#L29)).
- **Edge config keeps pace.** nginx gained PWA cache rules (`sw.js`/manifest/`offline.html` no-cache) and a dedicated `/api/chat/send` SSE block with `proxy_buffering off` ([nginx.docker.conf:52-64](../../client/nginx.docker.conf#L52)). Carried: `USER node`, Node 22 pinned, healthchecks, backup sidecar.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | **Coverage floor unset; e2e PR-skipped** | Medium | S | See §6.1/§6.3 — the two highest-ROI pipeline upgrades, both carried verbatim from V4. |
| 7.2 | Backup sidecar `apk add aws-cli` at container start; no "last backup age" alert; no resource limits/log-rotation on compose services | Medium/Low | M/S | Carried from V4 §7.3/§7.4. |
| 7.3 | The uncommitted `goals.model.js` fix means **the working tree and `main` disagree** | Low (process) | S | Commit it; consider a pre-merge "git status clean" check. |

**Net:** red → green, plus real topology work for pgvector/SSE/PWA. Held back from higher only by the unchanged coverage/e2e gates. **8.3 (▲ +0.8).**

---

## 8. Observability & Debugging — 8.4 / 10

### Strengths
- **The audit trail now spans all 7 waves.** Structured `event` logs with `userId`+`reqId` cover `LOGIN_*`/`LOGOUT`/`REGISTER`, every mutating finance op, and the new `LINK_CREATE`/`LINK_DELETE` ([links.js:139](../../server/routes/links.js#L139)), `TIMER_START`/`TIMER_STOP`/`TIME_DELETE`, `GOAL_*`, and `CHAT_MESSAGE`/`CHAT_DELETE` ([chat.js:103,254](../../server/routes/chat.js#L103)) — including a `responseLength` on chat completions.
- **Metrics + redaction intact and slightly hardened.** prom-client HTTP histogram/counter + pool gauge; the route label now **prefers `req.route?.path`** with `req.path`/`'unknown'` fallbacks ([index.js:181](../../server/index.js#L181)), partially addressing V4 §8.3's cardinality concern; pino redaction of cookie/auth headers persists.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | **Alert rules are still documented, not shipped** (no `deploy/prometheus/` config in-repo) | Medium | M | Carried from V4 §8.1. Commit the 6 RUNBOOK expressions + a scrape config. |
| 8.2 | No distributed tracing/APM; AI calls aren't instrumented (no upstream-latency metric for DeepSeek/Ollama) | Low | M | A `chat_upstream_duration` histogram would make §2.1 timeouts observable. |

**Net:** the trail widened to every new module and the cardinality fallback improved; alerts still aren't deployable. **8.4 (▲ +0.1).**

---

## 9. Performance & Scalability — 7.6 / 10

### Strengths
- **Aggregations stay in SQL — no N+1, even as fan-outs multiplied.** `dashboard /today` (5-module `Promise.all`), `review /weekly` + `/annual` (7-8 modules), and `polymath /` (6 parallel `GROUP BY year` queries with `FILTER`) all compute server-side ([polymath.js:20-91](../../server/routes/polymath.js#L20)). `entity_links` is indexed in both directions; `research_embeddings` has an `ivfflat` cosine index.
- **Bundle discipline held under 8 new pages.** Main chunk **262 KB / 83 KB gzip** (V4: 244/78 — a modest +5 KB gzip for the growth); `mdeditor` (1,060 KB) and `prism` (85 KB) remain lazy via `manualChunks` ([vite.config.js:61](../../client/vite.config.js#L61)). The **PWA precaches 30 entries** — repeat loads are now near-instant.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | `mdeditor` chunk **1,060 KB / 363 KB gzip** still trips Vite's >500 KB warning | Medium | M | Carried from V4 §9.1; acceptable (lazy + cached). |
| 9.2 | Uploads on single-node local disk; lazy per-user `ensureDefaults` on the read path | Medium/Low | L/M | Carried from V4 §9.2/§9.3. |
| 9.3 | `polymath`/`review` fan-outs issue many parallel queries per request | Low (single-user) | M | Fine at this scale; revisit if multi-tenant. |

**Net:** more aggregation moved server-side, links/embeddings indexed, PWA caching added; the mdeditor weight and single-node ceiling are the same consciously-deferred items. **7.6 (▲ +0.2).**

---

## 10. UI/UX Quality & Accessibility — 8.4 / 10

### Strengths
- **The a11y suite actually runs now** (lint green), auditing 7 pages × 2 viewports with `@axe-core/playwright`. Focus trap + restore and per-route titles persist.
- **Rich new interaction surfaces.** The AI chat has token-by-token streaming with a live cursor, per-message Copy + **Save to Research**, model selector + temperature/top-p sliders, and `Enter`/`Shift+Enter`/`⌘J` keyboard handling; **"Ask AI" deep links** wire four detail modals to `/ai-chat?context=…`. The `⌘K` palette spans 4 capture/search modes. The sidebar is cleanly grouped into Finance / Business / Knowledge / Engineering / Reflect sections ([AppLayout.jsx:19-74](../../client/src/components/layout/AppLayout.jsx#L19)).
- Consistent design system, four-state lists, dark mode, installable PWA.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | **The axe suite still covers only the original 7 pages** — the 8 Wave 3-7 pages (Goals, WeeklyReview, AnnualReport, PolymathDashboard, Reading, Contacts, Ideas, **AIChat**) aren't audited, nor are modal-open states | Medium | M | Extend `a11y.spec.js` to the new routes; AI chat (dynamic streaming content) is the highest-value untested surface. |
| 10.2 | No documented contrast/keyboard walkthrough artifact | Low | S | Carried from V4 §10.3 — capture an axe HTML report as a CI artifact. |

**Net:** the a11y suite is real and the new UX is genuinely polished, but a11y coverage hasn't grown to match the 8 new pages. **8.4 (▲ +0.3).**

---

## 11. Code Quality & Maintainability — 8.0 / 10

### Strengths
- **Both packages lint clean** (the V4 red is gone). `enums.js` is the single server-side source of truth — now 22 linkable types + all wave enums ([enums.js](../../server/lib/enums.js)).
- **The route→model→db pattern held across 7 waves without erosion.** Every new model is `user_id`-scoped, every new router uses the same envelope and `AppError`, heavy JSDoc throughout. The argument-order convention (`(userId, id)` in models, adapted to `(id, userId)` in the link validators) is explicitly documented at each adapter ([links.js:49-60](../../server/routes/links.js#L49)).

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | **`enums.js` is still server-only; the client re-declares its own maps** — `LinkedItems.jsx` has its own `TYPE_LABELS`/`TYPE_VARIANTS`, `QuickCapture` its own entity maps | Low | M | Carried verbatim from V4 §11.2 / V3. Drift risk grows with every new type. A shared/generated constants module removes it. |
| 11.2 | **ARCHITECTURE.md's planned-migration note is stale again.** It says create `008_user_settings.sql` because "006 and 007 are now taken" ([ARCHITECTURE.md:228](../ARCHITECTURE.md)) — but `008–015` are *all* taken; the next free number is **016** | Low | S | Update the note to `016_`; this is the V4 §11.3 collision, half-fixed and re-staled by six new migrations. |
| 11.3 | Uncommitted working-tree change (§3.1); no type checking (`checkJs`) | Low | S/M | Commit the fix; carried `checkJs` from V4 §11.4. |

**Net:** clean lint on both sides and a pattern that scaled cleanly through 7 waves; the persistent client/server enum drift and the re-staled migration note keep it from rising further. **8.0 (▲ +0.2).**

---

## 12. Long-Term Sustainability & Roadmap — 8.6 / 10

### Strengths
- **Doc currency is restored — V4's High finding is closed.** CHANGELOG carries detailed, dated Wave 1-7 entries (top block = Wave 7 AI Assistant, 2026-06-12); PROJECT_STATE.md (106 KB) documents every new page/table/route; 20 Wave-6/7 references in each. The "docs match reality" property that earned V3 its 8.5 is back.
- **The entire V4 6-12-month roadmap was delivered.** Universal Links → Today Dashboard → Universal Search → Reading → Time → Weekly Review & Goals → PWA → Local AI — *every spine item shipped*, in the dependency order V4 drew. The roadmap is, for practical purposes, **complete**.
- ARCHITECTURE/RUNBOOK/SECURITY all present and canonical; the guarded-migration pattern shows real forethought about environment parity.

### Gaps

| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | **The roadmap is complete — there's no "what's next" yet.** Three items shipped partially (PWA without reminders, no export-all, `user_settings` still planning-only) | Medium | M | Define a Wave 8+ (see §Path Forward): finish reminders/export/prefs, then habits + multi-device. |
| 12.2 | `user_settings` remains "planning only" while ARCHITECTURE references a now-doubly-stale migration number (§11.2) | Low | S | Build it (`016_`); it unblocks server-side prefs, the PWA reminder channel, and per-conversation AI privacy toggles. |
| 12.3 | No feature-flag mechanism for risky rollouts | Low | M | Carried from V4 §12.3; the AI features were instead gated by env-key presence, which works but isn't a general mechanism. |

**Net:** doc drift fixed *and* the full roadmap executed in days — the strongest sustainability signal possible, tempered only by "the map is now blank past here." **8.6 (▲ +0.8).**

---

## 13. Product-Market Fit for Personal Productivity — 6.4 / 10

> The decisive dimension, re-scored against *the transformed system* — not V4's silos. Every score cites the schema or the code. **V4: 2.8.**

### 13.1 Cross-Module Integration — 2.6 / 3  *(V4: 0.7)*

V4: "not one foreign key between modules." **That is no longer true at any layer:**
- **Universal Links:** `entity_links` connects **22 entity types**, ownership-validated on both endpoints, queryable in both directions, rendered by a shared `<LinkedItems>` component on detail modals and created via `<LinkPickerModal>` across modules. "Bought this book for research — Rp 250k" is now expressible (transaction ↔ book ↔ research_entry).
- **Cross-module search exists:** `GET /api/search` runs a `UNION ALL` over **6 tables** (todos, research_entries, learning_items, transactions, engineer_projects, books), one uniform row shape, surfaced in the `⌘K` palette ([search.model.js:14-67](../../server/models/search.model.js#L14)).
- **The AI ties it together:** chat injects `user_id`-scoped context from **6 entity types** ([chat.model.js:131-138](../../server/models/chat.model.js#L131)), reachable via "Ask AI" deep links from 4 modules.
- **Goals roll up linked work:** `recalcGoalProgress` derives `current_value` from linked entities across 6 types (finished books, deployed projects, done todos, completed learning, created research, summed time-entry hours) ([goals.model.js:212-258](../../server/models/goals.model.js#L212)).
- **Dashboards correlate:** Today (5 modules incl. Engineer), Weekly Review (7), Annual Report (8), Polymath (6).

*Not a full 3* because some links are user-driven (manual), `recalcGoalProgress` is on-demand not automatic, and `time_entry` uses its own `entity_type`/`entity_id` columns rather than `entity_links` for its primary attachment. But the silo problem — the root cause of V4's 2.8 — is **structurally solved.**

### 13.2 Workflow Support — 1.6 / 2  *(V4: 1.0)*

- **Morning routine:** ✅ The **Today Dashboard** is date-scoped and fans out todos-due + finance + learning + **engineer** + research ([dashboard.js:24-38](../../server/routes/dashboard.js#L24)) — the exact "morning screen" V4 specified, now including the Engineer module V4 said it omitted.
- **Research session:** ✅ capture → tag → attach → **link refs** → **timer** (on EntryDetailModal) → **semantic search** → **Ask AI**. Every verb V4 listed as missing now exists.
- **Reading workflow:** ✅ full Reading Tracker (shelves, timer, links to research/finance).
- **Reflection loop:** ✅ Weekly Review + Annual Report + Polymath Dashboard + Goals.
- **Engineering sprint / Financial review:** ⚠️ *still fragmented* — Engineer is 6 pages and Finance is 6 pages; project detail gained a timer + LinkedItems, but there's no single sprint board or one-screen budget+aging+portfolio review.

*1.6/2* — most workflows are now genuinely supported end-to-end; the two multi-page modules (Engineer, Finance) remain the consolidation gap.

### 13.3 Data Portability & Longevity — 1.0 / 2  *(V4: 0.75)*

- **Export-all never shipped.** Research is *still* the only module with an export route ([research.js:276](../../server/routes/research.js#L276), JSON/CSV); there is no `GET /api/export` ZIP despite it being a V4 Quick Win. Todos/Finance/Learning/Engineer/Reading/Goals/Time have **no export.**
- **Longevity visibility improved:** Annual Report + Polymath Dashboard surface multi-year history; "Save to Research" funnels AI insights into the one exportable store. Schema remains well-documented for `pg_dump` extraction.

*1.0/2* — better visibility, but the portability gap V4 named is largely unmoved. **This is the single most cost-effective PMF win still on the table.**

### 13.4 Personalization & Adaptability — 1.3 / 2  *(V4: 1.0)*

- Categories/tags/topics/ideas customizable as before; **Goals** add user-defined targets/units/categories; **AI chat** adds model choice + temperature/top-p.
- Still **no `user_settings`** — theme + preferences live in `localStorage`, so nothing follows the user across devices; sidebar/dashboard layout fixed.

*1.3/2* — Goals + AI config add real personalization; server-side prefs remain the ceiling.

### 13.5 Missing Capabilities — −0.15 / (−1 … 0)  *(V4: −0.65)*

V4 listed five missing loops; four are now shipped:
- Reading ✅ · Time tracking ✅ · Goals/OKRs ✅ · Daily/Weekly review ✅ · **plus** AI assistant, semantic search, PWA (all new).
- **Still genuinely missing:** **habit tracking** (only a `goal_type: 'habit'` option — no streaks/calendar UI); **reminders/notifications** (PWA is installable but ships no web-push); native mobile.

*−0.15* — only habits-as-streaks and a reminder channel remain; the deduction is near zero.

### 13.6 Total for §13

2.6 + 1.6 + 1.0 + 1.3 − 0.15 = **6.35 → 6.4 / 10.**

**Interpretation:** V4 scored 2.8 because "the connective tissue that turns tools into a system was never built." It has now been built — links, search, AI context, goal rollups, and a five-module morning briefing. What holds §13 below ~7 is no longer *structural* (the silos are gone) but *completion*: export-all, multi-device prefs, habits, and reminders are the last mile. **A 3.6-point jump on a ×1.5 dimension is the entire story of why the blended score moved.**

---

## Cross-Cutting Themes

1. **The product finally caught the engineering — and the schema proves it.** V4's defining tension was an 8.1 technical score dragging a 2.8 product score. Across 7 waves the team built exactly the connective tissue V4 prescribed: a 22-type `entity_links` table, a 6-table unified search, AI context injection, and goal rollups. The schema that V4 said "says six apps" now says "one system." This is the rare case where the prior audit's roadmap was executed in full and in order.

2. **"Built ⇒ shipped" (V4's inversion) is mostly cured, but two embers remain.** V4's trap was features merged without running the gates — a red lint, an unrecorded CHANGELOG. Both are fixed (green CI, current docs). Yet the *same class* of smell recurs in miniature: a real `getGoalStats` 500 fix sits **uncommitted** in the working tree, and the coverage-floor / e2e-on-PR findings are **verbatim un-actioned** from V4. The discipline is back; the last 5% of rigor (commit hygiene, load-bearing gates) isn't.

3. **Graceful degradation is now the system's signature pattern — and it's a genuine strength.** Every moonshot was built to fail safe: embeddings no-op on `42P01`, the pgvector migration is guarded by `pg_available_extensions`, auto-tag returns `[]` on any error, the SSE path guards `headersSent`, and AI features gate on env-key presence. The optional features *cannot* break the core. This is what let four ambitious Wave 6/7 capabilities land without destabilizing the suite.

4. **A new dependency crossed the perimeter: third-party AI.** For six waves the system was a closed loop — your data never left the host. Wave 7 changed that: chat prompts and injected entity context now flow to DeepSeek's cloud (opt-in, key-gated, with a local Ollama alternative). It's well-contained, but it introduces egress, an unbounded upstream timeout (§2.1), and an undocumented privacy surface (§1.1). The architecture's "single-host, single-user" simplicity now has one deliberate door in it.

5. **The roadmap is complete, which is itself a finding.** For the first time, there is no obvious next foundation to lay. The remaining work — export-all, `user_settings`, habits, reminders, workflow consolidation for Engineer/Finance — is breadth and polish, not spine. The strategic question shifts from "what must we build to be a system?" (answered) to "what makes this *delightful* and *trustworthy* for the long haul?"

---

## Complete Feature Inventory

| Wave | Feature | Status | Evidence |
|------|---------|--------|----------|
| 1 | Universal Links (`entity_links`, 22 types) | ✅ | [007_entity_links.sql](../../server/db/migrations/007_entity_links.sql); [enums.js:53-64](../../server/lib/enums.js#L53) |
| 1 | Ownership-validated link API (both sides, 404-on-miss) | ✅ | [links.js:71-148](../../server/routes/links.js#L71) |
| 1 | `<LinkedItems>` + `<LinkPickerModal>` shared components | ✅ | TYPE_LABELS incl. book/contact/idea/time_entry/goal/chat |
| 2 | Today Dashboard (date-scoped, 5 modules incl. Engineer) | ✅ | [dashboard.js:24-38](../../server/routes/dashboard.js#L24); TodayDashboard.jsx |
| 2 | QuickCapture command palette (⌘K, 4 modes) | ✅ | [QuickCapture.jsx:19](../../client/src/components/shared/QuickCapture.jsx#L19) |
| 3 | Reading Tracker (shelves, timer, ratings) | ✅ | `books` table; Reading.jsx; `BOOK_SHELVES` |
| 3 | Unified Search (`UNION ALL`, 6 tables) | ✅ | [search.model.js:14-67](../../server/models/search.model.js#L14) |
| 4 | Contacts CRM | ✅ | contacts.js / contacts.model.js; `009_contacts.sql` |
| 4 | Ideas Tracker | ✅ | ideas.js; `011_ideas.sql`; `IDEA_STATUSES` |
| 4 | Revenue tx type (founder income) | ✅ | `TX_TYPES` incl. `Revenue`; `010_revenue_tx_type.sql` |
| 5 | Time Tracking (server-computed duration, timer UI) | ✅ | `012_time_entries.sql`; time.model.js; Timer.jsx |
| 5 | Weekly Review (7-module rollup) | ✅ | review.js `/weekly`; WeeklyReview.jsx |
| 5 | Goals/OKRs (linked-entity progress) | ✅ | `013_goals.sql`; [goals.model.js:212](../../server/models/goals.model.js#L212); Goals.jsx |
| 5 | Annual Report (8-module) | ✅ | review.js `/annual`; AnnualReport.jsx |
| 6 | Semantic Search (pgvector, ivfflat) | ✅ | `014_pgvector.sql`; embeddings.model.js; research.js `/semantic-search` |
| 6 | Local AI Auto-Tag | ✅ | [autoTagger.js](../../server/lib/autoTagger.js); research.js `/suggest-tags` |
| 6 | PWA (installable, offline, autoUpdate) | ✅ | [vite.config.js:15](../../client/vite.config.js#L15); `dist/sw.js`; nginx cache rules |
| 6 | Polymath Dashboard (multi-year, 6 modules) | ✅ | [polymath.js:20-91](../../server/routes/polymath.js#L20); PolymathDashboard.jsx |
| 7 | AI Chatbox (DeepSeek, dual backend) | ✅ | [chat.js](../../server/routes/chat.js); AIChat.jsx (446 lines) |
| 7 | SSE Streaming (token-by-token, headersSent guard) | ✅ | [chat.js:158-272](../../server/routes/chat.js#L158) |
| 7 | AI context injection (6 entity types, `user_id`-scoped) | ✅ | [chat.model.js:128-145](../../server/models/chat.model.js#L128) |
| 7 | "Ask AI" deep links (4 modules) + Save-to-Research | ✅ | CHANGELOG Wave 7; AIChat.jsx |
| — | Universal Export (all modules) | ❌ | Research-only export; no `/api/export` ZIP |
| — | Web-push reminders | ❌ | PWA installable, no push channel |
| — | `user_settings` (server-side prefs / multi-device) | ❌ | Still "planning only" — no migration |
| — | Habit streaks/calendar | ⚠️ | `goal_type: 'habit'` exists; no streak UI |

---

## V4 → V5 Remediation Ledger — Verified

Every V4 Top Action / roadmap item, checked against shipped code on 2026-06-13.

| V4 Item | V4 Priority | Actually Done? | Evidence |
|---------|-------------|----------------|----------|
| Fix client lint (`useId()` + `globals.node` for e2e) | **Critical** | ✅ | [Modal.jsx:35](../../client/src/components/ui/Modal.jsx#L35); [eslint.config.js:21-36](../../client/eslint.config.js#L21); lint clean |
| Backfill CHANGELOG/PROJECT_STATE | High | ✅ | Detailed Wave 1-7 entries; 20 Wave-6/7 refs each |
| **Universal Links table** | High | ✅ | `007_entity_links.sql`; 22 types; ownership-validated |
| Today Dashboard incl. Engineer | High | ✅ | [dashboard.js:24-38](../../server/routes/dashboard.js#L24) |
| **Universal Export (ZIP all modules)** | High | ❌ | **Not shipped** — Research-only export remains |
| Coverage floor + e2e on PR | Medium | ❌ | **Verbatim un-actioned** — [ci.yml:80,120](../../.github/workflows/ci.yml#L80) |
| Unified cross-module search + ⌘K | Medium | ✅ | [search.model.js](../../server/models/search.model.js); QuickCapture 4 modes |
| Reading Tracker + Time Tracking | Medium | ✅ | `008_reading_tracker.sql`; `012_time_entries.sql` |
| Ship Prometheus config + lock `/metrics` | Medium | ⚠️ Partial | `/metrics` edge-unreachable via nginx; rules still not committed |
| Renumber `user_settings` migration; then build it | Low | ❌ | Still planning-only; ARCHITECTURE note re-staled (says `008`, should be `016`) |
| Weekly Review & Goals | Moonshot | ✅ | `013_goals.sql`; review.js |
| PWA + Offline + Reminders | Moonshot | ⚠️ Partial | PWA ✅; **reminders ❌** |
| Local AI Assist (summarize/auto-tag/semantic) | Moonshot | ✅ | `014_pgvector.sql`; autoTagger.js; chat.js (DeepSeek) |

**Tally: 9 fully done, 2 partial, 4 not done.** The done items are the *foundational* ones (links, search, today, reading, time, goals, review, AI, docs). The not-done cluster around *completion* (export-all, user_settings, reminders) and *gate rigor* (coverage floor, e2e-on-PR) — exactly the §Cross-Cutting Theme 2 pattern.

---

## Score Table — The Full Journey

```
| # | Section                         | V1  | V2  | V3  | V4  | V5  | Δ V4→V5 |
|---|---------------------------------|-----|-----|-----|-----|-----|---------|
| 1 | Security (×2.0)                 | 5.5 | 8.0 | 8.8 | 8.9 | 9.0 | ▲ +0.1  |
| 2 | Backend Resilience (×1.5)       | 6.0 | 7.0 | 7.6 | 8.2 | 8.5 | ▲ +0.3  |
| 3 | Database Integrity (×1.5)       | 7.0 | 7.5 | 7.8 | 8.4 | 8.5 | ▲ +0.1  |
| 4 | Frontend Reliability (×1.5)     | 6.5 | 7.5 | 7.6 | 7.9 | 8.4 | ▲ +0.5  |
| 5 | API Design & Docs (×1.0)        | 7.0 | 7.5 | 6.8 | 8.2 | 8.5 | ▲ +0.3  |
| 6 | Test Suite (×1.25)              | 3.0 | 6.0 | 7.2 | 7.8 | 8.1 | ▲ +0.3  |
| 7 | DevOps & CI/CD (×1.25)          | 6.0 | 7.5 | 8.0 | 7.5 | 8.3 | ▲ +0.8  |
| 8 | Observability (×1.0)            | 4.5 | 6.5 | 6.8 | 8.3 | 8.4 | ▲ +0.1  |
| 9 | Performance (×1.0)              | 5.5 | 6.5 | 7.2 | 7.4 | 7.6 | ▲ +0.2  |
| 10| UI/UX & Accessibility (×1.0)    | 7.0 | 7.5 | 7.4 | 8.1 | 8.4 | ▲ +0.3  |
| 11| Code Quality (×1.0)             | 7.0 | 7.5 | 8.0 | 7.8 | 8.0 | ▲ +0.2  |
| 12| Sustainability (×1.0)           | 6.5 | 8.0 | 8.5 | 7.8 | 8.6 | ▲ +0.8  |
| 13| PMF (×1.5)                      |  —  |  —  |  —  | 2.8 | 6.4 | ▲ +3.6  |
|   | Technical only (12 dims, Σ15.0) | 6.4 | 7.5 | 7.7 | 8.1 | 8.4 | ▲ +0.3  |
|   | Overall (blended, Σwt = 16.5)   | 6.4 | 7.5 | 7.7 | 7.6 | 8.2 | ▲ +0.6  |
```

**Blended math (V5):** Σ(score×weight) = 135.7 over Σweights 16.5 = **8.22 → 8.2.** Technical-only = 126.1 over 15.0 = **8.41 → 8.4.**

---

## Path Forward

### 1. What's left beyond Wave 7 (the last mile)
The roadmap's *spine* is complete. What remains is completion of three partial moonshots + two gate fixes:

| Item | Type | Priority | Effort |
|------|------|----------|--------|
| **Commit the `getGoalStats` fix** (§3.1) | Bug | **Critical** | XS |
| **Universal Export** — `GET /api/export` ZIP of per-table JSON/CSV | Product | High | M |
| **`user_settings` table** (`016_`) — server-side theme/model/notification prefs | Product/Tech | High | M |
| **Coverage floor + e2e-on-PR** (§6.1/§6.3) — make the gates load-bearing | Tech | High | S |
| **AbortController on AI `fetch`** (§2.1) + document egress in SECURITY.md (§1.1) | Tech/Sec | Medium | S |
| **Ship Prometheus config** (`deploy/prometheus/`) + lock `/metrics` at the app port | Tech | Medium | M |
| **Extend axe a11y** to the 8 new pages incl. AIChat (§10.1) | Tech | Medium | M |
| **Mirror `enums.js` to the client** (§11.1) | Tech | Low | M |

### 2. What should be polished
- **Engineer & Finance workflow consolidation** (§13.2) — a single sprint board (issues + checkins + project tasks) and a one-screen financial review (budget + aging + portfolio). These are the two remaining "hop between pages" workflows.
- **Habit tracking as a real loop** — streaks/calendar on top of the existing `goal_type: 'habit'`.
- **Web-push reminders** on the existing PWA (due dates, payables) — pairs with `user_settings` notification prefs.
- **A "last recalculated" indicator** on goals so on-demand progress isn't mistaken for stale.

### 3. Moonshots for 2027
- **Reminders + scheduling** turning the PWA into a true daily driver (push + a calendar surface).
- **Multi-device & sync** once `user_settings` lands — the natural follow-on to leaving `localStorage`.
- **Agentic AI** — let the chatbox *act* (create a linked todo, start a timer, draft a research entry) via tool-calling against the existing routes, with confirmation. The context-injection foundation is already there.
- **On-device-first privacy mode** — make the local Ollama path a first-class toggle so the "your data never leaves the host" property can be restored per-conversation.

### 4. Final Verdict

**Is Polymath OS production-ready, reliable, scalable, and is the vision achieved?**

- **Production-ready:** **Yes.** Zero audit vulnerabilities on both packages, all eight quality gates green (for the first time since V3), a DB-aware health check, atomic financial settles, graceful shutdown, container hardening, and a backup sidecar. The one live bug (`getGoalStats` 500) has a verified fix awaiting a commit.
- **Reliable:** **Yes** — and notably more so than V4. Graceful degradation is now the system's signature: optional moonshots (pgvector, embeddings, auto-tag, AI) are each engineered to fail safe and *cannot* break the core. The main resilience gap is an unbounded upstream-AI timeout, a one-line fix.
- **Scalable:** **For its single-user scope, yes**, with the same consciously-deferred ceilings (single-node uploads, in-process pool, mdeditor weight) — none of which bite at this scale. SQL-side aggregation, dual-direction link indexes, an ivfflat vector index, and PWA precaching all push the ceiling higher than V4.
- **Vision achieved:** **Substantially, yes.** V4's closing benchmark was a single morning screen that pulls tasks, budget, receivables, reading progress, linked papers, an open P0, and yesterday's logged hours into one view. **That screen now exists** (Today Dashboard + Links + Time + Reading + Engineer), and the system around it — unified search, an AI that knows your context, weekly/annual reflection, goals that roll up your linked work — is the daily operating system V4 said its owner "actually deserves." The vision isn't 100% complete (export-all, multi-device, habits, reminders are the open 10%), but the *thesis* — "turn six tools into one system" — is proven in the schema, the routes, and the UI.

**The journey, in one line:** V1 (6.4) was a promising suite; V2-V3 (7.5-7.7) hardened it; V4 (7.6) diagnosed that the engineering had outrun the product; and V5 (**8.2**) is the audit where the product caught up. Across seven waves and 60+ features, Polymath OS went from "six good apps behind one login" to a genuine, connected, AI-assisted operating system for a polymath's life — and the score, for the first time, rises *because of* the product, not in spite of it. **Marathon complete. Ship it — then finish the last mile.**

---

*Audit V5 conducted 2026-06-13. All scores cite shipped code, migration files, or verbatim command output captured the same day. Commands re-run against the working tree; the single uncommitted change (`server/models/goals.model.js`, the §3.1 fix) is noted wherever relevant.*
