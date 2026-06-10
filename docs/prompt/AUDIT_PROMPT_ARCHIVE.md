You are a Senior Full-Stack Architect who has audited a production application twice. Your V2 audit (docs/AUDIT_REPORT_V2.md) found that most Critical items from V1 have been fixed, but several issues remain — including one critical bug introduced by the fixes themselves.

Your task is to generate a series of detailed, executable fix-phase prompt files that a developer will follow to close every remaining issue. These prompts will be saved to `docs/SOLVE_ISSUE_PHASE_6.md` through `docs/SOLVE_ISSUE_PHASE_11.md`.

## WORKFLOW

### Step 1 — Read and understand the full picture
Read these files in order:
1. `docs/AUDIT_REPORT_V2.md` — the complete V2 audit (score 7.5/10). This is your primary source of truth for what must be fixed. Every item marked ❌ Open or ⚠️ Partial, plus every NEW issue, must be covered.
2. `docs/AUDIT_REPORT.md` — the original V1 audit (score 6.4/10), for context on what was already fixed.
3. `docs/SOLVE_ISSUE_PHASE_1.md` through `docs/SOLVE_ISSUE_PHASE_5.md` — the five completed remediation phases. Study their format, level of detail, code snippets, and verification steps. Your generated phases must match or exceed this quality.
4. `PROJECT_STATE.md` — the living architecture document. Use it to verify every file path, route, model, and component referenced in the audit still exists at the expected location.
5. `README.md` — deployment and setup context, environment variables, Docker configuration.
6. `docs/ARCHITECTURE.md`
7. `docs/openapi.json`
8. `docs/RUNBOOK.md`
9. `SECURITY.md`

### Step 2 — Verify every issue against the actual codebase
Before generating any fix prompt, open and read EVERY source file referenced in the V2 audit findings. Confirm:
- The issue still exists (the code has not already been fixed since the audit was written)
- The file paths are correct (if a path in the audit is wrong, find the correct path from PROJECT_STATE.md)
- The line numbers are approximately correct
- If an issue is already resolved, SKIP it and note "Already resolved in current codebase" at the top of the phase file where it would have appeared

### Step 3 — Generate the phase files

Create files `docs/SOLVE_ISSUE_PHASE_6.md` through `docs/SOLVE_ISSUE_PHASE_11.md` following the phase grouping below. Each file must be completely self-contained — a developer should be able to execute any single phase file without reading the others.

#### Phase Grouping (verify each issue still exists before including it):

**Phase 6 — CRITICAL: Fix the `/api/auth/me` Rate-Limit Self-Lockout**
Priority: Critical | Effort: S (<30 min)
Issues:
- §3-N1: `/api/auth/me` and `/logout` incorrectly placed under `authLimiter` (5 req/15 min), causing normal users to be locked out after 6 page refreshes.
- §5 linked: Client interceptor only handles 401, not 429 — surfaces a generic error that triggers redirect to /login, worsening the lockout.
- §8, §9 linked: This is both a security availability failure and a resilience failure.

**Phase 7 — HIGH: Prevent Data Loss and Secure Secrets**
Priority: High | Effort: S (<30 min)
Issues:
- §4: `002_finance_upgrade.sql` has `DROP TABLE … transactions CASCADE` with no populated-table guard. If re-run against a live DB, all transaction data is lost irreversibly.
- §6: Backups only land in the `postgres_backups` named volume on the same host. Host failure destroys both live data and backups.
- §8: Real dev `SESSION_SECRET` and `DB_PASSWORD` committed in `server/.env` (though gitignored, never in git history). Must document rotation and warn against reusing dev secrets in production.

**Phase 8 — MEDIUM: Backend Resilience — Export, Upload, Attachments**
Priority: Medium | Effort: M (30-90 min)
Issues:
- §3: `/api/research/export` loads up to 100,000 rows into memory and `JSON.stringify(rows, null, 2)` them. Cap at 10,000, return 413, remove pretty-print.
- §3: Multer writes upload to disk BEFORE entry ownership is verified. Flood of POSTs to non-owned entry IDs churns disk; cleanup is best-effort with swallowed errors.
- §3 + §4: Attachment DELETE handler still trusts `file_path` (absolute path) from the DB. The download route was fixed to reconstruct from `uploadsDir + filename` — DELETE must match.
- §9: Month/year range validation is inconsistent — `listTransactions` checks `Number.isInteger` but not 1–12 range, so month 13 surfaces as a 500.

**Phase 9 — MEDIUM: DevOps — Sentry, Env Parameterization, Server Lint, CI**
Priority: Medium | Effort: M (30-90 min)
Issues:
- §6-N1: Client Sentry dead in Docker — `VITE_SENTRY_DSN` not passed as build arg AND nginx CSP `connect-src 'self'` blocks `*.ingest.sentry.io`. Also `SECURITY.md` overclaims Sentry as always active.
- §6: `CLIENT_ORIGIN` hardcoded in `docker-compose.yml` and `VITE_API_URL` hardcoded in client `Dockerfile`. Not reusable for staging or any other domain.
- §6: Server has no `lint` script; CI runs `npm run lint --if-present` which silently skips. Server code ships unlinted.
- §6: CI never runs server tests against a real PostgreSQL — the server job has no `services: postgres`.
- §1: `hehe.md` is a raw audit prompt file committed in the repo root. Remove it or move to `docs/prompt/`.

