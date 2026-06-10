# Phase 7: Prevent Data Loss and Secure Secrets — Rafli's Productivity Suite

**Status:** Pending
**Priority:** High
**Estimated Effort:** S–M (<30 min for the guard + secret docs; ~30–60 min for off-host backups)
**Audit References:** AUDIT_REPORT_V2.md §4, §6, §8
**Date Generated:** 2026-06-10

---

## Objective

Close the three highest-impact durability/secrecy gaps that survive into V2: (1) the destructive `002` migration can wipe a populated `transactions` ledger with no safety rail, (2) backups live only on the same Docker host as the live data, so one host failure loses both, and (3) a real development `SESSION_SECRET`/DB password sits in `server/.env` and must be treated as compromised before any production use.

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` ("Existing DB Migrations" and "Deployment") and `docs/RUNBOOK.md` (§1–§3)
- [ ] Read `server/db/migrations/002_finance_upgrade.sql`, `docker-compose.yml`, `.env.docker.example`, `server/.env.example`
- [ ] Confirm each issue still exists in the current codebase
- [ ] Ensure you are on the latest `main` branch with a clean working tree
- [ ] **Take a `pg_dump` snapshot of any live database before testing migration changes** (`docs/RUNBOOK.md §1`)

---

## Fix 1: Guard the destructive `002` migration against a populated table

### Criticality
🟠 **HIGH — §4 Database (PostgreSQL)**

### What the Audit Found

> `002_finance_upgrade.sql` still `DROP TABLE … transactions CASCADE` with no populated-table guard. The runner records applied migrations, so a normal flow won't re-run it — but the file is `IF EXISTS`/re-runnable by design, and any operator who clears `schema_migrations`, restores a partial DB, or runs it manually obliterates the ledger. … This is the single largest data-loss risk in the repo. — *Priority: High*

### Current Behavior

[server/db/migrations/002_finance_upgrade.sql:25-32](../server/db/migrations/002_finance_upgrade.sql#L25) drops the ledger tables unconditionally:

```sql
-- ── Drop in dependency order (children before parents) ───────────────────────
DROP TABLE IF EXISTS budgets       CASCADE;
DROP TABLE IF EXISTS portfolio     CASCADE;
DROP TABLE IF EXISTS payables      CASCADE;
DROP TABLE IF EXISTS receivables   CASCADE;
DROP TABLE IF EXISTS transactions  CASCADE;   -- ← obliterates the ledger, no guard
DROP TABLE IF EXISTS categories    CASCADE;
DROP TABLE IF EXISTS accounts      CASCADE;
```

If this file is applied against a DB that already has finance data — because someone cleared `schema_migrations`, restored a partial snapshot, or ran the file by hand — every transaction, receivable, payable, portfolio holding, and budget is destroyed irreversibly. There is no `down` migration.

### Desired Behavior

The migration **refuses to run** (raises a SQL exception, aborting the transaction so nothing is dropped) when `transactions` already exists and contains rows. A genuinely fresh install (no `transactions` table, or an empty one) proceeds normally. The guard is overridable only by a deliberate operator action (truncating the table or dropping it by hand), never by an accidental re-run.

### Files to Modify

- `server/db/migrations/002_finance_upgrade.sql` — add a populated-table guard immediately before the `DROP` block.

### Implementation

#### Step 1: Insert a guard block before the drops

In [server/db/migrations/002_finance_upgrade.sql](../server/db/migrations/002_finance_upgrade.sql#L24), insert the following **between** the `set_updated_at()` function definition (ends at line 23) and the `-- ── Drop in dependency order` comment (line 25):

```sql
-- ── Phase 7: refuse to run against a populated ledger ────────────────────────
-- This migration DROPs `transactions` (and the rest of the finance schema). The
-- runner normally applies each file once, but if schema_migrations is cleared,
-- a partial DB is restored, or the file is run by hand, an unguarded re-run
-- would destroy every ledger row. Abort loudly instead. to_regclass returns NULL
-- when the table does not exist (fresh install), so this is a no-op on first run.
-- To intentionally re-run after a real reset: TRUNCATE transactions first.
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL
     AND (SELECT count(*) FROM transactions) > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop a populated transactions table (% rows). Snapshot with pg_dump and TRUNCATE first if this is intentional. See docs/RUNBOOK.md §2.',
      (SELECT count(*) FROM transactions);
  END IF;
