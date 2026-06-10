# Runbook — Rafli's Productivity Suite

Operational procedures for engineers and on-call responders. Architecture context lives in [docs/ARCHITECTURE.md](ARCHITECTURE.md).

---

## 1. DB Backup and Restore

### Automated backups (Docker)

The `db_backup` sidecar service in `docker-compose.yml` runs `pg_dump` on a cron schedule (default `0 2 * * *` — 02:00 UTC daily). Compressed dumps land in the `postgres_backups` named Docker volume. Override the schedule with the `BACKUP_SCHEDULE` env var.

```bash
# Confirm the latest dump was created
docker exec productivity_db_backup ls -lh /backups/
```

### 1a. Off-host backups & monthly restore drill (Phase 7)

When `BACKUP_S3_BUCKET` is configured, each nightly dump is copied to object
storage after it is written locally (`db_backup` sidecar). Verify both copies:

```bash
docker exec productivity_db_backup ls -lh /backups          # local dumps
aws --endpoint-url $BACKUP_S3_ENDPOINT s3 ls s3://$BACKUP_S3_BUCKET/
```

**Monthly restore drill (do not skip — an untested backup is not a backup):**

1. Pull the most recent off-host dump to a scratch machine.
2. Spin up a throwaway Postgres: `docker run --rm -d --name restore-test -e POSTGRES_PASSWORD=x postgres:16-alpine`.
3. `gunzip -c <dump>.sql.gz | docker exec -i restore-test psql -U postgres`.
4. Assert row counts are non-zero and plausible:
   `docker exec restore-test psql -U postgres -c "SELECT count(*) FROM transactions;"`.
5. Record the date and row counts in the incident log; tear the container down.

### Manual pg_dump

```bash
# Dump the live database to a local file
pg_dump "$DATABASE_URL" | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Or dump from inside the Docker db container
docker exec productivity_db pg_dump -U postgres productivity | gzip > backup.sql.gz
```

### pg_restore

```bash
# Restore from a dump file to a fresh database
gunzip -c backup.sql.gz | psql "$DATABASE_URL"

# Or target the Docker db service
gunzip -c backup.sql.gz | docker exec -i productivity_db psql -U postgres productivity
```

> **Warning:** Restoring overwrites existing data. Stop the `api` container first to avoid concurrent writes.

---

## 2. Migration Rollback

The migration runner (`server/db/migrate.js`) is **forward-only** — it has no `down` step. Rollback procedure:

1. **Before running a destructive migration (DROP, ALTER)** — take a `pg_dump` snapshot (see §1 above).
2. If a migration must be reversed:
   a. Write a new migration file with the compensating SQL (e.g., re-create the dropped column).
   b. Add the file to `server/db/migrations/` with a timestamp prefix that sorts after the bad migration.
   c. Run `npm run migrate` — the runner picks up and applies the new file.
3. If the database is unrecoverable, restore from the pre-migration snapshot:
   ```bash
   # Stop the API
   docker compose stop api
   # Drop and recreate the DB (caution: all data lost)
   docker exec -it productivity_db psql -U postgres -c "DROP DATABASE IF EXISTS productivity; CREATE DATABASE productivity;"
   # Restore from snapshot
   gunzip -c pre_migration_backup.sql.gz | docker exec -i productivity_db psql -U postgres productivity
   # Restart
   docker compose start api
   ```
4. Remove the bad migration file from `server/db/migrations/` **and** delete its row from `schema_migrations` so re-running `npm run migrate` does not re-apply it.

---

## 3. Secret Rotation

### SESSION_SECRET

`SESSION_SECRET` signs all session cookies. Rotating it **immediately invalidates every active user session** — all logged-in users will be signed out.

Steps:
1. Generate a new secret: `openssl rand -hex 32`
2. Update the secret in the production environment (Docker `.env` file, hosting env vars panel, or secrets manager).
3. Restart the `api` container: `docker compose restart api`
4. Monitor error logs for a few minutes. Expect a brief surge in 401 responses as users re-authenticate.

### DATABASE_URL password

1. Create the new DB password in Postgres: `ALTER USER postgres PASSWORD 'new_password';`
2. Update `DATABASE_URL` in the production env.
3. Restart `api` and `db_backup` containers.

