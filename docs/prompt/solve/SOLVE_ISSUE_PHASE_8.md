# Phase 8: Backend Resilience — Export, Upload, Attachments, Date Validation — Rafli's Productivity Suite

**Status:** Pending
**Priority:** Medium
**Estimated Effort:** M (30–90 min)
**Audit References:** AUDIT_REPORT_V2.md §3, §4, §9
**Date Generated:** 2026-06-10

---

## Objective

Harden four backend failure paths that survive into V2: an unbounded `/export` that loads up to 100,000 rows into memory and pretty-prints them; an upload that writes bytes to disk *before* verifying entry ownership (disk-churn DoS + swallowed cleanup errors); an attachment `DELETE` that still trusts a host-coupled absolute `file_path`; and month/year input that is range-checked at the route but silently dropped (rather than rejected) and not self-defended in the model.

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` ("Existing Backend Routes & Models" → Research, Finance)
- [ ] Read `server/routes/research.js`, `server/models/research.model.js` (attachment functions), `server/routes/finances.js`, `server/models/finance.model.js`
- [ ] Read `server/routes/engineer.js` for the existing `requireOwnedProject` middleware pattern to mirror in Fix 2
- [ ] Confirm each issue still exists in the current codebase
- [ ] Ensure you are on the latest `main` branch with a clean working tree

---

## Fix 1: Cap and de-pretty-print `/api/research/export`

### Criticality
🟡 **MEDIUM — §3 Backend (Medium; High if any account grows large)**

### What the Audit Found

> `/export` still streams up to 100,000 rows into memory and `JSON.stringify(rows, null, 2)`'s them. A large account, or a few concurrent exports, can pin the API container's heap. The general limiter (100/min) does not stop a single expensive request. … Cap at a sane maximum (e.g. 10,000) and return `413` past it … Drop the `null, 2` pretty-print for exports. — *Priority: Medium*

### Current Behavior

[server/routes/research.js:201-235](../server/routes/research.js#L201):

```js
// Export all matching rows, not just one page.
const opts = { ...parseListOpts(req.query), page: 1, per_page: 100000 };   // line 209
const { rows } = await listResearchEntries(req.user.id, opts);

if (format === 'json') {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="research-export.json"');
  return res.send(JSON.stringify(rows, null, 2));                          // line 215 — pretty-print
}
```

`per_page: 100000` plus `JSON.stringify(rows, null, 2)` materializes and indents the entire result set in memory. There is no upper bound returned to the client — it just silently caps at 100k.

### Desired Behavior

- A hard ceiling of `10000` rows. Define `EXPORT_MAX = 10000`.
- Before serializing, if the user's filtered result set **exceeds** the cap, return `413 Payload Too Large` with a clear message telling them to narrow the filters.
- Drop the pretty-print: `JSON.stringify(rows)` (no `null, 2`).
- CSV path unchanged except it shares the same cap/413 guard.

### Files to Modify

- `server/routes/research.js` — add the cap, the 413 guard, and remove the pretty-print.

### Implementation

#### Step 1: Add the cap + 413 guard, drop pretty-print

`listResearchEntries` already returns `{ rows, total }` (the route uses `total` elsewhere). Use `total` to decide whether the unfiltered count exceeds the cap, and fetch at most `EXPORT_MAX` rows. Replace [server/routes/research.js:208-216](../server/routes/research.js#L208):

```js
// Phase 8: bound export memory. Cap at EXPORT_MAX rows; reject larger result
// sets with 413 so a single request can't pin the container heap.
const EXPORT_MAX = 10000;
const opts = { ...parseListOpts(req.query), page: 1, per_page: EXPORT_MAX };
const { rows, total } = await listResearchEntries(req.user.id, opts);

if (total > EXPORT_MAX) {
  return next(new AppError(
    `Export too large: ${total} entries match (max ${EXPORT_MAX}). Narrow the filters (type, topic, date range, or search) and try again.`,
    413, 'PAYLOAD_TOO_LARGE'
  ));
}