END $$;
```

Why this approach: `RAISE EXCEPTION` inside the migration aborts the wrapping transaction the runner uses ([server/db/migrate.js](../server/db/migrate.js) applies each file in its own transaction), so the `DROP`s never execute and the table is untouched. `to_regclass('public.transactions')` is the safe existence check — it returns `NULL` rather than erroring when the table is absent, so a fresh DB passes straight through. The error message names the row count and points to the runbook, so an operator who *intends* to reset knows the exact escape hatch (`TRUNCATE`).

### Verification

1. **Fresh-install path (must still work):** against an empty database, run `cd server && npm run migrate`. → `002_finance_upgrade` applies cleanly (no `transactions` table exists yet, guard is a no-op).
2. **Guard path (must block):** seed a row, then force a re-apply:
   ```bash
   psql "$DATABASE_URL" -c "INSERT INTO transactions (user_id, type, amount) VALUES (1, 'Income', 100);"
   psql "$DATABASE_URL" -f server/db/migrations/002_finance_upgrade.sql
   ```
   → expect `ERROR: Refusing to drop a populated transactions table (1 rows)…` and the row still present (`SELECT count(*) FROM transactions;` → `1`).
3. **Intentional reset path:** `psql "$DATABASE_URL" -c "TRUNCATE transactions;"` then re-run the file → applies cleanly.

### Risk / Regression Notes

⚠️ The guard runs on **every** application of `002`, including the first one. Confirm step 1 (fresh install) still succeeds — if `to_regclass` is misspelled or the schema-qualifier (`public.`) is wrong, a fresh migrate could falsely abort. 
⚠️ This does not add a `down` migration; forward-only discipline plus the pre-DROP snapshot in `docs/RUNBOOK.md §2` remains the rollback story. Do not advertise this as "reversible."

---

## Fix 2: Push backups off-host and document a tested restore drill

### Criticality
🟠 **HIGH — §6 DevOps & Deployment**

### What the Audit Found

> Backups land in the on-host `postgres_backups` volume only. The single Docker host holds both the live data (`postgres_data`) and its only backups — a host failure loses both. The RUNBOOK's "mount externally for off-host copies" is a comment, not a default. … Push dumps off-host (R2/S3 … or a host-level cron that `rclone`s the volume). Add a documented, periodically-tested restore drill. — *Priority: High*

### Current Behavior

The `db_backup` sidecar in [docker-compose.yml:60-75](../docker-compose.yml#L60) writes gzipped `pg_dump` output into the `postgres_backups` named volume, which lives on the same host as `postgres_data` ([docker-compose.yml:77-80](../docker-compose.yml#L77)):

```yaml
volumes:
  postgres_data:
  uploads_data:      # Phase 2: named volume so attachments survive rebuilds
  postgres_backups:  # Phase 3: dedicated backup volume — mount externally for off-host copies
