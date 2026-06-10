# Phase 9: DevOps — Sentry, Env Parameterization, Server Lint, CI — Rafli's Productivity Suite

**Status:** Pending
**Priority:** Medium
**Estimated Effort:** M (30–90 min)
**Audit References:** AUDIT_REPORT_V2.md §6-N1, §6, §1
**Date Generated:** 2026-06-10

---

## Objective

Make the Docker deployment match its own documentation and CI actually exercise the server. Five fixes: wire (or honestly disable) client Sentry in Docker (build arg + CSP) and stop `SECURITY.md` overclaiming it; parameterize `CLIENT_ORIGIN`/`VITE_API_URL` out of tracked files; add a real ESLint config + `lint` script to the server and stop CI silently skipping it; give the server CI job a real Postgres service; and remove the stray `hehe.md` audit-prompt file from the repo root.

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` ("Deployment") and `README.md` (deployment + env tables)
- [ ] Read `client/Dockerfile`, `docker-compose.yml`, `client/nginx.docker.conf`, `client/src/main.jsx`, `.env.docker.example`, `SECURITY.md`, `.github/workflows/ci.yml`, `server/package.json`
- [ ] Confirm each issue still exists in the current codebase
- [ ] Ensure you are on the latest `main` branch with a clean working tree

---

## Fix 1: Wire client Sentry in Docker — build arg + CSP — and correct SECURITY.md

### Criticality
🟡 **MEDIUM — §6-N1 DevOps & Deployment (+ §1 Documentation)**

### What the Audit Found

> Client Sentry is effectively dead in the Docker build — two independent failures. (a) The client `Dockerfile` only accepts `ARG VITE_API_URL` (no `VITE_SENTRY_DSN`), so `import.meta.env.VITE_SENTRY_DSN` is `undefined` at build time and `Sentry.init` never runs. (b) Even if it were set, the nginx CSP `connect-src 'self'` would block the browser from POSTing events to `ingest.sentry.io`. … Add `ARG VITE_SENTRY_DSN` + `ENV …`, pass it as a build arg from compose, and add the Sentry ingest host to the CSP `connect-src`. — *Priority: Medium*

### Current Behavior

- [client/Dockerfile:4-5](../client/Dockerfile#L4) declares only `VITE_API_URL`:
  ```dockerfile
  ARG VITE_API_URL=https://raflitriwijaya.my.id
  ENV VITE_API_URL=$VITE_API_URL
  ```
  So at `npm run build`, `import.meta.env.VITE_SENTRY_DSN` is `undefined` and [client/src/main.jsx:13](../client/src/main.jsx#L13) (`if (import.meta.env.VITE_SENTRY_DSN) Sentry.init(...)`) never runs.
- [client/nginx.docker.conf:13](../client/nginx.docker.conf#L13) sets `connect-src 'self'`, which blocks the browser from POSTing to `*.ingest.sentry.io` even if the DSN were present.
- [SECURITY.md:49](../SECURITY.md#L49) claims "Error reporting: Sentry initialized before render" with no caveat.

### Desired Behavior

- The client image accepts `VITE_SENTRY_DSN` as a build arg, passed from compose, so a configured DSN actually compiles into the bundle.
- The nginx CSP allows `connect-src` to the Sentry ingest host so events can be sent.
- `SECURITY.md` states client Sentry requires build-arg configuration and is disabled by default.

### Files to Modify

- `client/Dockerfile` — add `ARG`/`ENV VITE_SENTRY_DSN`.
- `docker-compose.yml` — pass `VITE_SENTRY_DSN` (and `VITE_API_URL`, see Fix 2) as build args to `nginx`.
- `client/nginx.docker.conf` — extend CSP `connect-src` with the Sentry ingest host.
- `SECURITY.md` — annotate the client Sentry claim.

### Implementation

#### Step 1: Accept the DSN as a build arg in the client image

In [client/Dockerfile](../client/Dockerfile#L4), after the existing `VITE_API_URL` lines, add:

```dockerfile
# Phase 9: accept the Sentry DSN at build time so Sentry.init actually compiles in.
# Empty by default → main.jsx's `if (VITE_SENTRY_DSN)` guard keeps it a no-op.
ARG VITE_SENTRY_DSN=
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
```

#### Step 2: Pass the build args from compose

In [docker-compose.yml](../docker-compose.yml#L40), change the `nginx` service `build` from the shorthand string to the long form so it can pass args (this also sets up Fix 2):

```yaml
  nginx:
    build:
      context: ./client
      args:
        # Phase 9 / Fix 2: parameterized out of the Dockerfile so staging/other domains work.
        VITE_API_URL: ${VITE_API_URL:-https://raflitriwijaya.my.id}
        VITE_SENTRY_DSN: ${VITE_SENTRY_DSN:-}
    ports:
      - "80:80"
    # … rest unchanged …
```

#### Step 3: Allow the Sentry ingest host in the nginx CSP

In [client/nginx.docker.conf:13](../client/nginx.docker.conf#L13), change `connect-src 'self'` to include the Sentry ingest wildcard:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.ingest.sentry.io; frame-ancestors 'none';" always;
```

#### Step 4: Correct the SECURITY.md claim

In [SECURITY.md:49](../SECURITY.md#L49), change the client "Error reporting" row to:

```markdown
| Error reporting | Sentry initialized before render **when `VITE_SENTRY_DSN` is supplied as a Docker build arg** (disabled by default; the nginx CSP `connect-src` allows `https://*.ingest.sentry.io`) |
```

### Verification

1. Build with a dummy DSN: `docker compose build --build-arg VITE_SENTRY_DSN=https://abc@o0.ingest.sentry.io/0 nginx` → succeeds.
2. Inspect the built bundle for the DSN host: `docker run --rm $(docker compose images -q nginx) grep -rl "ingest.sentry.io" /usr/share/nginx/html/assets || true` → present when the DSN was passed; absent when not (build without the arg).
3. `curl -sI http://localhost/ | grep -i content-security-policy` → the `connect-src` now lists `https://*.ingest.sentry.io`.
4. Build **without** the arg (default): `docker compose build nginx` → succeeds, `Sentry.init` stays a no-op (no DSN), no console errors.

### Risk / Regression Notes

⚠️ Widening CSP `connect-src` is the minimum necessary (`https://*.ingest.sentry.io` only). Do not add `'unsafe-*'` or broad wildcards.
⚠️ `VITE_SENTRY_DSN` empty must remain valid — the `main.jsx` guard already no-ops on empty, so a default build is unaffected.
⚠️ If you would rather **not** ship client Sentry, the alternative is to remove the `main.jsx` Sentry block and the `@sentry/react` dep and state "client error reporting unavailable in Docker" in `SECURITY.md`. Pick one; do not leave it half-wired.

---

## Fix 2: Parameterize `CLIENT_ORIGIN` and `VITE_API_URL` out of tracked files

### Criticality
🟡 **MEDIUM — §6 DevOps & Deployment**

### What the Audit Found

> `CLIENT_ORIGIN` is hardcoded to `https://raflitriwijaya.my.id` and `VITE_API_URL` is hardcoded in the client `Dockerfile`. The compose stack is not reusable for staging or any other domain without editing tracked files. … Move both into `.env`/build args … Extend `.env.docker.example`. — *Priority: Medium*

### Current Behavior

- [docker-compose.yml:21](../docker-compose.yml#L21): `CLIENT_ORIGIN: https://raflitriwijaya.my.id` (literal).
- [client/Dockerfile:4](../client/Dockerfile#L4): `ARG VITE_API_URL=https://raflitriwijaya.my.id` (literal default, never overridden because compose used the `build: ./client` shorthand).

Staging or any other domain requires editing tracked files.

### Desired Behavior

Both values come from `.env` (with the production domain as a sensible default), so a new environment is a `.env` change only — no tracked-file edits.

### Files to Modify

- `docker-compose.yml` — make `CLIENT_ORIGIN` an env interpolation; pass `VITE_API_URL` as a build arg (the `build.args` long form added in Fix 1 Step 2).
- `.env.docker.example` — document `CLIENT_ORIGIN` and `VITE_API_URL`.

### Implementation

#### Step 1: Interpolate `CLIENT_ORIGIN` in the api service

In [docker-compose.yml:21](../docker-compose.yml#L21):

```yaml
      # Phase 9: parameterized so staging/other domains don't require editing this file.
      CLIENT_ORIGIN: ${CLIENT_ORIGIN:-https://raflitriwijaya.my.id}
```

#### Step 2: Pass `VITE_API_URL` as a build arg

Already added in Fix 1 Step 2 (`build.args.VITE_API_URL: ${VITE_API_URL:-https://raflitriwijaya.my.id}`). If you are doing Fix 2 without Fix 1, apply that `build:` long-form block now.

#### Step 3: Document both in `.env.docker.example`

Append to [.env.docker.example](../.env.docker.example):

```bash
# Phase 9: deployment domain (defaults to the production domain when unset).
# Set these for staging or any other origin without editing docker-compose.yml.
CLIENT_ORIGIN=https://raflitriwijaya.my.id   # the browser origin the API allows via CORS
VITE_API_URL=https://raflitriwijaya.my.id    # baked into the client bundle at build time
```

### Verification

1. `CLIENT_ORIGIN=https://staging.example.com docker compose config` → the resolved config shows `CLIENT_ORIGIN: https://staging.example.com` for `api` (env override works).
2. Default (no override): `docker compose config` → shows the production domain default for both `CLIENT_ORIGIN` and the `nginx` build arg `VITE_API_URL`.
3. `docker compose build nginx` with `VITE_API_URL=https://staging.example.com` set → the built bundle's API base reflects staging (grep the bundle for the host, as in Fix 1 verification).

### Risk / Regression Notes

⚠️ The `:-default` syntax preserves the current production behavior when `.env` omits the vars — confirm a no-`.env` `docker compose config` still resolves to `raflitriwijaya.my.id`.
⚠️ `VITE_API_URL` is a **build-time** arg (baked into the static bundle), not a runtime env — changing it requires a rebuild of `nginx`, not just a restart. Note this in the deploy docs.

---

## Fix 3: Add a server ESLint config + `lint` script; stop CI silently skipping it

### Criticality
🟡 **MEDIUM — §6 / §7**

### What the Audit Found

> The server job … runs `npm run lint --if-present`, but `server/package.json` has **no `lint` script**, so server linting is silently skipped. Server code ships unlinted. … Add an ESLint config + `lint` script to `server/` and drop `--if-present`. — *Priority: Medium*

### Current Behavior

- [server/package.json:10-16](../server/package.json#L10) has `dev`, `start`, `migrate`, `test`, `openapi` — **no `lint`**.
- [.github/workflows/ci.yml:32-33](../.github/workflows/ci.yml#L32) runs `npm run lint --if-present`, which is a silent no-op for the server.

### Desired Behavior

- The server has a flat ESLint config tuned for Node ESM + vitest globals.
- `npm run lint` exists in `server/package.json` and fails on errors.
- CI runs `npm run lint` (no `--if-present`) for the server.

### Files to Modify

- `server/eslint.config.js` (new) — flat config for Node ESM.
- `server/package.json` — add `lint` script and `eslint` devDependency.
- `.github/workflows/ci.yml` — drop `--if-present` from the server lint step.

### Implementation

#### Step 1: Install ESLint in the server package

```bash
cd server && npm install -D eslint @eslint/js globals
```

#### Step 2: Add a flat ESLint config

Create `server/eslint.config.js`:

```js
// Phase 9: server lint config. Flat config (ESLint 9+), Node ESM + vitest globals.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off', // pino is used, but migrate.js/scripts may log
    },
  },
  {
    // Test files get vitest + node globals.
    files: ['test/**/*.js', '**/*.test.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    ignores: ['node_modules/', 'uploads/', 'coverage/'],
  },
];
```

#### Step 3: Add the `lint` script

In [server/package.json:10-16](../server/package.json#L10), add to `scripts`:

```json
    "lint": "eslint . --max-warnings 0",
```

#### Step 4: Run it and fix what it finds

```bash
cd server && npm run lint
```

Fix any real errors it reports (likely a handful of unused vars — prefix intentionally-unused params with `_`, matching the existing `// eslint-disable-next-line no-unused-vars` in `errorHandler.js`). The goal is a clean pass at `--max-warnings 0`. Document any genuinely-needed disables inline.

#### Step 5: Drop `--if-present` in CI

In [.github/workflows/ci.yml:32-33](../.github/workflows/ci.yml#L32):

```yaml
      - name: Lint
        run: npm run lint
```

### Verification

1. `cd server && npm run lint` → exits `0` with no warnings (after fixing reported issues).
2. Introduce a deliberate unused variable, re-run → lint **fails** (proves it's no longer a silent skip).
3. Push a branch → the server CI job's Lint step runs `eslint` (visible in the Actions log), not a skip.

### Risk / Regression Notes

⚠️ `js.configs.recommended` may flag pre-existing issues. Fix them minimally (unused vars, undefined globals); do not restyle working code. If a rule is too noisy for this codebase, downgrade that specific rule with a comment — do not disable linting wholesale.
⚠️ ESLint 9 flat config requires `eslint.config.js` (not `.eslintrc`). The server is ESM (`"type": "module"`), so the config uses `import` — correct.

---

## Fix 4: Give the server CI job a real Postgres service

### Criticality
🟡 **MEDIUM — §6 / §7**

### What the Audit Found

> CI never runs the server against a real Postgres … the server job has no `services: postgres` … Add a `postgres:16` service to the server job and at least one true integration test (see §7). — *Priority: Medium*

### Current Behavior

[.github/workflows/ci.yml:10-37](../.github/workflows/ci.yml#L10) — the server job has no `services:` block and runs only DB-mocked unit tests. There is no `DATABASE_URL` for an integration suite to use.

### Desired Behavior

- The server CI job runs a `postgres:16` service container with a healthcheck.
- `DATABASE_URL`/`SESSION_SECRET` are exported to the test step so the Phase 10 integration suite (added next) can run migrations and exercise a real DB.
- The existing mocked unit tests keep working unchanged.

### Files to Modify

- `.github/workflows/ci.yml` — add a `postgres` service + env to the server job.

### Implementation

#### Step 1: Add the service and test-env

Update the server job in [.github/workflows/ci.yml](../.github/workflows/ci.yml#L10):

```yaml
  server:
    name: Server — lint, audit, test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: server
    # Phase 9: real Postgres so integration tests (Phase 10) run against a true DB.
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: productivity
          POSTGRES_PASSWORD: ci_test_password
          POSTGRES_DB: productivity_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U productivity -d productivity_test"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      # Phase 9: consumed by the Phase 10 integration suite; mocked unit tests ignore it.
      DATABASE_URL: postgresql://productivity:ci_test_password@localhost:5432/productivity_test
      SESSION_SECRET: ci_test_session_secret_at_least_32_chars_long
      CLIENT_ORIGIN: http://localhost:5173
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Security audit
        run: npm audit --audit-level=high
      - name: Lint
        run: npm run lint
      # Phase 9: run migrations against the CI Postgres before the test suite.
      - name: Migrate test DB
        run: npm run migrate
      - name: Tests
        run: npm test
```

Why this approach: GitHub Actions service containers expose Postgres on `localhost:5432` to the job steps. `DATABASE_URL` points there; the mocked unit tests `vi.mock('../lib/db.js')` and never touch it, so they are unaffected, while the Phase 10 integration suite uses it. Running `npm run migrate` first gives the integration tests a fully-migrated schema.

### Verification

1. Push a branch → the server job shows a `postgres` service starting and passing its healthcheck, then "Migrate test DB" applies all migrations, then "Tests" runs.
2. The mocked unit tests (auth, finance.math, ownership, settle.atomicity, upload.filter) still pass unchanged.
3. `npm run migrate` against the CI DB exits `0` (the Phase 7 `002` guard is a no-op on the empty CI DB).

### Risk / Regression Notes

⚠️ Until Phase 10 adds an integration suite, this service is "ready but unused" — that's fine; it must be in place before/with Phase 10. If Phase 10 is done first or together, ensure its test files read `process.env.DATABASE_URL`.
⚠️ `npm run migrate` requires `DATABASE_URL` at job level (set above). If the migrate step fails in CI, check the service healthcheck passed first (the `--health-*` options gate readiness).

---

## Fix 5: Remove the stray `hehe.md` audit-prompt file

### Criticality
🟡 **MEDIUM (audit filed Low) — §1 Project Planning & Documentation**

### What the Audit Found

> `hehe.md` in the repo root is the raw audit *prompt* … committed as a tracked file. It is noise that will confuse any contributor and pollutes the repo root. … `git rm hehe.md`. If a prompt archive is wanted, move it under `docs/prompt/`. — *Priority: Low*

### Current Behavior

`hehe.md` is a tracked file in the repo root (it appears as modified in `git status`). The existing remediation prompts already live under `docs/prompt/SOLVE_ISSUE_PHASE_1.md … 5.md`, so the root file is redundant noise.

### Desired Behavior

`hehe.md` no longer sits in the repo root. Either deleted, or moved under `docs/prompt/` alongside the existing phase prompts if a prompt archive is wanted.

### Files to Modify

- `hehe.md` — remove from repo root (or move to `docs/prompt/`).

### Implementation

#### Step 1: Move it to the prompt archive (preferred — preserves history)

```bash
cd d:/project-productivity
git mv hehe.md docs/prompt/AUDIT_PROMPT_ARCHIVE.md
```

> If the file has unstaged modifications (it shows as `M` in `git status`), commit or discard them first so `git mv` is clean. If you would rather not keep it at all, use `git rm hehe.md` instead.

### Verification

1. `ls hehe.md` → "No such file" (root is clean).
2. `git status` → shows the rename (`hehe.md` → `docs/prompt/AUDIT_PROMPT_ARCHIVE.md`) or the deletion.
3. Repo root no longer lists `hehe.md` (`git ls-files | grep -i hehe` → only the new path, or nothing if deleted).

### Risk / Regression Notes

⚠️ Confirm nothing references `hehe.md` by path (`git grep -n "hehe.md"` → no source references). It's a prompt artifact, so there should be none.
⚠️ Decide delete-vs-archive deliberately and state it in the commit message; don't leave both a root copy and an archived copy.

---

## Completion Checklist

- [ ] All files modified as specified
- [ ] All verifications pass
- [ ] `npm run build` succeeds in `client/`; `docker compose build` succeeds with and without the Sentry/API build args
- [ ] `npm run lint` passes in **both** `client/` and `server/` (server lint now exists and is clean)
- [ ] `npm test` passes in both packages
- [ ] `docker compose config` resolves cleanly with default and overridden `CLIENT_ORIGIN`/`VITE_API_URL`
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] `hehe.md` no longer in repo root
- [ ] Changes committed with a descriptive message: `fix: phase 9 — wire client Sentry in Docker, parameterize env, server lint, CI postgres, drop hehe.md`
