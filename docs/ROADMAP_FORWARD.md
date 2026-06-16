# Polymath OS — Forward Roadmap (2026–2076)

> **Status:** Living document. Updated as phases complete and priorities evolve.
> **Last updated:** 2026-06-16
> **Current score:** 8.8 blended (15-dim) — see [AUDIT_REPORT_V10.md](../docs/audit/AUDIT_REPORT_V10.md)
> **Foundation era closed:** Waves 1–7 + post-V5 fix-wave + V10 IDR fix + Phase 1–5 infra. All 9/9 quality gates green (npm audit CI gate needs `npm audit fix` — V10 §7.1).

---

## Completed: The Foundation Era (Waves 1–7)

18 modules, 22 cross-module link types, 93 API paths, AI-powered chatbox with SSE streaming, universal export (10-module ZIP), user settings with cross-device persistence, Prometheus monitoring, accessibility-audited (15 pages), pgvector semantic search.

| Wave | Content |
|------|---------|
| 1 | Universal entity links (22 types) |
| 2 | Contacts, Ideas, unified search |
| 3 | Reading tracker, book links, QuickCapture router |
| 4 | Time tracking, Weekly Review, Goals/OKRs, Annual Report |
| 5 | Polymath Dashboard, pgvector semantic search, auto-tag, PWA |
| 6 | Moonshots: pgvector production, dashboard polish |
| 7 | DeepSeek AI Chatbox, SSE streaming |
| Post-V5 | Universal Export, AbortController hardening, `user_settings`, Prometheus config, a11y 7→15 pages, client enums, CI coverage floor + e2e-on-PR, ARCHITECTURE.md |

---

## Phase 1: The Last 10% (2026 Q3–Q4)

Close the remaining V6 gaps. None requires new architecture — these are completions of already-wired substrate.

| # | Item | Type | Priority | Effort | Source |
|---|------|------|----------|--------|--------|
| 1.1 | **Theme cross-device read path** — hydrate from `user_settings` on fresh device | Product | **High** | S | V6 §4.2 |
| 1.2 | **Bundle attachments into export ZIP** — true "everything" export | Product | **High** | M | V6 §13.3 |
| 1.3 | **Web-push reminders** behind existing `notifications_enabled` preference | Product | **High** | M | V6 §13.5 |
| 1.4 | **Habit streaks/calendar** on `goal_type: 'habit'` — streak loop UI | Product | Medium | M | V6 §13.5 |
| 1.5 | **Engineer & Finance workflow consolidation** (sprint board + one-screen finance) | Product | Medium | L | V6 §13.2 |
| 1.6 | **Instrument AI upstream latency** (`chat_upstream_duration_seconds` histogram) | Tech | Medium | M | V6 §8.1 |
| 1.7 | **Feature-flag mechanism** on `user_settings` (per-user toggles for risky rollouts) | Tech | Medium | M | V6 §14.4 |
| 1.8 | **OpenAPI gate parses the spec, not the generator script** | Tech | Low | S | V6 §5.1 |
| 1.9 | **Client coverage floor in CI** (run coverage in the client job, not just the server) | Tech | Medium | S | V6 §6.1 |

**Status tracking:**

| Item | Status |
|------|--------|
| 1.1 Theme cross-device read path | ✅ Done (2026-06-13) |
| 1.2 Attachments in export ZIP | ✅ Done (2026-06-13) |
| 1.3 Web-push reminders | ✅ Done (2026-06-13, v1 — Notification API + polling) |
| 1.4 Habit streaks | ✅ Done (2026-06-13) |
| 1.5 Engineer/Finance consolidation | ✅ Done (2026-06-13) |
| 1.6 AI upstream latency metric | ✅ Done (2026-06-13) |
| 1.7 Feature-flag on user_settings | ⬜ |
| 1.8 OpenAPI gate parses spec, not script | ⬜ |
| 1.9 Client coverage floor in CI | ⬜ |
| 1.10 **Fix IDR money input bug (V9 Critical)** | ✅ Done (2026-06-16) — `parseIdrInput` wired into all 6 money forms; `"50.000"` → 50000 verified by execution |
| 1.11 **Infrastructure — Home Server Phase 1–5** | ✅ Done (2026-06-16) — 19 containers, Cloudflare Zero Trust, Prometheus + Grafana + Uptime Kuma, Restic→R2 backups, restore tested |