```

If the host's disk dies, both the live data and every backup die with it. The "mount externally" note is advisory only.

### Desired Behavior

After each scheduled dump, the compressed file is copied to off-host object storage (Cloudflare R2 / S3) using credentials supplied via env. If the off-host credentials are absent, the sidecar still produces local dumps (no regression) and logs that off-host sync is disabled. A documented restore drill exists and is referenced from the RUNBOOK.

### Files to Modify

- `docker-compose.yml` — extend the `db_backup` sidecar to sync dumps off-host after each dump; add the off-host env vars.
- `.env.docker.example` — document the new (optional) off-host backup vars.
- `docs/RUNBOOK.md` — add a "§1a Off-host backups & restore drill" subsection.

### Implementation

#### Step 1: Add off-host sync to the backup sidecar

Replace the `db_backup` service entrypoint in [docker-compose.yml:60-75](../docker-compose.yml#L60). The new cron line runs the dump, then — only if `S3_BUCKET` is set — pushes the newest dump to object storage with the `amazon/aws-cli` behaviour emulated via the bundled `aws` call. Because the `postgres:16-alpine` image has no `aws` CLI, use a small `rclone` or `aws-cli` install step; the lightest reliable option is to switch the sync to a curl-based S3 PUT is fragile, so install `aws-cli` once at container start:

```yaml
  db_backup:
    image: postgres:16-alpine
    environment:
      PGPASSWORD: ${DB_PASSWORD}
      BACKUP_SCHEDULE: ${BACKUP_SCHEDULE:-0 2 * * *}
      # Phase 7: optional off-host sync. Leave S3_BUCKET empty to keep local-only behaviour.
      S3_BUCKET: ${BACKUP_S3_BUCKET:-}
      S3_ENDPOINT: ${BACKUP_S3_ENDPOINT:-}          # e.g. https://<account>.r2.cloudflarestorage.com
      AWS_ACCESS_KEY_ID: ${BACKUP_S3_ACCESS_KEY_ID:-}
      AWS_SECRET_ACCESS_KEY: ${BACKUP_S3_SECRET_ACCESS_KEY:-}
      AWS_DEFAULT_REGION: ${BACKUP_S3_REGION:-auto}
    volumes:
      - postgres_backups:/backups
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    entrypoint: >
      sh -c "
        apk add --no-cache aws-cli >/dev/null 2>&1 || true;
        cat > /usr/local/bin/do-backup.sh <<'EOF'
      #!/bin/sh
      set -e
      F=/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
      pg_dump postgresql://productivity:$PGPASSWORD@db:5432/productivity_db | gzip > \"$F\"
      echo \"local backup written: $F\"
      if [ -n \"$S3_BUCKET\" ]; then
        if [ -n \"$S3_ENDPOINT\" ]; then
          aws --endpoint-url \"$S3_ENDPOINT\" s3 cp \"$F\" \"s3://$S3_BUCKET/$(basename \"$F\")\" && echo \"off-host copy ok\";
        else
          aws s3 cp \"$F\" \"s3://$S3_BUCKET/$(basename \"$F\")\" && echo \"off-host copy ok\";
        fi
      else
        echo \"S3_BUCKET unset — off-host sync disabled (local backup only)\";
      fi
      EOF
        chmod +x /usr/local/bin/do-backup.sh;
        echo \"$BACKUP_SCHEDULE /usr/local/bin/do-backup.sh >> /backups/backup.log 2>&1\" | crontab -;
        crond -f -l 8
      "
```

Why this approach: the dump logic is extracted into `do-backup.sh` so the cron line stays readable and the off-host push is conditional on `S3_BUCKET`. With `S3_BUCKET` empty (the default), behaviour is identical to today — local-only dumps — so this is backward-compatible. `--endpoint-url` makes it work against Cloudflare R2 (S3-compatible) as well as AWS S3. Output is appended to `/backups/backup.log` for the missing-backup check in the runbook.

> **Lower-risk alternative** if you do not want to install `aws-cli` inside the sidecar: keep the existing sidecar unchanged and add a **host-level** cron on the Docker host that runs `docker run --rm -v productivity_postgres_backups:/backups -v ~/.aws:/root/.aws amazon/aws-cli s3 sync /backups s3://$BUCKET/`. Document whichever you choose in the RUNBOOK; do not leave both half-wired.

#### Step 2: Document the new env vars in `.env.docker.example`

Append to [.env.docker.example](../.env.docker.example):

```bash
# Phase 7: off-host database backups (optional). Leave BACKUP_S3_BUCKET empty to
# keep local-only dumps in the postgres_backups volume. Set all four to push each
# nightly dump to S3 / Cloudflare R2 so a host failure does not lose the backups.
BACKUP_S3_BUCKET=
BACKUP_S3_ENDPOINT=          # R2: https://<account>.r2.cloudflarestorage.com ; AWS: leave blank
BACKUP_S3_ACCESS_KEY_ID=
BACKUP_S3_SECRET_ACCESS_KEY=
BACKUP_S3_REGION=auto        # R2: auto ; AWS: e.g. ap-southeast-1
```

#### Step 3: Add a restore drill to the RUNBOOK

Add a subsection to [docs/RUNBOOK.md](../docs/RUNBOOK.md) under §1 ("Automated backups"):

```markdown
### 1a. Off-host backups & monthly restore drill (Phase 7)

When `BACKUP_S3_BUCKET` is configured, each nightly dump is copied to object
storage after it is written locally (`db_backup` sidecar). Verify both copies:

    docker exec productivity_db_backup ls -lh /backups          # local dumps
    aws --endpoint-url $BACKUP_S3_ENDPOINT s3 ls s3://$BACKUP_S3_BUCKET/

**Monthly restore drill (do not skip — an untested backup is not a backup):**

1. Pull the most recent off-host dump to a scratch machine.
2. Spin up a throwaway Postgres: `docker run --rm -d --name restore-test -e POSTGRES_PASSWORD=x postgres:16-alpine`.
3. `gunzip -c <dump>.sql.gz | docker exec -i restore-test psql -U postgres`.
4. Assert row counts are non-zero and plausible:
   `docker exec restore-test psql -U postgres -c "SELECT count(*) FROM transactions;"`.
5. Record the date and row counts in the incident log; tear the container down.
```

### Verification

1. `docker compose config` → parses without error (validates the multiline `entrypoint`).
2. With `BACKUP_S3_BUCKET` **unset**, `docker compose up -d db db_backup`, then `docker exec productivity_db_backup sh -c '/usr/local/bin/do-backup.sh'` → a `backup_*.sql.gz` appears in the volume and the log prints `off-host sync disabled`. (Backward-compat: local-only still works.)
3. With the four `BACKUP_S3_*` vars set to a real test bucket, run the same command → `off-host copy ok` and the object appears in `aws s3 ls`.
4. Execute the restore drill (RUNBOOK §1a) against the most recent dump → row counts non-zero.

### Risk / Regression Notes

⚠️ The off-host push must be **conditional** on `S3_BUCKET`. Confirm step 2 (local-only) still produces a dump — a hard dependency on AWS creds would break every existing deploy that has not set them.
⚠️ `apk add aws-cli` runs at container start; on an air-gapped host it will fail. The `|| true` keeps the sidecar alive (local dumps continue) but off-host sync silently won't work — note this in the RUNBOOK and prefer the host-level `aws-cli` alternative for air-gapped hosts.
⚠️ Object-storage credentials are themselves secrets — they belong in `.env` (gitignored), never in `docker-compose.yml`. See Fix 3.

---

## Fix 3: Treat the committed dev secrets as compromised; document rotation

### Criticality
🟠 **HIGH — §8 Security Deep-Dive**

### What the Audit Found

> A real dev `SESSION_SECRET` and DB password sit in `server/.env` in the working tree. I verified it is gitignored and **never entered git history** … so the exposure is local-only — but the secret is real and the deploy docs reference a matching pattern. … Treat it as compromised: generate a fresh `openssl rand -hex 32` for production and never reuse the dev value. Use Docker/host secrets in prod, not `.env` files. — *Priority: High*

### Current Behavior

- `server/.env` exists in the working tree and is **not** tracked by git (`git ls-files server/.env` returns nothing) and is absent from history — confirmed. It nonetheless contains a real, working `SESSION_SECRET` and a DB password used in development.
- `.env.docker.example` and `server/.env.example` already carry **placeholder** values (good — no real secret is committed).
- There is no written rotation procedure that explicitly says "the dev secret must never be reused in production."

> **Do not print, copy, or commit the real secret values while doing this fix.** The goal is rotation and documentation, not exposure.

### Desired Behavior

- A production deployment uses a **freshly generated** `SESSION_SECRET` and DB password, never the dev values.
- The rotation procedure and the "never reuse dev secrets" rule are written down where an operator will see them (`docs/RUNBOOK.md` already has a SESSION_SECRET section — extend it; `.env.docker.example` gets an explicit warning comment).
- Production secrets are supplied via the host's `.env` (gitignored) or Docker/host secret management, not baked into any tracked file.

### Files to Modify

- `.env.docker.example` — add an explicit "generate fresh, never reuse dev" warning.
- `server/.env.example` — same warning for the manual-deploy path.
- `docs/RUNBOOK.md` — extend the SESSION_SECRET rotation section with the "treat dev secret as compromised" rule and the exact generation command.
- (No code change. No reading or moving of the real `server/.env`.)

### Implementation

#### Step 1: Add a generate-fresh warning to the example env files

At the top of [.env.docker.example](../.env.docker.example), above the existing keys, add:

```bash
# ⚠️ Phase 7 — SECRETS: generate fresh values for EVERY environment.
#   SESSION_SECRET : openssl rand -hex 32   (rotating it logs out all users)
#   DB_PASSWORD    : openssl rand -base64 24
# NEVER reuse a development secret in production. The dev value in server/.env is
# considered compromised and must not be promoted. In production, prefer Docker
# secrets / host secret managers over a plaintext .env where possible.
```

Add an equivalent comment block to the top of [server/.env.example](../server/.env.example).

#### Step 2: Extend the RUNBOOK rotation section

In [docs/RUNBOOK.md](../docs/RUNBOOK.md) §3 (SESSION_SECRET), append:

```markdown
**Phase 7 — dev secrets are compromised by default.** The `SESSION_SECRET` and
DB password in `server/.env` were used in development and must be treated as
public. Before any production deploy:

1. Generate fresh values:
       SESSION_SECRET=$(openssl rand -hex 32)
       DB_PASSWORD=$(openssl rand -base64 24)
2. Put them in the production host's `.env` (gitignored) or a secret manager —
   never in a tracked file, never the dev value.
3. Rotating `SESSION_SECRET` invalidates all sessions (every user is logged out);
   schedule it for a low-traffic window. Restart `api` after rotation.
```

### Verification

1. `git status` → `server/.env` is still **untracked/ignored**; no real secret is staged. `git log --all -- server/.env` → empty (unchanged).
2. `git diff` shows changes **only** to `.env.docker.example`, `server/.env.example`, and `docs/RUNBOOK.md` — the example files still contain placeholders, never real values.
3. `openssl rand -hex 32` and `openssl rand -base64 24` run successfully (the documented commands work).
4. Grep the repo for the real dev secret prefix to be certain it was never committed: `git grep -n "<first 6 chars of the dev secret>" $(git rev-list --all)` → no matches. (Run mentally/locally; do not paste the secret into any committed file or this doc.)

### Risk / Regression Notes

⚠️ This fix is documentation + rotation discipline only — **do not** delete or rewrite the working `server/.env`, or local development breaks. 
⚠️ Never paste the real secret into a commit, a PR description, or these docs. If it has been shared anywhere, rotate immediately.
⚠️ Rotating `SESSION_SECRET` in production logs out every active user — communicate before doing it.

---

## Completion Checklist

- [ ] All files modified as specified
- [ ] All verifications pass (fresh-migrate works; guard blocks a populated table; local-only backup still works; off-host sync works when configured; no real secret committed)
- [ ] `npm test` passes in both `client/` and `server/` (no regressions)
- [ ] `docker compose config` parses cleanly
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] A pre-change `pg_dump` snapshot was taken before testing the migration guard
- [ ] Changes committed with a descriptive message: `fix: phase 7 — guard destructive 002 migration, off-host backups, secret rotation docs`
