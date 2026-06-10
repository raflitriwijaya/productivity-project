# Phase 11: Frontend Optimization — Lazy Loading and UX Fixes — Rafli's Productivity Suite

**Status:** Pending
**Priority:** Medium
**Estimated Effort:** S (<30 min)
**Audit References:** AUDIT_REPORT_V2.md §2, §4-NEW
**Date Generated:** 2026-06-10

---

## Objective

Pull `@uiw/react-md-editor` out of the main bundle by lazy-loading the `Research` page and vendor-splitting the editor; correct the App.jsx code comment that falsely claims only the Engineering routes pull in the editor; and replace the misleading generic 409 ("A record with this value already exists.") that a legitimate duplicate transfer triggers with a specific, helpful message.

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` ("client/src/App.jsx", Research components, "Pending / Known Issues")
- [ ] Read `client/src/App.jsx`, `client/vite.config.js`, `server/middleware/errorHandler.js`, `server/db/migrations/005_idempotency_guards.sql`
- [ ] Confirm each issue still exists in the current codebase
- [ ] Ensure you are on the latest `main` branch with a clean working tree

---

## Fix 1: Lazy-load `Research` and vendor-split the markdown editor

### Criticality
🟡 **MEDIUM — §2 Frontend (React + Vite + Tailwind)**

### What the Audit Found

> `@uiw/react-md-editor` still ships in the main bundle. App.jsx comments that the Engineering routes "are the only routes that pull in the heavy `@uiw/react-md-editor`", but `Research` is imported **eagerly** and pulls the editor via `CreateResearchModal` and `EntryDetailModal`. The lazy `EngineerDocs` chunk is only 7 KB — proof the editor is already resident in the 304 KB main chunk. … `React.lazy()` the `Research` page … Add `build.rollupOptions.output.manualChunks` to vendor-split `@uiw/react-md-editor`. — *Priority: Medium*

### Current Behavior

- [client/src/App.jsx:16](../client/src/App.jsx#L16) imports `Research` **eagerly**: `import Research from './pages/Research';`. Because `Research` renders `CreateResearchModal` and `EntryDetailModal`, both of which import the engineer `MarkdownEditor`/`MarkdownPreview` (which import `@uiw/react-md-editor`), the editor is pulled into the **main** chunk on every page load.
- [client/src/App.jsx:21-24](../client/src/App.jsx#L21) comment claims the Engineering routes "are the only routes that pull in the heavy `@uiw/react-md-editor`" — factually wrong (see Fix 2).
- [client/vite.config.js](../client/vite.config.js) has no `build.rollupOptions.output.manualChunks` — nothing vendor-splits the editor or prism.

### Desired Behavior

- `Research` is `React.lazy`-loaded behind `<Suspense>` (same pattern as the Engineering pages), so `@uiw/react-md-editor` leaves the main chunk and downloads only when `/research` is first visited.
- A `manualChunks` config vendor-splits `@uiw/react-md-editor` (and `prism-react-renderer`) into their own cacheable chunks.
- The main `index-*.js` shrinks measurably (the editor is no longer resident).

### Files to Modify

- `client/src/App.jsx` — convert the `Research` import to `lazy()` and wrap its route in `<Suspense>`.
- `client/vite.config.js` — add `build.rollupOptions.output.manualChunks`.

### Implementation

#### Step 1: Lazy-load `Research` in App.jsx

Remove the eager import at [client/src/App.jsx:16](../client/src/App.jsx#L16):

```js
import Research from './pages/Research';   // ← delete this line
```

Add `Research` to the lazy group near the Engineering lazy imports ([App.jsx:25-31](../client/src/App.jsx#L25)):

```js
// Phase 11: Research is lazy-loaded too — it pulls in @uiw/react-md-editor via
// CreateResearchModal + EntryDetailModal, which otherwise sits in the main chunk.
const Research = lazy(() => import('./pages/Research'));
```

Wrap the `/research` route element in `<Suspense>` ([App.jsx:94](../client/src/App.jsx#L94)):

```jsx
<Route path="/research" element={<Suspense fallback={<PageFallback />}><Research /></Suspense>} />
```

`lazy`, `Suspense`, and `PageFallback` are already in this file ([App.jsx:1](../client/src/App.jsx#L1), [App.jsx:38](../client/src/App.jsx#L38)) — no new imports needed.

#### Step 2: Vendor-split the editor and prism in vite.config.js

Replace [client/vite.config.js](../client/vite.config.js) with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Phase 11: vendor-split the heavy editor/highlighter so they are cached
  // independently and never inflate the main app chunk.
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mdeditor: ['@uiw/react-md-editor'],
          prism: ['prism-react-renderer'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

### Verification

1. `cd client && npm run build` → succeeds. The build output lists a separate `mdeditor-*.js` chunk and a `prism-*.js` chunk.
2. Compare the **main** `index-*.js` size before/after: it should drop noticeably (the editor was ~the bulk of the 304 KB main chunk). Confirm `mdeditor-*.js` is its own file.
3. `npm run dev`, open the app on `/` with devtools Network tab → `mdeditor` chunk is **not** requested on the dashboard; navigate to `/research` → the `mdeditor` chunk now downloads, and the `PageFallback` skeleton shows briefly.
4. `npm run lint` → 0 warnings.

### Risk / Regression Notes

⚠️ `Research` now loads asynchronously — confirm the `<Suspense fallback={<PageFallback />}>` renders inside `<AppLayout>`'s `<Outlet />` so the sidebar stays mounted during the chunk download (it does, because the route is nested under `AppLayout`).
⚠️ If anything else imports `Research` eagerly (e.g. a test or a preloader), lazy-loading it there too or that defeats the split — `git grep "pages/Research"` to confirm App.jsx is the only importer.
⚠️ `manualChunks` listing a package that isn't actually imported would create an empty chunk; both `@uiw/react-md-editor` and `prism-react-renderer` are real deps ([client/package.json:15,18](../client/package.json#L15)) — fine.

---

## Fix 2: Correct the inaccurate App.jsx code comment

### Criticality
🟡 **MEDIUM — §2 Frontend (Documentation accuracy)**

### What the Audit Found

> App.jsx comments that the Engineering routes "are the only routes that pull in the heavy `@uiw/react-md-editor`" … but `Research` is imported eagerly and pulls the editor … the comment is factually wrong. — *Priority: Medium*

### Current Behavior

[client/src/App.jsx:21-24](../client/src/App.jsx#L21):

```js
// Engineering Toolkit pages are code-split: they are the only routes that pull in
// the heavy `@uiw/react-md-editor` (Docs) and `prism-react-renderer` (Snippets,
// Project Detail) dependencies. Lazy-loading keeps those bundles out of the main
// chunk so they download only when an Engineering route is first visited.
```

"the only routes" is false — Research uses the editor too (and after Fix 1 is also lazy-loaded).

### Desired Behavior

The comment accurately states that both the Engineering routes **and** Research are code-split to keep the editor/highlighter out of the main chunk.

### Files to Modify

- `client/src/App.jsx` — rewrite the comment.

### Implementation

#### Step 1: Replace the comment

Change [client/src/App.jsx:21-24](../client/src/App.jsx#L21) to:

```js
// Code-split routes: the Engineering Toolkit pages (Docs editor, Snippets/Project
// Detail highlighter) AND the Research page all pull in the heavy
// `@uiw/react-md-editor` and/or `prism-react-renderer`. Lazy-loading them (Phase 11
// also lazy-loaded Research) keeps those vendor chunks out of the main bundle so
// they download only when one of those routes is first visited.
```

### Verification

1. Read [client/src/App.jsx:21](../client/src/App.jsx#L21) → the comment now names Research alongside the Engineering routes and no longer says "the only routes."
2. `cd client && npm run lint` → 0 warnings (comment-only change).

### Risk / Regression Notes

⚠️ Comment-only change — no runtime impact. Just ensure it stays truthful if routes change later.

---

## Fix 3: Give the transfer-dedup collision a specific, helpful error message

### Criticality
🟡 **MEDIUM — §4-NEW Database / §3 Backend**

### What the Audit Found

> The transfer-dedup unique index can reject legitimate duplicate transfers. `idx_transactions_transfer_dedup` … Two genuinely separate identical transfers on the same day … collide → `23505` → the generic 409 "A record with this value already exists." The user cannot make the second legitimate transfer and gets a misleading message. … catch `23505` with `constraint === 'idx_transactions_transfer_dedup'` and return "Looks like a duplicate transfer — change the description or confirm". — *Priority: Medium*

### Current Behavior

[server/db/migrations/005_idempotency_guards.sql:27-29](../server/db/migrations/005_idempotency_guards.sql#L27) creates `idx_transactions_transfer_dedup` as a partial UNIQUE index. When a second identical Transfer is posted, Postgres raises `23505` with `constraint = 'idx_transactions_transfer_dedup'`. The error handler ([server/middleware/errorHandler.js:11-16](../server/middleware/errorHandler.js#L11)) maps **all** `23505` to the same generic message:

```js
if (err.code === '23505') {
  return res.status(409).json({
    success: false,
    error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
  });
}
```

A user making a second legitimate identical transfer (same day, accounts, amount, blank description) is blocked with an unhelpful message and no guidance on how to proceed.

### Desired Behavior

When the `23505` is specifically on `idx_transactions_transfer_dedup`, return a clear, actionable 409: it looks like a duplicate transfer; add/change the description to record it as a separate entry. Other `23505` conflicts keep the existing generic message.

### Files to Modify

- `server/middleware/errorHandler.js` — branch on `err.constraint` for the transfer-dedup index.

### Implementation

#### Step 1: Add a constraint-specific branch before the generic 23505 mapping

Replace [server/middleware/errorHandler.js:10-16](../server/middleware/errorHandler.js#L10):

```js
  // Phase 2: map pg unique-violation (23505) to a clean 409 for any unique constraint
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
    });
  }
