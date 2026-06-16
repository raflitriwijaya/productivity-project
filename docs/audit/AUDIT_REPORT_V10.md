# Grand Final Audit V10 — Polymath OS: The Complete System (Application + Infrastructure)

**Auditor:** Distinguished Systems Architect, Principal SRE & Infrastructure Auditor (40+ yrs)
**Date:** 2026-06-16
**Repository:** `project-productivity` (React 19 + Vite/Rolldown / Node 22 + Express 5 / PostgreSQL 16 + pgvector)
**Scope:** The first audit of the **complete system** — not just the web application, but the deployed home-server infrastructure: 19 Docker containers, the Prometheus/Grafana/Uptime-Kuma monitoring stack, the pg_dump + Restic→R2 backup chain, documentation freshness, and 50-year readiness. **Primary mission: re-verify the V9 Critical finding — that the IDR money-input bug is *really* fixed and `parseIdrInput` now drives the production path.**
**Previous Audits:** V1 (6.4) → V2 (7.5) → V3 (7.7) → V4 (7.6) → V5 (8.2) → V6 (8.4) → V7 (8.6) → V8 (8.7) → V9 (8.7, 15-dim)
**The Constitution:** `docs/audit/50_YEAR_LENS.md`

---

## Executive Summary

**The bug that defined nine audits is dead. `parseIdrInput` is wired into all six money forms, `"50.000"` now stores `50000`, and the property suite finally tests the function production actually calls. But bringing the infrastructure into audit scope for the first time reveals that the backup script — the 50-year survivability mechanism — silently protects only four of the nine data stores it claims to, and the CI security gate is currently red.**

Three things are unambiguously, demonstrably better than V9. First, **§15's Critical finding is closed**: every money submit handler now calls `parseIdrInput`, and a live `node` execution against the real function confirms `"50.000"` → `50000`, `"1.500.000"` → `1500000`, and `"50.000.000.000"` → 50 billion, while `5e10`/`0x1A`/`--50000` are rejected as `NaN` ([formatIdr.js:37-66](../../client/src/lib/formatIdr.js#L37)). The exact input from the founding bug report now round-trips correctly. Second, **the V9 §6.1 Critical test-targeting defect is resolved as a side effect** — because the forms now call `parseIdrInput`, the 20,000-iteration property suite is no longer validating a benched function; it tests the production path. Third, **the system is now genuinely deployed on owned hardware** — a repurposed Asus A455LF laptop running 19 containers behind a Cloudflare Zero-Trust Tunnel with zero open ports, full monitoring, and a restore-tested offsite backup. This is the most 50-year-*real* the project has ever been.