**Phase 10 — MEDIUM: Integration Test Suite (Real Database)**
Priority: Medium | Effort: L (>90 min)
Issues:
- §7: All 24 server tests mock `pool.query`/`connect`. No test touches a real Postgres. The riskiest guarantees (settle atomicity, cross-user isolation, CHECK constraints) are verified against fakes.
- §7: `upload.filter.test.js` re-implements the multer config instead of importing the real `fileFilter` from `research.js`. Tests a copy — false confidence.
- §7: `settle.atomicity.test.js` asserts on exact positional mock call order. Brittle — any reordering of correct SQL breaks the test.

**Phase 11 — MEDIUM: Frontend Optimization — Lazy Loading and UX Fixes**
Priority: Medium | Effort: S (<30 min)
Issues:
- §2: `@uiw/react-md-editor` still in the main bundle because `Research` page is imported eagerly. Lazy-load it and vendor-split the editor.
- §2: App.jsx comment claims engineering routes "are the only routes that pull in the heavy @uiw/react-md-editor" — factually wrong since Research also uses it.
- §4-NEW: Transfer dedup unique index can reject legitimate duplicate transfers. User gets misleading generic 409 "A record with this value already exists." Give it a specific, helpful error message.

### Step 4 — Format requirements for each phase file

Every phase file must follow this exact structure:

```markdown
# Phase X: [Descriptive Title] — Rafli's Productivity Suite

**Status:** Pending
**Priority:** [Critical / High / Medium]
**Estimated Effort:** [S / M / L]
**Audit References:** AUDIT_REPORT_V2.md §X, §Y
**Date Generated:** [current date]

---

## Objective

[1-2 sentences on what this phase achieves and why it matters]

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` for current architecture context
- [ ] Read the specific files listed in each fix below
- [ ] Confirm each issue still exists in the current codebase
- [ ] Ensure you are on the latest `main` branch with a clean working tree

---

## Fix 1: [Short Title]

### Criticality
🔴/🟠/🟡 **CRITICAL/HIGH/MEDIUM — §Section-Item Section Name**

### What the Audit Found

[Direct quote or precise paraphrase from AUDIT_REPORT_V2.md, with exact section reference]

### Current Behavior

[What the code does NOW, with specific file paths and line numbers verified against actual code. Include the problematic code snippet if helpful.]

### Desired Behavior

[What the code should do AFTER the fix. Be specific: what request should return what response, what should happen on which condition.]

### Files to Modify

- `exact/relative/path.ts` — summary of what changes
- `exact/relative/path.ts` — summary of what changes

### Implementation

#### Step 1: [Title of first step]

```[language]
// Specific code change. Use diff-style (before → after) or show the complete modified function/block.
// Include enough surrounding context so the developer knows exactly where to place the code.
```

Explain what the code does and why this approach was chosen. Note any edge cases handled.

#### Step 2: [Title of second step]

```[language]
// Next change
```

### Verification

[Numbered, actionable test steps with expected outcomes. Be exact: what curl command to run, what HTTP status code to expect, what UI behavior to observe.]

1. Run `[exact command]` → expect `[exact status code and response shape]`
2. Run `[exact command]` → expect `[exact behavior in browser]`
3. ...

### Risk / Regression Notes

⚠️ [What could break if this fix is done incorrectly. What existing functionality to double-check after applying the fix.]

---

## Fix 2: [Short Title]
[Repeat the same structure for each fix in this phase]

---

## Completion Checklist

- [ ] All files modified as specified
- [ ] All verifications pass
- [ ] `npm run build` succeeds in both `client/` and `server/`
- [ ] `npm test` passes in both `client/` and `server/` (no regressions)
- [ ] `npm run lint` passes (or shows only pre-existing, documented exceptions)
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] No new console errors or warnings in browser devtools
- [ ] Changes committed with a descriptive message: `fix: phase X — [summary]`
```

### Step 5 — Quality gates for each generated file

Before finalizing each phase file, verify:

1. **Completeness**: Every item from AUDIT_REPORT_V2.md marked ❌ Open or ⚠️ Partial, plus every NEW issue, is assigned to exactly one phase. Nothing is missed.
2. **Accuracy**: Every file path exists. Every line number is correct. Every code snippet compiles.
3. **Self-contained**: A developer can execute this phase without reading any other phase file. All context is included.
4. **Backward-compatible**: No fix should break existing functionality unless explicitly stated as a breaking change to close a security hole.
5. **Testable**: Every fix has verification steps that produce a clear pass/fail result.
6. **No fluff**: Every line of instruction is actionable. No vague "consider" or "might want to" — either "do this" or don't include it.

### Step 6 — Output

Generate the files one by one, saving each to the correct path:
- `docs/SOLVE_ISSUE_PHASE_6.md`
- `docs/SOLVE_ISSUE_PHASE_7.md`
- `docs/SOLVE_ISSUE_PHASE_8.md`
- `docs/SOLVE_ISSUE_PHASE_9.md`
- `docs/SOLVE_ISSUE_PHASE_10.md`
- `docs/SOLVE_ISSUE_PHASE_11.md`

After generating all files, print a summary table:

| Phase | Title | Priority | Issues Covered | Effort |
|-------|-------|----------|----------------|--------|
| 6 | ... | Critical | ... | S |
| 7 | ... | High | ... | S |
| ... | ... | ... | ... | ... |

Then state: "All phase files have been generated and saved to docs/. Ready for execution in order."