---

## Phase 2: Agentic AI (2026 Q4 – 2027 Q1)

The context-injection foundation is built (`chat.model.js` injects 6 entity types, user-scoped). The natural next step is letting the chatbox *act*, not just answer.

| # | Item | Priority | Effort |
|---|------|----------|--------|
| 2.1 | **Tool-calling:** create todo, start timer, draft research entry, create goal from chat | High | L |
| 2.2 | **Confirmation UI** — every action requires user approval before execution | High | M |
| 2.3 | **Multi-step workflows** — "summarize these 3 papers and create a research entry linking all of them" | Medium | L |
| 2.4 | **Model/provider swap** — Ollama local path as alternative to DeepSeek (the `provider` abstraction already supports this) | Low | M |

---

## Phase 3: Multi-Device & Scale (2027)

`user_settings` (migration `016`) is the first step off `localStorage`. This phase makes Polymath OS truly device-independent.

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 3.1 | **R2 object storage migration** for attachments | High | L | RUNBOOK §4 has the migration plan; trigger: multi-device demand |
| 3.2 | **Cross-device attachment access** — presigned URLs from R2 | High | M | Unblocked by 3.1 |
| 3.3 | **Offline-first data** — IndexedDB cache for reads when offline | Medium | L | PWA shell already ships (`dist/sw.js`, 30 precache entries) |

**Decision trigger for 3.1:** The single-node ceiling is documented in ARCHITECTURE.md. Revisit when attachments exceed disk budget or multi-device access is actively needed — not before.

---

## Phase 4: The Decade Ahead (2027–2036)

As the life this system serves evolves, the system evolves with it.

- **Knowledge compounding.** With 10 years of `entity_links`, the graph itself becomes the product — "show me everything connected to this idea across a decade" is a query the 22-type link foundation already supports.
- **Life transitions.** A startup that hires (single-tenant assumption meets its trigger), a research career that accumulates a decade of linked papers (semantic search becomes the primary navigation), a family (shared vs. private data). The additive schema makes these survivable.
- **UI rewrites.** React 19/Vite today; in 20 years it will be something else. The hook→API split and the OpenAPI contract make the UI replaceable without touching the server.
- **Model swaps.** DeepSeek, Ollama, whatever comes next. The `provider` abstraction already supports this; expect to swap models and providers many times.

---

## Phase 5: The Lifetime Vision (2036–2076)

A personal productivity system that serves one person for 50 years is not a product — it's an **externalized memory and second brain that outlives every framework it was built on.**

The bet this architecture makes is the right one: PostgreSQL and open formats will still be readable in 2076; the data matters more than the UI; a documented "why" lets a future maintainer understand a decision made half a century earlier. The UI will be rewritten three or four times. The AI will be unrecognizable. But the `entity_links` graph, the research corpus, the financial ledger, the reading history — exported as JSON, restored from `pg_dump`, rebuilt from source — these are the through-line.

**The job of the next 50 years: never break that through-line, and keep the "why" current.**

---

## The Six Invariants (Never Change)

These are the architectural decisions that earn the §14 score. Treat them as load-bearing walls; everything else is renovation.