**But the infrastructure layer — audited here for the first time — carries two serious, evidence-backed defects in the one component that matters most for survivability.** The offsite backup script `restic backup`s only `/data/postgres_backups`, `gitea_data`, `grafana_data`, and `uptime_kuma_data` ([restic-backup.sh:21-28](../../deploy/scripts/restic-backup.sh#L21)) — yet `docker-compose.yml` mounts **five more** stores into that container (`vaultwarden`, `miniflux-db`, `wallabag`, `nextcloud`, `nextcloud-db`; [docker-compose.yml:196-200](../../docker-compose.yml#L196)), and `POLYMATHOS_SUMMARY.md` claims **"Backup coverage: 100% — every piece of user-generated data"** ([POLYMATHOS_SUMMARY.md:415](../POLYMATHOS_SUMMARY.md#L415)). The Vaultwarden password vault — the doc's own "CRITICAL" service — is mounted read-only into the backup container and **never written to a snapshot.** Worse, the `restic forget` invocation is missing a line-continuation backslash ([restic-backup.sh:36](../../deploy/scripts/restic-backup.sh#L36)), so `--host homelab-server` executes as a standalone command, fails under `set -e`, and **kills the script before the success log and the Telegram "✅ sukses" notification ever fire.** The operator's "instant alert on failure" is, for backups, an instant *silence*.

**The good news for Polymath OS itself: its own data is safe.** The app's `postgres_backups` volume *is* in the four-path snapshot, the June-16 restore test verified it, and the bug crashes the script only *after* the snapshot is taken. The corruption risk is to the *ancillary* self-hosted services, and the *honesty* of the "100%" claim.

**The numbers: §15 leaps from 7.5 → 8.7 on a real, verified fix, and the headline rises to 8.8 — but only +0.1, because folding infrastructure into scope surfaced new operational gaps (CI-red on `npm audit`, an unbounded core-container memory footprint, a weak Grafana default password, a 44%-coverage backup) that V9 never measured.** Technical-only (dims 1–12) holds at **8.8**; the 14-dim comparable holds at **8.8**; the 15-dim blended is **8.8 (+0.1)**.

**Verdict: production-ready, now genuinely user-ready, and deployed — with an infrastructure to-do list.** The Foundation Era's defining application bug is closed. The next reckoning is operational: fix the backup script, unbreak CI, and bound the core containers' memory before Phase 2 (Agentic AI) writes data on top of it.

---

## Quality Gates — Actual Results

Every command executed on **2026-06-16** against the working tree. **Working tree is CLEAN** (`git status` → "nothing to commit, working tree clean"). ✅

| Gate | Command | V9 Result | **V10 Result** | Δ |
|------|---------|-----------|----------------|----|
| Server audit | `npm audit` (server) | ⚠️ 2 moderate | ⚠️ **6 vulns (5 moderate, 1 high)** — `form-data` high (CRLF), `@opentelemetry/core` ×3 moderate, `qs`/`typed-rest-client` moderate | ▼▼ **regression** |
| Server lint | `npm run lint` | ✅ clean | ✅ **clean** (exit 0) | — |
| Server tests | `npm test` | ✅ 46 passed / 38 skipped | ✅ **46 passed / 38 skipped** (8 files passed, 6 skipped) — `Duration 5.11s` | — |
| OpenAPI generation | `npm run openapi` | ✅ 108 paths | ✅ **108 paths** — `OpenAPI spec written … 108 paths` | — |
| Client audit | `npm audit` (client) | ✅ 0 vulns | ⚠️ **2 high** — `form-data` (CRLF), `vite`/`launch-editor` (NTLMv2 + `fs.deny` bypass, Windows) | ▼▼ **regression** |
| Client lint | `npm run lint` | ✅ clean | ✅ **clean** (exit 0) | — |
| Client tests | `npm test` | ✅ 71 passed (4 files) | ✅ **71 passed (4 files)** — `Duration 5.54s` | — |
| Property tests | `npm run test:property` | (in suite) | ✅ **58 passed** — `Duration 3.00s` | — |
| Fuzz tests | `npm run test:fuzz` | (in suite) | ✅ **5 passed** — `Duration 1.94s` | — |
| Client build | `npm run build` | ✅ main 265.95 KB / 84.35 KB gzip | ✅ main `index-DCo7T2xY.js` **265.95 KB / 84.35 KB gzip**; `mdeditor` 1,059.81 KB (lazy); `prism` 85.37 KB; ⚠️ Vite >500 KB warning; PWA **33 entries / 1,607.89 KiB**; `built in 2.23s` | flat |
| Playwright | `npx playwright test --list` | ✅ 128 tests / 4 files | ✅ **128 tests / 4 files** | — |
| Docker compose | `docker compose config --quiet` | n/a | ⚠️ **Not runnable here** — Docker CLI absent on the dev machine; validated structurally by read | n/a |

**Spot checks (all by command this audit):**

| Check | V9 | **V10** | Method |
|-------|----|---------|--------|
| `docs/openapi.json` paths | 108 | **108** | `Object.keys(paths).length` |
| `addPath` calls in generator | 165 | **165** | `grep -c addPath …` |
| Migration files | 23 | **23** | `ls server/db/migrations/*.sql \| wc -l` |
| Client pages | 33 | **33** | `ls client/src/pages/*.jsx \| wc -l` |
| Server routers | 21 | **21** | `ls server/routes/*.js \| wc -l` |
| Server models | 17 | **17** | `ls server/models/*.js \| wc -l` |
| `alert_rules.yml` rules | 8 | **8** | `grep -c 'alert:'` |
| `LINKABLE_TYPES` server == client | 24 == 24 | **24 == 24** | `node -e …` both files, deep-equal `true` |
| **`parseIdrInput` form callers** | **0** | ✅ **6 forms** | `grep -rn parseIdrInput src/` |
| **`Number(form.…)` in money ctx** | 6 fields | ✅ **0** (only `account_id`/`category_id`/`quantity`/`priority`) | `grep -rn "Number(form\." src/` |
| **Working tree** | ✅ CLEAN | ✅ **CLEAN** | `git status` |
| Docker services | n/a | **19** | `docker-compose.yml` read |

**The binary "is `git status` clean?" check PASSES (clean two audits running).** The headline regression is `npm audit`: **both** lanes now carry **high**-severity advisories, which—because CI runs `npm audit --audit-level=high`—means **CI is currently red** (see §7).

---

## Section Scores

| # | Dimension | Weight | V9 | **V10** | Δ |
|---|-----------|--------|-----|---------|---|
| 1 | Security & Authentication | ×2.0 | 9.0 | **8.7** | ▼ −0.3 |
| 2 | Backend Resilience & Reliability | ×1.5 | 8.7 | **8.7** | — |
| 3 | Database Integrity & Data Safety | ×1.5 | 9.0 | **9.1** | ▲ +0.1 |
| 4 | Frontend Reliability & Error Resilience | ×1.5 | 8.8 | **9.0** | ▲ +0.2 |
| 5 | API Design & Documentation | ×1.0 | 9.1 | **9.1** | — |
| 6 | Test Suite Quality & Coverage | ×1.25 | 8.5 | **8.9** | ▲ +0.4 |
| 7 | DevOps & CI/CD Maturity | ×1.25 | 8.7 | **8.6** | ▼ −0.1 |
| 8 | Observability & Debugging | ×1.0 | 8.8 | **9.0** | ▲ +0.2 |
| 9 | Performance & Scalability | ×1.0 | 8.2 | **8.3** | ▲ +0.1 |
| 10 | UI/UX Quality & Accessibility | ×1.0 | 8.8 | **8.8** | — |
| 11 | Code Quality & Maintainability | ×1.0 | 8.4 | **8.6** | ▲ +0.2 |
| 12 | Long-Term Sustainability & Roadmap | ×1.0 | 9.0 | **9.0** | — |
| 13 | Product-Market Fit | ×2.0 | 8.5 | **8.7** | ▲ +0.2 |
| 14 | 50-Year Readiness | ×2.0 | 9.1 | **9.1** | — |
| 15 | **UX Input Validation Correctness** | **×2.0** | **7.5** | **8.7** | ▲ **+1.2** |
| | **Technical-only (dims 1–12, Σ15.0)** | | 8.8 | **8.8** | — |
| | **Blended 14-dim (dims 1–14, Σ19.0)** | | 8.8 | **8.8** | — |
| | **Blended 15-dim (dims 1–15, Σ21.0)** | | 8.7 | **8.8** | ▲ +0.1 |

**Blended math (V10, 15-dim):** Σ(score × weight) = **185.275** over Σweights **21.0** = **8.82 → 8.8.**
Technical-only (dims 1–12) = **132.275 / 15.0 = 8.82 → 8.8.**
14-dim comparable (no §15) = **167.875 / 19.0 = 8.84 → 8.8.**

> **The shape, in one line.** §15 leaps +1.2 on a real, executable-verified fix and lifts Frontend, Tests, Code Quality, and PMF with it. But three dimensions take the cost of bringing infrastructure into scope: Security (−0.3, audit regression + weak Grafana default + public repo) and DevOps (−0.1, CI-red + a buggy backup script) offset the gains, and the heavy ×2.0 dimensions (PMF +0.2, 50-Year flat) net only a modest +0.1 headline. The application got materially better; the infrastructure got materially *visible*.

---

## 1. Security & Authentication — 8.7 / 10  (×2.0)

### Strengths
- **Auth core intact and verified.** `express-session` + `connect-pg-simple` (`name:'sid'`, `httpOnly:true`, `secure:isProd`, `sameSite:'lax'`, 7-day TTL), `helmet` with prod-only HSTS, dual `rateLimit` (`authLimiter` + `generalLimiter`), `trust proxy` for cookies behind nginx — all present in [server/index.js](../../server/index.js#L132). bcryptjs cost 12, parameterized SQL throughout, `user_id` scoping universal.
- **Infrastructure security posture is strong by design.** Zero open inbound ports (Cloudflare Zero-Trust Tunnel, outbound-only); SSH LAN-only + key-only + Fail2ban; UFW active; secrets in `.env` (git-ignored). `.dockerignore` in **both** `server/` and `client/` excludes `.env*`, `node_modules`, `.git`, test/coverage — so **no secrets are copied into images** (verified).
- **Server runs as non-root** (`USER node`, [server/Dockerfile:9](../../server/Dockerfile#L9)); client uses a **multi-stage** build (builder → `nginx:alpine`, [client/Dockerfile](../../client/Dockerfile)).
- nginx ships a real CSP, `X-Frame-Options DENY`, `nosniff`, and `Referrer-Policy` ([nginx.docker.conf:12-17](../../client/nginx.docker.conf#L12)).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 1.1 | **`npm audit` regressed hard.** Server: 6 vulns incl. **1 high** (`form-data` CRLF, GHSA-hmw2-7cc7-3qxx) + 3 moderate `@opentelemetry/core` + `qs`. Client: **2 high** (`form-data` CRLF; `vite`/`launch-editor` NTLMv2 hash disclosure + `fs.deny` bypass). V9 was 2 moderate / 0. | **High** | S | `npm audit fix` in both. `form-data`/`vite` advisories are build/outbound-HTTP-path, not the inbound Express request path, and the app is single-user behind a tunnel — real exposure is low — **but these break the CI gate** (§7.1). |
| 1.2 | **Grafana ships a weak default password.** `GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-changeme123}` ([docker-compose.yml:140](../../docker-compose.yml#L140)); `GRAFANA_PASSWORD` is **not listed in `.env.docker.example`**, so an operator following the template never sets it — leaving `changeme123` on a **publicly-exposed** `grafana.mightguy.my.id`. | **High** | S | Add `GRAFANA_PASSWORD` to `.env.docker.example` with a generate-it note; consider removing the insecure default so an unset value fails loudly. |
| 1.3 | **Repository is now fully public** (`30d17c7 full open-source`). The config templates are clean, but a public repo raises the cost of any future committed secret and makes the weak-default-password gap (1.2) internet-discoverable. | Medium | S | One-time `git log -p` / secret-scan sweep of history; enable GitHub secret scanning + Dependabot. |
| 1.4 | `/metrics` unauthenticated at the app port; no CSRF token (defence is `sameSite:lax` + CORS). | Low | M | Carried V5–V9. Edge-blocked by nginx; documented limitation. |

**Net:** the application's auth architecture is unchanged and excellent, and the network design (zero open ports, tunnel, non-root, scrubbed images) is genuinely strong. But the audit regression now carries **high**-severity advisories in both lanes, the publicly-exposed Grafana has an insecure default, and the repo went public — three real deductions. **8.7 (▼ −0.3).**

---

## 2. Backend Resilience & Reliability — 8.7 / 10  (×1.5)

### Strengths
- **All V9 resilience patterns intact and now hardened by the platform.** AbortController bounds on AI upstreams; export streaming with `archive.on('error')` + `res.headersSent` guard ([export.js:124,186](../../server/routes/export.js#L124)); graceful shutdown; DB-aware `/health`.
- **The platform adds real resilience.** `restart: unless-stopped` on every service; `depends_on … condition: service_healthy` chains db → api → nginx; healthchecks on the **three core services** (db `pg_isready`, api `/health`, nginx `curl /`). The Dockerfile runs `migrate.js && index.js` so the schema is always current before the server accepts traffic.
- `recalcProgress` derived-state discipline (V9) unchanged.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 2.1 | **No `mem_limit` on `db`, `api`, `nginx`, `db_backup`, `cloudflared`** — the five core containers are unbounded on an 8 GB host. A Postgres memory spike or an API leak can OOM-kill siblings. The infra doc acknowledges only `api`+`nginx` as debt ([POLYMATHOS_SUMMARY.md:528-529](../POLYMATHOS_SUMMARY.md#L528)) — **`db` (the riskiest) is not even on the list.** | **High** | S | Add `mem_limit` to all five; `db` especially (e.g. 1–2 GB) plus a matching `shared_buffers`. |
| 2.2 | No retry/backoff on transient DB errors; export remains one unbounded request. | Medium | M | Carried V3–V9. |

**Net:** code-level resilience holds and the platform adds healthchecks + restart policies, but the unbounded core containers are a real reliability risk on constrained hardware. **8.7 (—).**

---

## 3. Database Integrity & Data Safety — 9.1 / 10  (×1.5)

### Strengths
- **The app DB now has a *tested* offsite restore path.** `postgres_backups` (nightly `pg_dump | gzip`, [backup.sh:8](../../deploy/scripts/backup.sh#L8)) is one of the four paths the Restic→R2 snapshot *does* include ([restic-backup.sh:22](../../deploy/scripts/restic-backup.sh#L22)), and the **June-16 restore test verified `postgres_backups ✓`** ([POLYMATHOS_SUMMARY.md:199-203](../POLYMATHOS_SUMMARY.md#L199)). The `restic forget` script bug (§5.3) crashes the script only *after* the snapshot is written, so the DB dump is captured nightly regardless.
- **Integrity tests now run in CI.** `npm run test:integrity` is a real CI step after `migrate` ([ci.yml:83-84](../../.github/workflows/ci.yml#L83)) — 9 real-Postgres constraint checks (core tables, `chk_entity_link_types`, no orphaned `entity_links`, every `user_id` FK `ON DELETE CASCADE` with a non-vacuous guard, the transactions CHECK, transfer dedup, `uq_entity_link`, `habit_logs` one-per-day, `set_updated_at()`).
- **pgvector image** (`pgvector/pgvector:pg16`) confirmed in compose; `postgres_data` volume layout unchanged. 23 migrations, additive throughout.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 3.1 | **`db` container has no `mem_limit`** (see §2.1) — a Postgres OOM is the most direct path to data-availability loss on this host. | High | S | Bound it. |
| 3.2 | Migrations forward-only (no `down`); the integrity suite skips local `npm test` (runs only CI-with-DB). | Low | S/L | Carried; conscious trades. |
| 3.3 | Two legacy `YYYYMMDD_*` migrations sort after the numbered series — cosmetic, but a future contributor could misread the order. | Low | XS | Carried; documented in CLAUDE.md §3.2. |

**Net:** the constraint contract is tested in CI, the app DB has a verified offsite restore, and the schema grows additively. Held back only by the unbounded `db` container. **9.1 (▲ +0.1).**

---

## 4. Frontend Reliability & Error Resilience — 9.0 / 10  (×1.5)

### Strengths
- **🟢 The money inputs now produce *correct results*, not silently-wrong ones.** This was V9's High §4.1 gap ("the frontend doesn't fall over; it quietly lies"). It is closed. Every money submit handler calls `parseIdrInput` ([CreateTransactionModal.jsx:150](../../client/src/components/finance/CreateTransactionModal.jsx#L150), [LedgerModal.jsx:77](../../client/src/components/finance/LedgerModal.jsx#L77), [PortfolioModal.jsx:78-79](../../client/src/components/finance/PortfolioModal.jsx#L78), [Accounts.jsx:45](../../client/src/pages/Accounts.jsx#L45), [Budget.jsx:30](../../client/src/pages/Budget.jsx#L30), [Portfolio.jsx:34](../../client/src/pages/Portfolio.jsx#L34)). Live verification (§15) confirms `"50.000"` → `50000`.
- **Forms still never throw on hostile input.** `parseIdrInput` returns `NaN` (not an exception) for garbage, and every form validates `Number.isNaN` before submit — the modals show inline errors ("Enter a non-zero amount", "Enter a valid price").
- **Carried:** root `ErrorBoundary`, `429 ≠ 401` (no hard-redirect on rate-limit), lazy Research/Engineer pages, ⌘K palette, installable PWA, SSE via raw `fetch`.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 4.1 | **Account opening balance still coerces invalid→0 silently.** `parseIdrInput(initial \|\| '0') \|\| 0` ([Accounts.jsx:45](../../client/src/pages/Accounts.jsx#L45)) now parses dot-grouped values correctly, but a `NaN` (e.g. typing only dots) becomes `0` with **no inline error** — unlike the modals. The bug class shrank from "every money field" to "one field, garbage-only input," but it persists. | Medium | S | Validate like the modals: show "Enter a valid amount" on `NaN` rather than `\|\| 0`. |
| 4.2 | **Commented-out dead `axios.create` block persists** in [api.js:19-23](../../client/src/lib/api.js#L19), with mixed-language (Indonesian) comments. Carried V8 §4.3 / V9 §4.2. | Low | XS | Delete the block. |
| 4.3 | Client unit coverage of *pages* still thin (the 71 tests concentrate in `formatIdr`, `forms.fuzz`, `MarkdownSanitization`, `QuickCapture`). | Medium | L | Carried V6–V9. |

**Net:** the input layer no longer lies — the single biggest correctness gap in the app's history is fixed and verified. One residual silent-→0 edge and the carried dead block keep it from 9.2. **9.0 (▲ +0.2).**

---

## 5. API Design & Documentation — 9.1 / 10  (×1.0)

### Strengths
- **Contract complete and stable:** 108 emitted paths, 165 `addPath` calls, envelope `{ success, data }`/`{ success, error }` intact, `user_id` scoping universal, literal-before-parameterized ordering held.
- nginx correctly carves out `/api/chat/send` with `proxy_buffering off` for SSE *before* the generic `/api` block ([nginx.docker.conf:54-66](../../client/nginx.docker.conf#L54)) — a subtle, correct ordering that preserves token-by-token streaming.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 5.1 | **CI OpenAPI gate still counts `addPath(` in the generator, not paths in the emitted spec** ([ci.yml:61](../../.github/workflows/ci.yml#L61)) — and the threshold is a stale `≥75` against an actual 108. Carried V4–V9. | Low | S | Parse `docs/openapi.json` and assert `Object.keys(paths).length`. |
| 5.2 | **`/api/export` covers 10 of ~13 user-data modules** — see §13.3 / Invariant 1. The API *self-describes* completely, but the export endpoint omits roadmaps + habits. | Medium | S | Add the three roadmap tables + `habit_logs` to `fetchAll`. |
| 5.3 | No API versioning. | Low | M | Documented decision. |

**Net:** the spec is complete and well-ordered; the export-coverage gap is a route-behaviour issue tracked under PMF/Invariant 1, not a contract-shape one. **9.1 (—).**

---

## 6. Test Suite Quality & Coverage — 8.9 / 10  (×1.25)

### Strengths
- **🟢 V9's Critical §6.1 is resolved — the money suite now tests the production function.** Because all six forms call `parseIdrInput`, the property suite (58 passing, 10K-iteration roundtrip/idempotence/×100-guard) and fuzz suite (5 passing, never-throws + NaN-on-garbage) now validate the *exact* function the submit path invokes. The deceptive "tests a benched function" artifact is gone.
- **The high-value suites are wired into CI.** `npm run test:property` and `npm run test:fuzz` are explicit client-job steps ([ci.yml:121-126](../../.github/workflows/ci.yml#L121)); `npm run test:integrity` runs in the server job after `migrate` ([ci.yml:83](../../.github/workflows/ci.yml#L83)); server coverage floor (lines 60 / functions 50 / branches 40 / statements 60) enforced ([ci.yml:78](../../.github/workflows/ci.yml#L78)); full Playwright on a real stack in the `e2e` job.
- Breadth retained: 46 server tests, 71 client tests, 128 Playwright tests across 4 files.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 6.1 | **Still no test that drives the *actual* `<input>` element.** The property/fuzz suites test `parseIdrInput` directly — correct now, but V9's literal ask ("fill a money `<input>` with `'50.000'` and assert the stored value") is unmet. A future refactor that bypasses `parseIdrInput` in a handler would not be caught. | Medium | M | Add one component/e2e test per money form that types `"50.000"` and asserts the submitted payload. |
| 6.2 | **`visual.spec.js` / `smoke-full.spec.js` remain opt-in** (`RUN_VISUAL` / `RUN_SMOKE`), and **mutation testing has a config but no CI job and no recorded score**; `formatIdr.js` (the single most safety-critical pure function) may still be outside mutation scope. | Medium | M | Commit visual baselines; schedule a periodic mutation run including `formatIdr.js`. |
| 6.3 | No `test:integrity` / `test:property` equivalent asserting **roadmap/habit export** round-trips — the omission (§5.2) is untested. | Low | S | Add an export-coverage assertion. |

**Net:** the suite's targeting defect — the thing that let the bug survive — is fixed, and the strongest suites now run in CI. A real form-fill test and a mutation score are the remaining gaps. **8.9 (▲ +0.4).**

---

## 7. DevOps & CI/CD Maturity — 8.6 / 10  (×1.25)

### Strengths
- **The pipeline matured.** Three jobs (server / client / e2e); real-Postgres service for integration + integrity; coverage floor; property + fuzz + integrity all wired in; e2e spins up server+client and runs full Playwright with screenshot artifacts on failure.
- **The deployment is real and documented.** 19 containers, healthchecks on the core trio, `restart: unless-stopped` everywhere, a pinned-tag discipline for stateful services (`nextcloud:28-apache`, `vaultwarden/server:1.36.0`, `gitea/gitea:1.22`, `pgvector/pgvector:pg16`), a migration path to new hardware, and a runbook with daily/weekly/monthly/6-month checks ([POLYMATHOS_SUMMARY.md:419-492](../POLYMATHOS_SUMMARY.md#L419)).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 7.1 | **🔴 CI is currently red.** Both jobs run `npm audit --audit-level=high` ([ci.yml:49,106](../../.github/workflows/ci.yml#L49)); both lanes now have **high**-severity advisories (§1.1). The next push to `main`/PR **fails at the security-audit step**, blocking the very merge that would fix it. | **Critical** | S | `npm audit fix` both lanes now; then the gate passes and protects going forward. |
| 7.2 | **🔴 The offsite backup script has two real bugs** (§5.3): it backs up only 4 of 9 mounted stores, and a missing `\` makes `restic forget` crash the script under `set -e` before the success notification. | **Critical** | S | Fix both (see §5.3). |
| 7.3 | OpenAPI CI gate counts the generator script, not the emitted spec, against a stale `≥75` threshold. | Low | S | Carried (§5.1). |
| 7.4 | `restic check` (repo integrity) is not automated; the doc lists it as weekly-manual debt ([POLYMATHOS_SUMMARY.md:530](../POLYMATHOS_SUMMARY.md#L530)). | Medium | S | Add a weekly cron in the restic container. |

**Net:** genuine maturity — full monitoring, healthchecks, restore-tested backup, runbook — but offset by a **red CI gate** and a **backup script with two bugs in the one component that must never fail silently.** Maturity up, reliability of the safety nets down. **8.6 (▼ −0.1).**

---

## 8. Observability & Debugging — 9.0 / 10  (×1.0)

### Strengths
- **A full monitoring stack is now deployed**, not just instrumented: Prometheus (scrapes `polymath-api:/metrics`, `node-exporter`, `cadvisor`; [prometheus.yml](../../deploy/prometheus/prometheus.yml)), Grafana (dashboard 1860 Node-Exporter-Full), Uptime-Kuma (60 s HTTP checks on all public endpoints with Telegram alerting + retry logic), node-exporter (host CPU/RAM/disk/net), cadvisor (per-container). ~190 MB idle footprint.
- **8 app-level alert rules** ([alert_rules.yml](../../deploy/prometheus/alert_rules.yml)): error-rate, P99 latency, pool exhaustion/near-capacity, `/health` 503, scrape-down, AI upstream latency + timeout-rate — all sensible thresholds.
- App-side: prom-client HTTP histogram/counter + pool gauge, AI upstream duration histogram, pino redaction, Sentry-on-DSN (build-arg wired through the client Dockerfile).

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 8.1 | **No host-level alert rules** despite scraping node-exporter + cadvisor — no disk-full, memory-pressure, or container-down alerts. On an 8 GB / 128 GB-SSD host running 19 containers, **disk-full and OOM are the most likely real incidents** and are the least covered. | **High** | S | Add `node_filesystem_avail`, `node_memory_MemAvailable`, and a cAdvisor container-restart alert. |
| 8.2 | **Backup success/failure is unobservable.** The Telegram "✅ sukses" never fires (the `restic forget` crash, §5.3), and there is no Prometheus alert on backup *freshness* (e.g. "no snapshot in 36 h"). A silently-failing backup is the worst observability gap of all. | **High** | S | Fix the script (§5.3); add a backup-freshness alert (push a timestamp metric or use a blackbox/textfile exporter). |
| 8.3 | No distributed tracing/APM; no metric for `recalcProgress` or export bundling cost. | Low | L | Carried. |

**Net:** a real leap from "metrics endpoint exists" to "deployed, dashboarded, alerting stack." Held back from 9.3 by the absence of host-level and backup-freshness alerts — the exact failures this hardware will actually hit. **9.0 (▲ +0.2).**

---

## 9. Performance & Scalability — 8.3 / 10  (×1.0)

### Strengths
- **Bundle flat through the cycle:** main 265.95 KB / 84.35 KB gzip (identical to V9); PWA 33 entries / 1,607.89 KiB; `built in 2.23s`.
- **Resource discipline is now explicit and measured.** Every monitoring/ancillary container declares `mem_limit`; the doc tracks actual-vs-limit RAM (~937 MB / 7.2 GB, 13%) with a per-container budget table and a flagged `uptime-kuma` at 74%.
- Performance baselines codified ([performance.test.js](../../server/test/performance.test.js), 14 endpoint ceilings) — opt-in.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 9.1 | **Core app containers are unbounded** (§2.1) — the resource discipline that covers monitoring services stops exactly at `db`/`api`/`nginx`. | High | S | Bound them. |
| 9.2 | `mdeditor` chunk **1,059.81 KB** still trips Vite's >500 KB warning. | Medium | M | Carried V4–V9 (lazy + cached). |
| 9.3 | Performance baselines never run without `TEST_SERVER`; HDD I/O is the doc's acknowledged weakest link for the DB. | Low | S | Smoke-perf run against the ephemeral CI server. |

**Net:** flat bundle, explicit RAM budgeting on most of the stack, codified baselines — but the unbounded core trio and the 1 MB editor chunk persist. **8.3 (▲ +0.1).**

---

## 10. UI/UX Quality & Accessibility — 8.8 / 10  (×1.0)

### Strengths
- Money fields now correct **and** carry an affordance: `inputMode="numeric"` everywhere, and the Accounts opening-balance field has explicit `helperText` ("The balance before any recorded transactions", [Accounts.jsx:69](../../client/src/pages/Accounts.jsx#L69)).
- Carried: focus trap + restore, per-route titles, ⌘K palette, grouped sidebar, four-state lists, global Export, notification bell, rich roadmap UX.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 10.1 | **The roadmap pages are STILL absent from the axe a11y sweep.** `a11y.spec.js` covers 17 pages via `PAGES_TO_CHECK` ([a11y.spec.js:8-27](../../client/e2e/a11y.spec.js#L8)); `grep roadmap` returns 0. This is now **twice-recurred** (V7 §10.1 → V9 §10.1 → V10) — a standing pattern: new pages ship without a11y coverage. | Medium | S | Add `/roadmaps` (and a seeded `/roadmaps/:id`) to `PAGES_TO_CHECK`. |
| 10.2 | **Money fields offer no live grouping.** `formatIdrInput` (which renders `1500000` → `1.500.000`) exists and is tested but is **never wired into a field** — fields show plain ungrouped digits. An Indonesian user gets correctness but not the visual confirmation. | Low | S | Wire `formatIdrInput` as a display layer, or add helper text. |

**Net:** correctness + a numeric-mode affordance, but the twice-recurred a11y-coverage gap and the unused display helper hold it flat. **8.8 (—).**

---

## 11. Code Quality & Maintainability — 8.6 / 10  (×1.0)

### Strengths
- **🟢 The V9 §11.1 dead-code hazard is resolved.** `parseIdrInput` — V9's "dead code masquerading as critical code" — is now imported and called by six forms. The JSDoc that *claimed* the forms use it is now *true* ([formatIdr.js:73](../../client/src/lib/formatIdr.js#L73)). A future maintainer fixing a bug there will see production effect.
- New feature code (roadmaps) remains convention-clean; clean working tree; CONTRIBUTING + SECURITY de-duplicated.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 11.1 | **`formatIdrInput` is still display-helper-dead** — tested but wired to no field (§10.2). Less dangerous than the V9 `parseIdrInput` case (it's clearly a display helper), but still tested-but-unused. | Low | S | Wire it (§10.2) or note it as a display helper available for opt-in use. |
| 11.2 | **Dual 50-Year Lens documents persist** — `50_YEAR_LENS.md` + `50_YEAR_LENS-deepseek.md`. Carried V8 §11.2 → V9 §11.2 → V10. The dual-constitution ambiguity remains. | Medium | XS | Pick one canonical lens; merge/delete the other. |
| 11.3 | **Mixed-language comments throughout infra + client.** Indonesian comments in `api.js`, `client/Dockerfile` ("Serve dengan Nginx"), `backup.sh` ("Hapus backup lokal"), `restic-backup.sh`, `nginx.docker.conf` ("Proxy ke container api"). Harmless functionally; a maintainability/consistency smell for an open-source repo. | Low | M | Standardize on English for shipped code/config comments. |
| 11.4 | Commented-out dead block in `api.js` (§4.2). | Low | XS | Delete. |

**Net:** the most deceptive dead code in the repo is now live and honest — a real maintainability win — offset by the persisting dual lens, the unused display helper, and mixed-language config comments. **8.6 (▲ +0.2).**

---

## 12. Long-Term Sustainability & Roadmap — 9.0 / 10  (×1.0)

### Strengths
- **The project is now a working demonstration of its own 50-year thesis.** Self-hosted on owned hardware, open formats, documented migration path to a Phase-6 mini-PC (`docker compose down` → `tar`/`rsync` → `git clone` → `docker compose up -d`, [POLYMATHOS_SUMMARY.md:572-584](../POLYMATHOS_SUMMARY.md#L572)), Rp 0/month cloud cost. The "digital sovereignty" mission is executed, not just stated.
- Ten audit cycles deep; constitution exists; CHANGELOG documents the feature waves.

### Gaps
| # | Finding | Priority | Effort | Recommendation |
|---|---------|----------|--------|----------------|
| 12.1 | **The most important sustainability mechanism — offsite backup — has the two bugs of §5.3.** A 50-year plan whose backup silently covers 44% of stores and whose success-signal never fires is a sustainability *liability*, not asset, for the uncovered services. | High | S | Fix §5.3 first. |
| 12.2 | Dual 50-Year Lens (§11.2); no feature-flag mechanism (Roadmap 1.7). | Medium/Low | XS/M | Resolve / `user_settings` is the home. |

**Net:** the system grows additively and now *runs* its sovereignty thesis — but the backup defects undercut the survivability story for the non-app services. **9.0 (—).**

---

## 13. Product-Market Fit — 8.7 / 10  (×2.0)

### 13.1 Cross-Module Integration — 2.9 / 3 *(V9: 2.9)*
24 `entity_links` types, mirrored server/client (deep-equal verified). Roadmaps are first-class link participants. Unchanged-strong.

### 13.2 Workflow Support — 1.95 / 2 *(V9: 1.9)*
**The finance module now actually works for its user.** A money app that stored `50` when the user typed `50.000` did not support the workflow; it sabotaged it. With the fix, the core finance workflow (record → budget → portfolio → ledger) is correct end-to-end for Indonesian number entry. **+0.05.**

### 13.3 Data Portability & Longevity — 1.75 / 2 *(V9: 1.85)*
**The `/api/export` endpoint omits roadmaps and habits.** `fetchAll` exports 10 modules ([export.js:48-86](../../server/routes/export.js#L48)) but **not** `learning_roadmaps`/`roadmap_tracks`/`roadmap_milestones` (migration 019) or `habit_logs` (migration 018). The data survives in `pg_dump` (so it's not lost), but the user-facing "export all my data" promise is incomplete. V9 flagged this as "unconfirmed"; now **confirmed**. **−0.1.**

### 13.4 Personalization & Adaptability — 1.85 / 2 *(V9: 1.85)*
Roadmaps fully user-defined; user_settings per-user. Unchanged.

### 13.5 Missing Capabilities — −0.0 *(V9: −0.0)*
Remaining gaps are next-era (agentic AI, multi-device push).

### 13.6 Total
2.9 + 1.95 + 1.75 + 1.85 − 0.0 = **8.7 / 10.** **+0.2** — the money fix makes the headline finance workflow trustworthy; partly offset by the now-confirmed export omission.

---

## 14. The 50-Year Readiness Dimension (§14, ×2.0) — 9.1 / 10

### 14.1 Constitutional Integrity — 2.85 / 3.0
- **Invariant 1 (open, exportable):** ⚠️ All data is in Postgres/open formats and survives `pg_dump`, **but the self-serve export omits roadmaps + habits** (§13.3). Exportable-in-principle, not exportable-in-app. **−0.15.**
- **Invariant 2 (spine):** ✅ route→model→SQL, component→hook→API verified.
- **Invariant 3 (additive):** ✅ 23 migrations, additive; the money fix changed *call sites*, not core.
- **Invariant 4 (`user_id` scoping):** ✅ universal; integrity test asserts every FK CASCADE.
- **Invariant 5 (documented rationale):** ⚠️ CHANGELOG has **no entry for the IDR fix or the home-server infra** (§6 below); dual lens. **−0.0 here, counted in 14.2.**
- **Invariant 6 (`pg_dump` + source = rebuild):** ✅ `git status` clean. ⚠️ compose now couples to host `/mnt/data` bind mounts + four `external: true` volumes not in the repo — the *app* rebuilds from source, but the *full stack* now depends on host state.

### 14.2 Documentation Ecosystem — 1.8 / 2.0
Lens + OpenAPI (108) + enums (24/24) intact, and `POLYMATHOS_SUMMARY.md` is a genuinely excellent infra runbook. **−0.2** for: CHANGELOG stale (no IDR-fix / infra entries), dual lens, and the **false "100% backup coverage" claim** (§5.3) — a doc that misstates the safety net is a 50-year hazard.

### 14.3 Data Portability & Survivability — 1.95 / 2.0
The **app DB** has a tested offsite restore (`postgres_backups ✓`, June 16). **−0.05** because the survivability mechanism is buggy for the *other* stores (§5.3) and `restic check` isn't automated.

### 14.4 Evolvability & Technical Debt — 2.5 / 3.0
- ✅ Clean tree; ✅ the V9 dead-code + test-targeting debts are *paid* (the money fix retired both).
- ⚠️ **−0.3:** the backup script bugs + CI-red + unbounded core containers — new operational debt surfaced by infra scope.
- ⚠️ **−0.2:** dual lens, mixed-language comments, the export omission, the stale CHANGELOG.

### 14.5 Total
2.85 + 1.8 + 1.95 + 2.5 = **9.1 / 10.** Weight ×2.0 = 18.2.

**Interpretation:** The structural foundation is the strongest it has ever been *and* it now runs on real, owned hardware with a tested restore for the app's own data — a profound 50-year milestone. The deductions all migrated to the **operational boundary**: a backup that under-covers, a CHANGELOG that under-documents, and an export that under-exports. The architecture will outlive the decade; the *operational discipline around the safety nets* is the new frontier. **9.1 (—).**

---

## 15. UX Input Validation Correctness (§15, ×2.0) — 8.7 / 10  ★ THE RECKONING, RESOLVED

> The dimension V1–V8 missed and V9 exposed. Scored from the **actual production code path** — and this audit, that path finally runs the right function.

### How money actually flows now (the corrected trace)
Every money field's `onChange` strips to `[0-9.]` (keeping the dot), and **every submit handler calls `parseIdrInput`** — which reads `.` as the id-ID **thousands separator**, strips `Rp`/`IDR`/whitespace, treats `,` as decimal, preserves a single leading minus, and *rejects* scientific/hex/double-negative as `NaN` ([formatIdr.js:37-66](../../client/src/lib/formatIdr.js#L37)).

### 15.1 IDR / Money Input Fields — 3.7 / 4

**Live `node` execution against the real `parseIdrInput` (this audit):**

| Input | Result | | Input | Result |
|-------|--------|-|-------|--------|
| `"50000"` | **50000** ✅ | | `"5e10"` | **NaN** (rejected) ✅ |
| `"50.000"` | **50000** ✅ | | `"--50000"` | **NaN** ✅ |
| `"1.500.000"` | **1500000** ✅ | | `"0x1A"` | **NaN** ✅ |
| `"50.000.000.000"` | **50000000000** ✅ | | `"abc"` / `""` / `null` | **NaN** ✅ |
| `"-50000"` | **−50000** ✅ | | `"Rp 50.000"` | **50000** ✅ |
| `"1500,5"` | **1500.5** ✅ | | `"IDR 1.500.000"` | **1500000** ✅ |

Roundtrip per field, **real submit path:**

| Field | File:line | `"50.000"`→50000? | `"1.500.000"`→1500000? | Garbage |
|-------|-----------|-------------------|------------------------|---------|
| Transaction Amount | CreateTransactionModal.jsx:150 | ✅ | ✅ | NaN → inline "non-zero" error ✅ |
| Budget (inline) | Budget.jsx:30,37 | ✅ | ✅ | NaN/negative → revert to stored ✅ |
| Portfolio Avg/Current Price | PortfolioModal.jsx:78-79 | ✅ | ✅ | NaN → "valid price" error ✅ |
| Portfolio (inline price) | Portfolio.jsx:34,41 | ✅ | ✅ | NaN → revert to stored ✅ |
| Receivables / Payables | LedgerModal.jsx:77 | ✅ | ✅ | NaN/≤0 → "valid positive" error ✅ |
| **Account Opening Balance** | Accounts.jsx:45 | ✅ | ✅ | ⚠️ NaN → **0 silently, no inline error** |

**Findings:**
- **🟢 The canonical bug is dead.** `"50.000"` → 50000 in **every** money field, verified by execution. The ×100 over-correction (V8) and the ×1000 under-correction (V9) are **both** eliminated.
- **🟢 The "hardening" is now reachable.** Because the forms call `parseIdrInput`, its scientific/hex/double-negative rejections (which V9 found were on a dead path) now actually defend the production input.
- **🟠 One residual edge:** Account opening balance `parseIdrInput(initial \|\| '0') \|\| 0` ([Accounts.jsx:45](../../client/src/pages/Accounts.jsx#L45)) silently maps a `NaN` (e.g. all-dots input) to `0` with no inline error. Valid dot-grouped input now works; only true garbage hits the silent `\|\| 0`. **Priority: Medium. Effort: S.**

**Score 3.7/4:** the dimension's reason for existing is satisfied — the worst class of bug in the app's history is fixed and verified end-to-end. The −0.3 is the Account-balance silent-→0 edge and the absence of a literal form-fill test (§6.1).

### 15.2 Non-Money Numeric Inputs — 1.7 / 2
Goals target (`parseFloat` + NaN-validated), Learning hours/progress (`type=number step=0.5`, 0–100), Timer (server-driven). ✅ −0.3: no upper bounds; carried.

### 15.3 Text Input Robustness — 1.6 / 2
`O'Brien`/`Müller` safe (parameterized SQL), Zod length caps, newlines preserved, `.trim() \|\| null` consistent. −0.4: client doesn't pre-validate length (relies on server 400). Carried.

### 15.4 Date Input Handling — 0.8 / 1
`type=date`, `.slice(0,10)`, server `DATE_RE`, cross-field checks. −0.2: `new Date().toISOString().slice(0,10)` uses **UTC**, so a WIB (UTC+7) user near midnight can get yesterday's date. Carried.

### 15.5 Select / Dropdown Correctness — 0.9 / 1
Enums from mirrored `enums.js`, sensible defaults, `String()` id coercion, type-change resets. −0.1: numeric vs string `<option>` value inconsistency. Carried.

### 15.6 Total for §15
3.7 + 1.7 + 1.6 + 0.8 + 0.9 = **8.7 / 10.** Weight ×2.0 = 17.4. **+1.2 vs V9.**

**Interpretation:** The dimension created to expose a hidden corruption now records its fix. Money is correct, verified by execution across all six fields; non-money, text, date, and select inputs are solid. The remaining 1.3 points are a silent-→0 edge, a UTC date edge, missing length pre-validation, and the still-missing literal form-fill test. **8.7.**

---

## Test Suite Quality Audit (Phase 4 detail)

| Suite | File | V10 Verdict |
|-------|------|-------------|
| Property tests | `formatIdr.property.test.js` | ✅ **58 passed.** Now tests the **production** function (forms call `parseIdrInput`). V9's "benched function" defect resolved. |
| Fuzz tests | `forms.fuzz.test.js` | ✅ **5 passed.** Never-throws + NaN-on-garbage confirmed against the live function. |
| Integrity | `integrity.test.js` | ✅ Excellent; **runs in CI** after `migrate` (`npm run test:integrity`). |
| Coverage floor | CI step | ✅ lines 60 / fn 50 / br 40 / stmt 60 enforced. |
| Visual regression | `visual.spec.js` | ⚠️ Opt-in (`RUN_VISUAL`); baselines likely uncommitted. |
| Full smoke | `smoke-full.spec.js` | ⚠️ Opt-in (`RUN_SMOKE`). |
| Performance | `performance.test.js` | ✅ 14 thresholds; ⚠️ opt-in (`TEST_SERVER`). |
| Mutation | `stryker.config.json` | ⚠️ Config only; no CI job, no score; `formatIdr.js` scope unconfirmed. |

**Theme:** the client money suite — the weak link in V9 — is now load-bearing, and integrity/property/fuzz run in CI. The remaining gap is a *form-element* test and a recorded mutation score.

---

## Docker & Infrastructure Audit (Phase 5)

### 5.1 Compose Configuration
- ✅ `db` uses `pgvector/pgvector:pg16`; healthchecks on `db`/`api`/`nginx`; `restart: unless-stopped` universal; `depends_on … service_healthy` chains; env parameterized with sane defaults; stateful images pinned to `major.minor`.
- ⚠️ **`docker compose config --quiet` not runnable here** (Docker CLI absent on the dev box). YAML validated by read — structurally sound; one cosmetic inconsistency: `gitea/gitea:1.22` in compose vs `gitea/gitea:latest` in the doc.
- 🔴 **No `mem_limit` on `db`, `api`, `nginx`, `db_backup`, `cloudflared`** (§2.1). The monitoring/ancillary services are all bounded; the core trio is not.

### 5.2 Container Security
- ✅ Server non-root (`USER node`); client multi-stage; `.dockerignore` excludes `.env*` in both contexts → **no secrets in images**.
- ⚠️ nginx image runs as root (drops to worker) — standard, minor.
- 🔴 Grafana weak default password (§1.2).

### 5.3 Backup Configuration — **TWO CRITICAL BUGS**
- ✅ `db_backup` sidecar: nightly `pg_dump | gzip` at `0 2 * * *`, 7-day local retention, optional S3/R2 sync ([backup.sh](../../deploy/scripts/backup.sh)).
- 🔴 **Coverage bug.** `restic-backup.sh` snapshots only `/data/postgres_backups`, `gitea_data`, `grafana_data`, `uptime_kuma_data` ([restic-backup.sh:21-28](../../deploy/scripts/restic-backup.sh#L21)). Compose mounts **five more** read-only into the container — `vaultwarden`, `miniflux-db`, `wallabag`, `nextcloud`, `nextcloud-db` ([docker-compose.yml:196-200](../../docker-compose.yml#L196)) — that the script **never backs up**. `POLYMATHOS_SUMMARY.md` claims **"Backup coverage: 100%"** ([:415](../POLYMATHOS_SUMMARY.md#L415)) and lists all nine in the pipeline diagram ([:176-185](../POLYMATHOS_SUMMARY.md#L176)). The **Vaultwarden password vault** (the doc's own "CRITICAL") is mounted-but-unbacked. The June-16 restore test verified only the four included paths — *self-consistent with the bug, contradicting the 100% claim.*
- 🔴 **Script-crash bug.** `restic forget` is missing the line-continuation `\` after `--tag homelab` ([restic-backup.sh:36](../../deploy/scripts/restic-backup.sh#L36)); `--host homelab-server` then runs as a standalone command, fails, and under `set -e` **terminates the script before the success log (line 39) and the Telegram "✅ sukses" (line 40).** Net: the snapshot is taken (it precedes the crash), but pruning runs un-host-scoped and **no success notification ever sends** — backup health is unobservable.
- ✅ **Polymath OS's own data is safe**: `postgres_backups` is in the four-path snapshot and restore-tested. The corruption/silence risk is to the ancillary services + operator trust.
- ⚠️ `restic check` not automated (doc-acknowledged debt).

### 5.4 Monitoring Coverage
- ✅ Prometheus scrapes `api:/metrics`, node-exporter, cadvisor; Uptime-Kuma on public endpoints with Telegram alerting; 8 app-level alert rules.
- 🔴 **No host-level alerts** (disk/memory/container-restart) despite scraping the exporters (§8.1); **no backup-freshness alert** (§8.2).

---

## Documentation Freshness Audit (Phase 6)

| Doc | Status | Finding |
|-----|--------|---------|
| **README.md** | ⚠️ Mostly current | Has Docker/Cloudflare deploy instructions; does not foreground the 19-container home-server reality or the `mightguy.my.id` subdomains. |
| **CHANGELOG.md** | 🔴 **Stale** | Top entry is still "Custom Learning Roadmaps (2026-06-14)". **No entry for the IDR `parseIdrInput` wiring fix** (commits `9b591ef`/`37caf8d`/`24993ca`) — the most important recent change — or the home-server infra maturation. Violates Invariant 5 (documented rationale). |
| **PROJECT_STATE.md** | ⚠️ Likely current to V9 | 111 KB living doc; should gain the IDR-fix + infra sections. |
| **CLAUDE.md** | ⚠️ Partial | Lists `parseIdrInput` as an import ([:67](../../CLAUDE.md#L67)) but does **not mandate** it for money forms in the "DO NOT DO" rules — the convention that just got fixed isn't codified to prevent regression. |
| **POLYMATHOS_SUMMARY.md** | 🔴 **Inaccurate** | Excellent runbook, but the **"100% backup coverage" claim is false** (§5.3); also `gitea:latest` (compose pins 1.22), "Node.js 18+" (Dockerfile uses 22), `gcr.io/cadvisor` image-name typo. |
| **ROADMAP_FORWARD.md** | ⚠️ Not re-verified | Confirm status table reflects the IDR fix + infra phases. |
| **ARCHITECTURE / RUNBOOK / SECURITY / CONTRIBUTING** | ⚠️ Carried | Re-confirm SECURITY's AI-egress section + the dual-lens resolution. |

---

## The Six Invariants Check (Phase 7)

| # | Invariant | V10 Status | Evidence |
|---|-----------|------------|----------|
| 1 | Data in PostgreSQL, open formats, **fully exportable** | ⚠️ **Partial** | All data in Postgres (survives `pg_dump`), but `/api/export` omits roadmaps (019) + habits (018) — [export.js:48-86](../../server/routes/export.js#L48). |
| 2 | route→model→SQL & component→hook→API spine | ✅ | Verified across finance forms, roadmaps, export. |
| 3 | Additive evolution — never rewrite core | ✅ | IDR fix changed call sites, not core; 23 migrations additive. |
| 4 | `user_id` scoping on every query | ✅ | Universal; integrity test asserts every FK `ON DELETE CASCADE`. |
| 5 | Documented rationale for major decisions | ⚠️ **Weakened** | **CHANGELOG has no IDR-fix or infra entry**; dual 50-Year Lens persists. |
| 6 | `pg_dump` + source = complete rebuild (git clean) | ✅ / ⚠️ | `git status` clean ✅; but compose now couples to host `/mnt/data` + 4 `external` volumes — *app* rebuilds from source, *full stack* depends on host state. |

**Four hold cleanly; Invariants 1 and 5 are weakened (export omission; undocumented IDR fix). Invariant 6 holds for the app, with a noted full-stack caveat.** Not the clean sweep V9 recorded — the regressions are documentation/operational, not structural.

---

## V9 → V10 Remediation Ledger (Phase 4 of brief)

| V9 Finding | V9 Priority | Status | Evidence |
|------------|-------------|--------|----------|
| §15.1 — Money fields use `Number()` not `parseIdrInput` | **Critical** | ✅ **CLOSED** | All 6 forms call `parseIdrInput`; `"50.000"`→50000 verified by execution. |
| §15.1 — Account balance coerces invalid→0 silently | **High** | 🟠 **Improved** | Dot-grouped now parses correctly; only true garbage hits `\|\| 0` (no inline error). |
| §6.1 — Test suite validates a benched function | **Critical** | ✅ **CLOSED** | Forms now call `parseIdrInput`, so property/fuzz test the production path. |
| §11.1 — Dead `parseIdrInput`/`formatIdrInput` | **High** | 🟢 **Mostly closed** | `parseIdrInput` now live in 6 forms; `formatIdrInput` still display-only-unused. |
| §6.2 — Heavy suites not in CI | Medium | 🟢 **Mostly closed** | property + fuzz + integrity now in CI; visual/smoke/mutation still opt-in/absent. |
| §1.1 — `npm audit` regression (2 moderate) | Medium | ❌ **Worsened** | Now 6 vulns/1 high (server) + 2 high (client); **breaks the CI gate**. |
| §10.1 — New roadmap pages not a11y-audited | Medium | ❌ **Recurred** | `a11y.spec.js` still has 0 roadmap entries. |
| §11.2 — Dual 50-Year Lens documents | Medium | ❌ **Not closed** | Both files present. |
| §11.3 — Commented dead code in `api.js` | Low | ❌ **Not closed** | Block still present (lines 19-23). |
| §5.1 — CI OpenAPI gate counts script not spec | Low | ❌ **Not closed** | `grep -c addPath(`, threshold ≥75. |
| (V9 flag) — Roadmaps in export bundle? | — | ❌ **Confirmed missing** | `fetchAll` omits roadmaps + habits. |

**Score: 2 Criticals + the headline High closed; 2 improved; the carried Lows/Mediums unmoved; npm audit worsened.** The cycle paid its two biggest debts and accrued one new operational one (CI-red).

---

## Cross-Cutting Themes (Phase 8)

**1. The eight-audit methodology gap finally closed — by fixing the code, not the test.** V9's deepest insight was that no audit ever ran the real input path. V10 confirms the path is now correct *and* the tests sit on the live function — but the closure came from wiring `parseIdrInput` into the forms (which made the existing tests meaningful), not from adding the form-fill test V9 asked for. The lesson half-learned: the *code* is right and the *tests* now point at it, but the **boundary between the `<input>` element and the parser is still untested.** Add that one test and the gap is closed structurally, not just incidentally.

**2. Auditing infrastructure for the first time moved the risk frontier from the input boundary to the operational boundary.** Through V9, every weakness was "will the data going in be correct?" That is now yes. V10's new weaknesses are all operational: a backup that covers 44% while claiming 100%, a CI gate that's red, five unbounded core containers, a weak public-facing default password, alerts that don't cover the failures this hardware will actually hit (disk, OOM, backup silence). The architecture is 50-year-grade; the **operations are early-days.** This is the natural and healthy next frontier — but it is a frontier.

**3. The most dangerous artifact in V10 is a documentation claim, not a code defect.** "Backup coverage: 100% — every piece of user-generated data" is the single most consequential false statement in the repo. An operator who reads it will not check, will not fix the script, and will discover on the day Vaultwarden's disk dies that the vault was never in a snapshot. Documentation that overstates a safety net is more dangerous than no documentation — it manufactures false confidence exactly where confidence must be earned. (This mirrors V9's "loudly-tested dead code" theme: the failure mode is *misplaced trust*, and it recurs.)

**4. The same person who built a textbook additive-evolution backend also shipped a backup script with a missing backslash — and that's the story of solo infrastructure.** The application code is disciplined, convention-following, and tested. The shell scripts that hold the whole thing up are where the entropy lives: a dropped `\`, an omitted backup path, a `changeme123` default. For a single maintainer, the leverage is not more features — it's a 20-line CI lint of the deploy scripts (`shellcheck`) and a backup-freshness alert. Small operational guardrails would catch exactly the class of bug that the application's guardrails already prevent.

**5. CI is the canary, and it's about to stop singing.** The pipeline is genuinely mature — real Postgres, integrity, property, fuzz, coverage floor, e2e. But `npm audit --audit-level=high` will fail the next run, and a red CI that's "expected to be red" quickly becomes a CI nobody reads. The discipline that made CI valuable (it gates merges) is the same discipline that now blocks the merge to fix it. `npm audit fix` is a five-minute task that protects the entire downstream investment.

**6. The system finally embodies its thesis — which raises the bar for honesty.** Polymath OS is no longer an app that *talks* about 50-year sovereignty; it *runs* it, on a Rp-7,000/month laptop with zero open ports and a tested restore for its own data. That achievement is real and rare. But embodying the thesis means the gaps now have teeth: a sovereignty system whose backup silently drops the password vault isn't sovereign — it's exposed. The project earned the right to be judged by its own standard, and by that standard the backup must cover what it claims.

---

## The Complete Score Journey (Phase 9) — V1 → V10

| Audit | Headline | Basis | Note |
|-------|----------|-------|------|
| V1 | 6.4 | early | foundation |
| V2 | 7.5 | | |
| V3 | 7.7 | | |
| V4 | 7.6 | blended | |
| V5 | 8.2 | blended | |
| V6 | 8.4 | blended (13-dim) | |
| V7 | 8.6 | blended (13-dim) | product wave (PMF +0.7) |
| V8 | 8.7 | blended (14-dim) | cleanup; §14 introduced; dirty tree (Critical) |
| V9 | 8.7 | blended (15-dim) | feature + cleanup; §15 introduced (7.5); clean tree |
| **V10** | **8.8** | **blended (15-dim)** | **IDR bug FIXED (§15 7.5→8.7); first infra audit; CI-red + backup bugs surfaced; technical 8.8, 14-dim 8.8** |

On the V8/V9 basis (14-dim), V10 is **8.8 (flat)** — the application's §15 gains are absorbed by the newly-visible infra/security regressions. The 15-dim blended rises **+0.1 to 8.8** on the §15 fix.

---

## Final Verdict (Phase 10)

1. **Production-ready AND user-ready?** **Yes to both, for the first time.** Production-ready: clean tree, complete contract, tested constraints, deployed with monitoring + tested app-DB restore. User-ready: the money-input bug that made the *finance* app store wrong numbers is fixed and verified — an Indonesian user typing `50.000` now stores `50000`.

2. **Are all money input fields now correctly handling IDR format?** **Yes — verified by execution across all six fields.** `"50.000"` → 50000, `"1.500.000"` → 1500000, garbage → NaN with inline errors (modals) or revert (inline cells). One residual: Account opening balance silently maps true-garbage `NaN` → 0 (Medium).

3. **Is the test suite validating the real production code path?** **Yes, finally — by construction.** The forms call `parseIdrInput`, so the 10K-iteration property suite + fuzz suite now test exactly what runs. The only missing piece is a test that drives the `<input>` element itself (Medium).

4. **Is the Docker/infrastructure configuration production-grade?** **Mostly — with two must-fix defects.** Strong: pgvector, healthchecks, restart policies, non-root, scrubbed images, pinned tags, full monitoring, documented runbook. Must-fix: the **backup script covers 4 of 9 stores** (and the doc claims 100%), the **`restic forget` line-continuation crash** silences the success alert, **five core containers lack `mem_limit`**, and **Grafana has a weak public default password**.

5. **Are all Six Invariants holding?** **Four cleanly; two weakened.** Invariant 1 (export omits roadmaps+habits) and Invariant 5 (CHANGELOG omits the IDR fix + infra) are weakened; Invariant 6 holds for the app with a full-stack-couples-to-host caveat.

6. **What documentation needs updating?** CHANGELOG (add the IDR fix + infra), POLYMATHOS_SUMMARY (correct the "100% coverage" claim + stale versions), CLAUDE.md (mandate `parseIdrInput` for money forms), resolve the dual lens. See Phase 11.

7. **Single most important thing to protect?** **Still the integer in every money column — and now, the backup that is supposed to preserve it.** The app DB *is* backed up and restore-tested; protect that property by fixing the script before the next service joins the unbacked set.

8. **Single most impactful next step?** **Fix the offsite backup script** (`restic-backup.sh`): add the five missing paths, repair the `restic forget` `\`, and add a backup-freshness alert. It is Effort-S and it converts a false "100% coverage" into a true one — protecting the password vault and restoring the failure signal. (Closely tied second: `npm audit fix` to unbreak CI.)

9. **Is the Foundation Era complete?** **The application's Foundation Era: yes — its defining bug is closed and verified.** The *infrastructure's* Foundation Era is one operational sprint away: backup script, CI, container limits, Grafana password. Fix those four (all Effort-S) and the complete system is foundation-complete.

10. **Confidence (1–10) that no silent data-corruption bug reaches production?** **8.5/10** (V9: 6/10). The known, demonstrated corruption (`"50.000"` → 50) is gone, verified by execution; the forms call the correct function; the tests sit on that function and run in CI. Capped below 9.5 by: the missing `<input>`-level test, the Account-balance silent-→0 edge, the UTC "today" date edge, and — for the *broader* data — the backup that silently under-covers. **For Polymath OS's own money/data, confidence is ~9; the 8.5 reflects the residual edges and the operational backup risk.**

---

## Documentation Update Recommendations (Phase 11)

| File | Issue | Recommendation |
|------|-------|----------------|
| `deploy/scripts/restic-backup.sh` | 4-of-9 coverage; `restic forget` crash | Add `/data/vaultwarden`, `/data/miniflux-db`, `/data/wallabag`, `/data/nextcloud`, `/data/nextcloud-db` to `restic backup`; add the missing `\` after `--tag homelab`. |
| `docs/POLYMATHOS_SUMMARY.md` | "100% backup coverage" is false; stale versions | Correct to actual coverage (or fix the script first, then it becomes true); fix `gitea:latest`→`1.22`, "Node.js 18+"→22, `gcr.io/cadvisor` typo. |
| `CHANGELOG.md` | No entry for the IDR fix or home-server infra | Add an `[Unreleased]` entry documenting the `parseIdrInput` wiring (the V9-Critical fix) and the Phase 1–5 infrastructure (Invariant 5). |
| `.env.docker.example` | `GRAFANA_PASSWORD` missing | Add it with a generate-it note so operators don't ship `changeme123`. |
| `.github/workflows/ci.yml` | OpenAPI gate counts script not spec; stale ≥75 | Parse `docs/openapi.json` `Object.keys(paths).length`. |
| `CLAUDE.md` | parseIdrInput not mandated for money forms | Add to "DO NOT DO": "Do NOT submit money fields via `Number()` — always `parseIdrInput`." |
| `deploy/prometheus/alert_rules.yml` | No host/backup alerts | Add disk-full, memory-pressure, container-restart, and backup-freshness rules. |
| `docs/audit/50_YEAR_LENS-deepseek.md` | Dual constitution | Merge into `50_YEAR_LENS.md` and delete the duplicate. |
| `client/src/lib/api.js` | Dead commented `axios.create` block | Delete (lines 19-23). |
| `client/e2e/a11y.spec.js` | Roadmap pages uncovered | Add `/roadmaps` + seeded `/roadmaps/:id` to `PAGES_TO_CHECK`. |
| `server/routes/export.js` | Export omits roadmaps + habits | Add the three roadmap tables + `habit_logs` to `fetchAll` (Invariant 1). |

---

## Appendix — Evidence Index

- **Money fix (the headline):** `parseIdrInput` called in `CreateTransactionModal.jsx:127,150`, `LedgerModal.jsx:64,77`, `PortfolioModal.jsx:63-64,78-79`, `Accounts.jsx:45`, `Budget.jsx:30,37`, `Portfolio.jsx:34,41`. `Number(form.…)` now only `account_id`/`dest_account_id`/`category_id`/`quantity`/`priority`/`progress`. Live `node`: `parseIdrInput("50.000")===50000`, `("1.500.000")===1500000`, `("5e10")===NaN`, `("--50000")===NaN`, `("Rp 50.000")===50000`.
- **Gates (2026-06-16):** server `npm test` 46 passed/38 skipped; client `npm test` 71; property 58; fuzz 5; `openapi` 108 paths; `addPath` 165; build main 265.95 KB/84.35 KB gzip; Playwright 128/4 files; `git status` clean; LINKABLE_TYPES 24==24 deep-equal `true`. **Server `npm audit` 6 vulns (5 mod, 1 high `form-data`); client `npm audit` 2 high (`form-data`, `vite`).**
- **Infra:** `docker-compose.yml` 19 services, `mem_limit` absent on db/api/nginx/db_backup/cloudflared, Grafana `:-changeme123` (L140); `restic-backup.sh` backs up 4 paths (L22-25), 5 more mounted (compose L196-200), `restic forget` missing `\` (L36); `backup.sh` pg_dump nightly + 7-day retention; CI `npm audit --audit-level=high` (ci.yml L49,106), `test:integrity` (L83), `test:property`/`test:fuzz` (L121-126), OpenAPI gate `grep -c addPath(` ≥75 (L61).
- **Invariant gaps:** `export.js:48-86` exports 10 modules, omits roadmaps (019) + habits (018); CHANGELOG top = "Custom Learning Roadmaps (2026-06-14)", no IDR/infra entry; `50_YEAR_LENS{,-deepseek}.md` both present; `api.js:19-23` dead block; `a11y.spec.js` 17 pages, 0 roadmap.
- **Carried-strong:** session config `index.js:132` (httpOnly/secure-prod/sameSite-lax/7d), helmet+HSTS, dual rateLimit; integrity test 9 checks in CI; pgvector; restore test `postgres_backups ✓` (June 16).

---

*Audit V10 complete. The application's founding bug is dead and verified. The infrastructure is real, ambitious, and one operational sprint — backup script, CI, container limits, Grafana password — from matching the code's discipline. Fix the four Effort-S operational defects, then begin Phase 2 (Agentic AI) on a foundation that is correct going in and survivable going out.*