**Phase 7 — dev secrets are compromised by default.** The `SESSION_SECRET` and
DB password in `server/.env` were used in development and must be treated as
public. Before any production deploy:

1. Generate fresh values:
   ```bash
   SESSION_SECRET=$(openssl rand -hex 32)
   DB_PASSWORD=$(openssl rand -base64 24)
   ```
2. Put them in the production host's `.env` (gitignored) or a secret manager —
   never in a tracked file, never the dev value.
3. Rotating `SESSION_SECRET` invalidates all sessions (every user is logged out);
   schedule it for a low-traffic window. Restart `api` after rotation.

---

## 4. Object Storage Migration Plan (uploads → S3 / Cloudflare R2)

> **Status: planning only** — do not implement until a multi-replica deploy is needed.

### Why

Attachment files are currently stored on the `api` container's local filesystem, persisted via the `uploads_data` Docker named volume. This works for a single-replica deployment but breaks if:

- A second API replica is started (Replica B cannot serve files written by Replica A).
- The Docker host is reprovisioned (named volumes may not survive a full host rebuild).

**Cloudflare R2** is the recommended target: it pairs with the existing Cloudflare Tunnel setup, has no egress fees, and uses the S3-compatible API so the migration is a library swap rather than a full rewrite.

### Migration Steps

1. **Provision the bucket** — Create an R2 bucket in the Cloudflare dashboard. Generate API credentials (access key ID + secret).

2. **Install the S3 client**
   ```bash
   cd server && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

3. **Add env vars**
   ```
   R2_ACCOUNT_ID=
   R2_ACCESS_KEY_ID=
   R2_SECRET_ACCESS_KEY=
   R2_BUCKET=productivity-uploads
   R2_PUBLIC_URL=   # optional: custom domain for public reads
   ```

4. **Create `server/lib/storage.js`** — a thin adapter with `uploadFile(buffer, filename, mimeType)` → URL and `deleteFile(filename)`. Behind a feature flag (`USE_OBJECT_STORAGE=true`) so the old disk path stays hot until the cut-over is complete.

5. **Migrate existing uploads** — write a one-shot script that reads every row in `research_attachments`, streams the file from `server/uploads/` into R2 under the same UUID filename, then verifies the upload.

6. **Update `server/routes/research.js`**
   - `POST /:id/attachments` — replace `multer` disk storage with `multer` memory storage; pipe the buffer to `storage.uploadFile()`; store the R2 key as `file_path`.
   - `GET /attachments/:id/download` — call `storage.getSignedUrl(key, 60)` (60 s TTL) and redirect; or stream the object body directly.
   - `DELETE /attachments/:id` — call `storage.deleteFile(key)` after the DB row is deleted.

7. **Update `research_attachments.file_path`** — the column stores an absolute local path today; after migration it stores the R2 object key (UUID filename). The column is opaque to the rest of the codebase, so no other code needs changing.

8. **Remove the `uploads_data` Docker volume** once all files are confirmed in R2 and the feature flag is removed.

### Code Touch-Points

| File | Change |
|------|--------|
| `server/routes/research.js` | swap multer disk → memory; call storage adapter |
| `server/lib/storage.js` | new file — S3 adapter |
| `server/docker-compose.yml` | remove `uploads_data` volume after cut-over |
| `server/.env.example` | add R2 env vars |
| `docs/ARCHITECTURE.md` | update attachment storage section |

---

## 5. Common Incidents

### API returns 500 for all requests

1. Check structured logs: `docker compose logs api --tail=100`
2. Look for the `reqId` field — users can quote it in bug reports; search Sentry for the same ID.
3. Common causes: `DATABASE_URL` unreachable (check `db` container health), out-of-memory (check Docker stats), failed migration on deploy.

### Session cookie not sent / users constantly logged out

- Confirm `SESSION_SECRET` has not been rotated recently.
- Check `cookie.secure` — if `NODE_ENV=production` but the app is behind HTTP, the cookie will not be set. Verify `trust proxy: 1` is active and `X-Forwarded-Proto: https` is set by nginx.

### Rate limit false positives (legit users getting 429)

- `generalLimiter` is 100 req/min/IP. Behind a corporate NAT all users share one IP. Increase `max` or switch to a user-ID key if needed.
- `authLimiter` is 5 req/15 min/IP — intentionally strict.