1. **Data lives in PostgreSQL, in open formats, fully exportable.** No proprietary stores, no binary formats, no data that can't leave.
2. **route → model → SQL and component → hook → API spine.** Two shapes, applied uniformly — legible to one developer across a lifetime.
3. **Additive evolution.** New capability = new tables + new routers + new pages. The core middleware, error envelope, and auth are *extended*, never *rewritten*.
4. **`user_id` scoping on every query, ownership validated at the API.** The security model that has held across all 7 waves and every new router.
5. **Documented rationale for every major decision.** The "why," not just the "what" — the single most valuable thing for a future maintainer.
6. **`pg_dump` + source = a complete rebuild.** The disaster-recovery contract. Never introduce state that lives only in a running process or a third-party service.

---

## What Should Evolve (Continuously Improved, Never Sacred)

- The AI layer (models, prompts, context injection, providers)
- The frontend framework and build tooling
- The dependency set — caret ranges + lockfile; audit and bump regularly
- The dashboards and reports — these reflect an evolving life
- Storage topology — single-node disk today; R2 when scale or multi-device demands it

---

## Gap Tracking (from AUDIT_REPORT_V6.md)

| Gap | Source | Status |
|-----|--------|--------|
| AI egress in SECURITY.md | V6 §1.1 | ✅ Fixed |
| README reflects 18 modules | V6 §14.3 | ✅ Fixed |
| CONTRIBUTING migration number | V6 §11.1 | ✅ Fixed |
| Theme cross-device read path | V6 §4.2 | ✅ Fixed (2026-06-13) |
| Forward roadmap exists | V6 §12.1 | ✅ This document |
| Attachments in export ZIP | V6 §13.3 | ✅ Done (2026-06-13) |
| Web-push reminders | V6 §13.5 | ✅ Done (2026-06-13, v1) |
| Habit streaks/calendar | V6 §13.5 | ✅ Done (2026-06-13) |
| Engineer/Finance consolidation | V6 §13.2 | ✅ Done (2026-06-13) |
| AI upstream latency metric | V6 §8.1 | ✅ Done (2026-06-13) |
| Feature-flag on user_settings | V6 §14.4 | ⬜ Phase 1.7 |
| OpenAPI gate parses spec | V6 §5.1 | ⬜ Phase 1.8 |
| Client coverage in CI | V6 §6.1 | ⬜ Phase 1.9 |
| Agentic AI (tool-calling) | V6 §8 | ⬜ Phase 2 |
| R2 attachment migration | V6 §14.1 | ⬜ Phase 3 (trigger-gated) |

---

| IDR money input bug (V9 Critical) | V9 §15.1 | ✅ Fixed 2026-06-16 |
| Infrastructure home server Phase 1–5 | V10 §5 | ✅ Done 2026-06-16 |
| Backup script 4-of-9 coverage | V10 §5.3 | ✅ Fixed 2026-06-16 |
| Container mem_limit on core services | V10 §2.1 | ✅ Fixed 2026-06-16 |
| Grafana weak default password | V10 §1.2 | ✅ Fixed (GRAFANA_PASSWORD in .env.docker.example) |
| Host-level Prometheus alerts | V10 §8.1 | ✅ Fixed 2026-06-16 |
| Export omits roadmaps + habits | V10 §5.2 | ✅ Fixed 2026-06-16 |
| Roadmap pages not a11y-audited | V10 §10.1 | ✅ Fixed 2026-06-16 |
| Dual 50-Year Lens documents | V10 §11.2 | ✅ Fixed (archived deepseek variant) |
| Dead code in api.js | V10 §11.4 | ✅ Fixed 2026-06-16 |
| `npm audit` regression (CI red) | V10 §7.1 | ⬜ Run `npm audit fix` in server + client |
| OpenAPI gate parses spec not script | V10 §5.1 | ⬜ Phase 1.8 |
| Client coverage in CI | V10 §6.2 | ⬜ Phase 1.9 |
| Agentic AI (tool-calling) | V10 §— | ⬜ Phase 2 |

---

*Forward roadmap created 2026-06-13, extracted from AUDIT_REPORT_V6.md §8 "The 50-Year Roadmap". Updated 2026-06-16 with V10 completion status.*