```

with:

```js
  // Phase 2: map pg unique-violation (23505) to a clean 409.
  if (err.code === '23505') {
    // Phase 11: the transfer-dedup index blocks an EXACT-duplicate Transfer. A user
    // may legitimately want a second identical transfer — give an actionable message
    // instead of the generic "already exists", and a distinct code the client can branch on.
    if (err.constraint === 'idx_transactions_transfer_dedup') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_TRANSFER',
          message: 'This looks like a duplicate transfer (same date, accounts, amount, and description). If it is intentional, add or change the description to record it as a separate transfer.',
          field: 'description',
        },
      });
    }
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
    });
  }
```

Why this approach: pg surfaces the violated index/constraint name in `err.constraint`. Matching it lets us give a precise, recoverable message (and a `field: 'description'` hint so the client can focus the description input) while leaving every other unique conflict on the existing generic path. No migration or model change is needed — the index stays as a real double-submit guard.

> **Client polish (optional, recommended):** in `CreateTransactionModal`, when a `POST`/`PATCH` rejects with `error.code === 'DUPLICATE_TRANSFER'`, surface the message as an inline error on the description field rather than a generic toast. The axios interceptor already rejects with the server `message`; if you also expose `error.code` client-side (it's in `error.response.data.error.code`), branch on it. This is a nicety — the server message alone is already clear.

### Verification

1. Post a Transfer, then post an **identical** Transfer (same date, source, dest, amount, blank description) via the API → second returns `409` with `{ error: { code: 'DUPLICATE_TRANSFER', message: 'This looks like a duplicate transfer…', field: 'description' } }` (not the generic message).
2. Post the second transfer again but with a **different description** → `201` (the legitimate path works once disambiguated).
3. Trigger a different unique conflict (e.g. duplicate budget category) → still the generic `CONFLICT` / "A record with this value already exists." (unchanged).
4. `cd server && npm test` → existing tests pass (the generic `23505` mapping is unchanged for non-transfer conflicts).

### Risk / Regression Notes

⚠️ The branch keys on `err.constraint === 'idx_transactions_transfer_dedup'` — the exact index name from `005_idempotency_guards.sql`. If that index is ever renamed, update this string (and vice-versa).
⚠️ The generic `23505` path must remain the fallback so other unique violations (email, budget, account type) keep their existing 409. Verify step 3.
⚠️ Adding `field: 'description'` is additive to the envelope; existing clients that ignore `field` are unaffected.

---

## Completion Checklist

- [ ] All files modified as specified (`client/src/App.jsx`, `client/vite.config.js`, `server/middleware/errorHandler.js`)
- [ ] All verifications pass
- [ ] `npm run build` succeeds in `client/`; build output shows separate `mdeditor-*.js` / `prism-*.js` chunks and a smaller main `index-*.js`
- [ ] `npm test` passes in both `client/` and `server/` (no regressions)
- [ ] `npm run lint` passes in `client/` (`--max-warnings 0`)
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] `/research` shows the `PageFallback` skeleton on first visit and the `mdeditor` chunk is not requested on the dashboard
- [ ] A duplicate transfer returns the new `DUPLICATE_TRANSFER` message; a re-described transfer succeeds
- [ ] Changes committed with a descriptive message: `fix: phase 11 — lazy-load Research + vendor-split editor, correct App comment, specific duplicate-transfer error`