if (format === 'json') {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="research-export.json"');
  return res.send(JSON.stringify(rows)); // Phase 8: no pretty-print — halves payload + heap
}
```

Leave the CSV block ([research.js:218-231](../server/routes/research.js#L218)) as-is; it now runs only when `total <= EXPORT_MAX` because the guard above returns first.

Confirm `AppError` is already imported in this file — it is ([research.js:18](../server/routes/research.js#L18)). Confirm the error handler maps a custom `413` correctly: `errorHandler.js` echoes `err.statusCode` for non-500s, so `413` with code `PAYLOAD_TOO_LARGE` and the message is surfaced verbatim.

### Verification

1. Export with a normal account: `GET /api/research/export?format=json` (authenticated) → `200`, body is valid minified JSON (no indentation), `Content-Disposition: attachment`.
2. Force the cap: temporarily set `EXPORT_MAX = 1` and create 2+ entries, then export → `413` with `{ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Export too large: 2 entries match (max 1)…' } }`. Restore `10000`.
3. CSV path: `?format=csv` → `200`, `Content-Type: text/csv`, unchanged columns.

### Risk / Regression Notes

⚠️ `listResearchEntries` must return an accurate `total` for the filtered set (it does — the list route already trusts `total` for pagination meta). If `total` reflected only the page, the guard would never fire — confirm by exporting an account with >1 page of entries and checking `total` matches the true count.
⚠️ The client Export dropdown uses `window.open(...)` (a GET in a new tab). A `413` will render as a JSON error page in that tab rather than downloading — acceptable, but note it so the frontend can later surface a toast if desired.

---

## Fix 2: Verify entry ownership BEFORE the upload touches disk

### Criticality
🟡 **MEDIUM — §3 / §9 Backend & Resilience**

### What the Audit Found

> Multer writes the upload to disk before ownership is verified. The file lands on disk, *then* `getResearchEntryById` checks ownership, *then* an orphan is `fs.rm`'d via a fire-and-forget callback whose errors are swallowed. A flood of POSTs to a non-owned `:id` churns the disk … Verify entry ownership in a middleware that runs **before** `upload.single('file')` … Make the cleanup `await fs.promises.rm(...)` and log failures. — *Priority: Medium*

### Current Behavior

[server/routes/research.js:514-546](../server/routes/research.js#L514): `upload.single('file')` runs first (writing bytes to disk), and only inside the **second** handler is ownership checked, after which an orphan is removed fire-and-forget:

```js
router.post('/:id/attachments', (req, res, next) => {
  upload.single('file')(req, res, (err) => { /* … multer runs, file already on disk … */ });
}, async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  const entry = await getResearchEntryById(id, req.user.id);
  if (!entry) {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {}); // swallowed errors
    return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
  }
  // …
});
```

A flood of POSTs to entry IDs the caller doesn't own writes-then-deletes files repeatedly; cleanup failures are invisible.

### Desired Behavior

- Ownership is checked **before** `upload.single('file')` runs, so unauthorized requests never write a byte.
- The ownership result is reused (no double query) by stashing the entry on `req`.
- Any orphan cleanup that still occurs (e.g. a later failure) is `await`ed and logs on failure rather than swallowing it.

### Files to Modify

- `server/routes/research.js` — add a `requireOwnedEntry` middleware; reorder it before `upload.single`; convert cleanup to awaited `fs.promises.rm` with logging.

### Implementation

#### Step 1: Add a pre-upload ownership middleware

Add near the other helpers in [server/routes/research.js](../server/routes/research.js#L152) (after `parseListOpts`). This mirrors the `requireOwnedProject` pattern already used in [server/routes/engineer.js](../server/routes/engineer.js):

```js
// Phase 8: verify entry ownership BEFORE multer writes anything to disk, so a
// flood of uploads to non-owned :id values never churns the filesystem. Stash
// the entry on req so the POST handler doesn't re-query.
async function requireOwnedEntry(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getResearchEntryById(id, req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    req.ownedEntry = entry;
    next();
  } catch (err) {
    next(err);
  }
}
```

#### Step 2: Reorder the upload route and harden cleanup

Replace the whole `POST /:id/attachments` handler ([research.js:513-546](../server/routes/research.js#L513)) with:

```js
// POST /api/research/:id/attachments  → single-file upload
// Phase 8: requireOwnedEntry runs FIRST (no disk write for unauthorized callers),
// then multer, then persist. Any post-write failure cleans up with an awaited rm.
router.post('/:id/attachments', requireOwnedEntry, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File exceeds the 10 MB limit.', 400, 'VALIDATION_ERROR', 'file'));
      }
      return next(err); // AppError from fileFilter, or anything else
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded.', 400, 'VALIDATION_ERROR', 'file'));

    const attachment = await createAttachment(req.ownedEntry.id, {
      filename:      req.file.filename,
      original_name: req.file.originalname,
      file_path:     req.file.path,
      mime_type:     req.file.mimetype,
      size:          req.file.size,
    });
    res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    // Phase 8: the row insert failed but the file is on disk — clean up, awaited + logged.
    if (req.file) {
      try {
        await fs.promises.rm(req.file.path, { force: true });
      } catch (rmErr) {
        (req.log ?? logger).error({ err: rmErr, path: req.file.path }, 'Failed to clean up orphaned upload');
      }
    }
    next(err);
  }
});
```

Add the logger import at the top of `research.js` if not already present:

```js
import { logger } from '../lib/logger.js'; // Phase 8: log awaited orphan cleanup failures
```

Why this approach: ownership is now a precondition, so unauthorized requests are rejected before multer ever opens a file handle — the disk-churn vector is closed. The successful path no longer re-queries the entry (`req.ownedEntry` is reused). The only remaining cleanup is for the genuinely rare case where the file wrote but the metadata insert threw; that path is `await`ed and logged, not swallowed.

### Verification

1. **Unauthorized upload writes nothing:** as user A, `POST /api/research/<id-owned-by-B>/attachments` with a file → `404`, and `ls server/uploads/` shows **no new file** (before the fix, a file appeared then was removed).
2. **Happy path:** as the owner, upload a `.txt` → `201`, file present in `server/uploads/`, row in `research_attachments`.
3. **Oversize:** upload an 11 MB file → `400 VALIDATION_ERROR` "File exceeds the 10 MB limit."
4. **Cleanup-on-insert-failure (optional):** temporarily make `createAttachment` throw → upload returns `500` and `server/uploads/` has no orphan; a "Failed to clean up orphaned upload" log line appears only if `rm` itself fails.

### Risk / Regression Notes

⚠️ `requireOwnedEntry` must run **before** the multer middleware in the route's middleware array — verify the order is `requireOwnedEntry, (multer wrapper), async handler`. If multer is first, the fix does nothing.
⚠️ The successful handler now reads `req.ownedEntry.id` instead of re-parsing `:id` — confirm `createAttachment` receives the correct entry id (verification step 2).
⚠️ `fs.promises` is available via the existing `import fs from 'node:fs'`. Confirm the import is the default `fs` (it is — [research.js:12](../server/routes/research.js#L12)).

---

## Fix 3: Make attachment `DELETE` reconstruct the path from `filename`

### Criticality
🟡 **MEDIUM — §4 Database / §3 Backend**

### What the Audit Found

> `research_attachments.file_path` still stores an absolute disk path, and the attachment `DELETE` handler trusts it directly: `fs.rm(attachment.file_path, …)`. The *download* route was correctly fixed to reconstruct the path from `uploadsDir + filename`, but DELETE was not — so the two paths are inconsistent and DELETE breaks on any host/mount migration. … Store only `filename`; reconstruct in DELETE exactly as the download route does (`path.join(uploadsDir, attachment.filename)`). — *Priority: Medium*

### Current Behavior

The **download** route reconstructs safely ([research.js:359](../server/routes/research.js#L359)):

```js
const filePath = path.join(uploadsDir, attachment.filename); // safe — never trusts stored path
```

But **DELETE** trusts the stored absolute path ([research.js:387](../server/routes/research.js#L387)):

```js
// Remove the file from disk first (best effort), then the metadata row.
fs.rm(attachment.file_path, { force: true }, () => {});   // host-coupled; swallowed errors
await deleteAttachment(attId);
```

`getAttachmentById` returns the full row (`SELECT *` — [research.model.js:580-586](../server/models/research.model.js#L580)), so both `filename` and the legacy `file_path` are available. On any host/mount change, `file_path` is stale and DELETE silently fails to remove the file (orphaned bytes accumulate).

### Desired Behavior

- DELETE reconstructs the path the same way download does: `path.join(uploadsDir, attachment.filename)`.
- The file removal is `await`ed and logs on failure (consistent with Fix 2), instead of fire-and-forget.
- Behavior is host-independent: moving the uploads volume to a new mount does not break deletion.

### Files to Modify

- `server/routes/research.js` — change the DELETE handler's file removal to use `filename`.

### Implementation

#### Step 1: Reconstruct the path and await the removal

Replace [server/routes/research.js:386-388](../server/routes/research.js#L386):

```js
// Remove the file from disk first (best effort), then the metadata row.
fs.rm(attachment.file_path, { force: true }, () => {});
await deleteAttachment(attId);
```

with:

```js
// Phase 8: reconstruct the path from filename (matches the download route) —
// never trust the stored absolute file_path, which breaks on a host/mount move.
const filePath = path.join(uploadsDir, attachment.filename);
try {
  await fs.promises.rm(filePath, { force: true });
} catch (rmErr) {
  (req.log ?? logger).error({ err: rmErr, path: filePath }, 'Failed to remove attachment file');
}
await deleteAttachment(attId);
```

`path`, `fs`, `uploadsDir`, and `logger` (added in Fix 2) are all in scope. The metadata row is still removed even if the file removal fails (the row is the source of truth; a missing file is a no-op with `force: true`).

> **Optional, recommended for full closure of §4:** stop storing the absolute path going forward. `research_attachments.file_path` is `NOT NULL`-free in shape but the model passes it; you may keep writing `file_path` for backward compatibility, or add a migration `006_attachment_filename_only.sql` that backfills `file_path = filename` for existing rows. The minimal, low-risk fix above makes DELETE host-independent without a schema change; the migration is only needed if you want to drop the column entirely. Do the minimal fix now; defer the column removal.

### Verification

1. Upload an attachment, then `DELETE /api/research/attachments/:id` → `200`, the file is gone from `server/uploads/`, and the row is gone from `research_attachments`.
2. Host-move simulation: upload a file, then manually edit its `file_path` column to a bogus absolute path (`/nonexistent/x.txt`), then DELETE → still `200`, the **real** file (resolved via `filename`) is removed, no error surfaces to the client.
3. Cross-check consistency: confirm DELETE and download now both resolve via `path.join(uploadsDir, attachment.filename)` (grep for `attachment.file_path` in `research.js` → **no matches** remain).

### Risk / Regression Notes

⚠️ After this change, `attachment.file_path` is no longer read anywhere in `research.js` — grep to confirm. It is still written by `createAttachment` (harmless legacy column).
⚠️ `force: true` means deleting an already-missing file is not an error; the catch only logs genuine `rm` failures (permissions, etc.). The metadata row is removed regardless, which is correct.

---

## Fix 4: Reject out-of-range month/year with 400 (and self-defend the model)

### Criticality
🟡 **MEDIUM (audit filed Low) — §9 Edge Cases & Resilience**

### What the Audit Found

> Month/year range is not consistently validated. `listTransactions` guards `Number.isInteger(month/year)` but not the 1–12 range; `make_date` will throw on month 13, surfacing as a 500 rather than a clean 400. … Centralize a `parseMonthYear` that rejects out-of-range with 400; use it in every list/summary/budget caller. — *Priority: Low*

### Current Behavior — verified, with a nuance the audit understated

The route layer **already** has a range-validating helper, [server/routes/finances.js:33-38](../server/routes/finances.js#L33):

```js
function parseMonthYear(req) {
  const month = parseInt(req.query.month, 10);
  const year  = parseInt(req.query.year, 10);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year) && year >= 1900;
  return valid ? { month, year } : {};   // ← invalid input silently becomes {}
}
```

It is used by the transactions list ([finances.js:283](../server/routes/finances.js#L283)), `getSummary` ([finances.js:130](../server/routes/finances.js#L130)), and `listBudgets` ([finances.js:258](../server/routes/finances.js#L258)). So the **500-on-month-13** the audit describes is **not reachable through the HTTP API today** — an out-of-range month is silently dropped to `{}`, and the endpoint returns *all-time* data with a `200`. Two real residual problems remain:

1. **Silent wrong answer:** `?month=13` returns all-time results instead of an error — a confusing, undocumented behavior (the user thinks they filtered to a month).
2. **Model is not self-defending:** `listTransactions` ([finance.model.js:252](../server/models/finance.model.js#L252)), `getSummary` ([finance.model.js:382](../server/models/finance.model.js#L382)), and `listBudgets` ([finance.model.js:714-715](../server/models/finance.model.js#L714)) each only check `Number.isInteger`. A future caller (a script, a new route, a test) passing `month: 13` directly to the model **does** hit `make_date` → 500.

### Desired Behavior

- `parseMonthYear` distinguishes **absent** (no `month`/`year` → `{}`, all-time, fine) from **present-but-invalid** (`?month=13`, `?month=0`, `?year=abc` → explicit `400 VALIDATION_ERROR`).
- The model functions defend themselves: an out-of-range month passed directly throws a clean `AppError(400)` rather than letting `make_date` 500.

### Files to Modify

- `server/routes/finances.js` — make `parseMonthYear` reject present-but-invalid input with 400.
- `server/models/finance.model.js` — add a shared range check used by `listTransactions`, `getSummary`, `listBudgets`.

### Implementation

#### Step 1: Reject present-but-invalid month/year at the route

Replace [server/routes/finances.js:33-38](../server/routes/finances.js#L33):

```js
/**
 * Parse ?month & ?year query params into integers.
 * Phase 8: absent → {} (all-time). Present-but-invalid (e.g. month=13, month=0,
 * year=abc, or only one of the two) → throw 400 instead of silently returning
 * all-time data, which looked like a successful filter to the user.
 */
function parseMonthYear(req) {
  const hasMonth = req.query.month !== undefined && req.query.month !== '';
  const hasYear  = req.query.year  !== undefined && req.query.year  !== '';
  if (!hasMonth && !hasYear) return {}; // neither supplied → all-time

  const month = parseInt(req.query.month, 10);
  const year  = parseInt(req.query.year, 10);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12
             && Number.isInteger(year)  && year >= 1900;
  if (!valid) {
    throw new AppError('month must be 1–12 and year must be a 4-digit year (both required together).',
      400, 'VALIDATION_ERROR', 'month');
  }
  return { month, year };
}
```

Confirm `AppError` is imported in `finances.js` (it is — used at [finances.js:293](../server/routes/finances.js#L293)). Each caller (`getSummary`, `listBudgets`, transactions list) already runs inside a `try/catch … next(err)`, so the thrown `AppError` flows to the error handler as a clean 400.

#### Step 2: Self-defend the model functions

In [server/models/finance.model.js](../server/models/finance.model.js), add a tiny guard near the top (after imports) and call it wherever month/year is consumed:

```js
// Phase 8: defensive range check so a direct model caller (script/test/new route)
// passing an out-of-range month can never reach make_date() and 500.
function assertMonthYear(month, year) {
  if (month === undefined && year === undefined) return;
  const ok = Number.isInteger(month) && month >= 1 && month <= 12
          && Number.isInteger(year)  && year >= 1900;
  if (!ok) throw new AppError('Invalid month/year.', 400, 'VALIDATION_ERROR', 'month');
}
```

Then in `listTransactions` ([line 252](../server/models/finance.model.js#L252)), `getSummary` ([line 382](../server/models/finance.model.js#L382)), and `listBudgets` ([line 711](../server/models/finance.model.js#L711)), call `assertMonthYear(month, year)` **before** the `Number.isInteger(month) && Number.isInteger(year)` branch. Example for `listTransactions`:

```js
export async function listTransactions(userId, opts = {}) {
  const { month, year, type, categoryId, accountId, search, page = 1, perPage = 50 } = opts;
  assertMonthYear(month, year); // Phase 8: clean 400 instead of make_date 500

  const conditions = ['t.user_id = $1'];
  // … unchanged …
```

Confirm `AppError` is imported in `finance.model.js`; if not, add `import { AppError } from '../lib/AppError.js';`.

### Verification

1. `GET /api/finances?month=13&year=2026` → `400` `{ error: { code: 'VALIDATION_ERROR', message: 'month must be 1–12…' } }` (before: `200` with all-time data).
2. `GET /api/finances?month=6&year=2026` → `200`, correctly scoped to June 2026.
3. `GET /api/finances` (no month/year) → `200`, all-time data (unchanged).
4. `GET /api/finances/summary?month=0&year=2026` and `GET /api/finances/budgets?month=13&year=2026` → both `400`.
5. Model self-defense: in a node REPL/test, `listTransactions(1, { month: 13, year: 2026 })` → rejects with a 400 `AppError`, **not** a `make_date` 500.

### Risk / Regression Notes

⚠️ **Behavior change (intentional):** previously `?month=13` returned all-time data with `200`; it now returns `400`. This is the correct fix but is technically a contract change — confirm no client code relies on the old silent-ignore behavior. The Finance UI uses a `<select>` of months 1–12, so it never sends out-of-range values; the change only affects hand-crafted/buggy requests.
⚠️ Requiring **both** month and year together (one without the other → 400) matches the existing `make_date($2,$3,1)` SQL, which needs both. Confirm the Finance UI always sends both (it does — `MonthYearSelector` is a single control).
⚠️ Keep the model guard tolerant of the all-absent case (`return` early) so all-time queries still work.

---

## Completion Checklist

- [ ] All files modified as specified (`server/routes/research.js`, `server/routes/finances.js`, `server/models/finance.model.js`)
- [ ] All verifications pass
- [ ] `npm test` passes in `server/` (update any test that asserted the old silent-ignore month behavior, if present)
- [ ] `npm run build` succeeds in `client/`
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] Grep confirms `attachment.file_path` is no longer read in `research.js`
- [ ] No new console errors in the API logs during a manual upload→download→delete cycle
- [ ] Changes committed with a descriptive message: `fix: phase 8 — cap export, pre-upload ownership, host-independent attachment delete, strict month/year`
