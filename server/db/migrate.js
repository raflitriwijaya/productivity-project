// server/db/migrate.js
// Forward-only SQL migration runner. Applies every *.sql file under ./migrations
// that has not yet been recorded in the `schema_migrations` table, each inside its
// own transaction. Run with: `npm run migrate` (from server/).
//
// Two real-world scenarios are handled:
//
//   1. Fresh database — nothing exists yet. Files are applied in order. Because the
//      v1 migrations share a date prefix and don't encode their own dependencies,
//      a file that references a not-yet-created table fails with 42P01 and is
//      *deferred* to a later pass, so ordering resolves itself.
//
//   2. Existing database — the v1 (date-prefixed) tables were created manually
//      before this runner existed, so there is no schema_migrations history. Those
//      CREATE statements fail with "already exists" (42P07 / 42710); we treat that
//      as "already applied", record the file, and move on instead of aborting.
//
// Ordering: date-prefixed v1 files (YYYYMMDD_*) run as an earlier group than the
// sequential v2+ series (NNN_*), so 002_finance_upgrade.sql — which drops and
// recreates `transactions` — always runs after the base tables it builds upon.

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../lib/db.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

// Postgres error codes that mean "this object already exists" — i.e. the migration
// was effectively applied out-of-band on a pre-existing database.
const ALREADY_EXISTS_CODES = new Set(['42P07', '42710', '42P06']);
// Missing dependency (referenced relation does not exist yet) — defer and retry.
const MISSING_DEP_CODE = '42P01';

/**
 * Sort key for a migration filename: [group, name].
 *  group 0 → legacy 8-digit date prefix (YYYYMMDD_*), the v1 schema
 *  group 1 → everything else (NNN_*, the v2+ sequential series)
 * Within a group, plain lexicographic order.
 */
function compareMigrations(a, b) {
  const ga = /^\d{8}_/.test(a) ? 0 : 1;
  const gb = /^\d{8}_/.test(b) ? 0 : 1;
  if (ga !== gb) return ga - gb;
  return a < b ? -1 : a > b ? 1 : 0;
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function recordApplied(filename) {
  await pool.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
    [filename]
  );
}

/**
 * Apply one migration file in a transaction.
 * @returns {Promise<'applied' | 'exists' | 'deferred'>}
 */
async function applyOne(filename) {
  const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    return 'applied';
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (ALREADY_EXISTS_CODES.has(err.code)) {
      await recordApplied(filename);
      return 'exists';
    }
    if (err.code === MISSING_DEP_CODE) return 'deferred';
    err.message = `while applying ${filename}: ${err.message}`;
    throw err;
  } finally {
    client.release();
  }
}

async function run() {
  await ensureMigrationsTable();

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map(r => r.filename));

  const all = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort(compareMigrations);
  let pending = all.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('[migrate] Nothing to apply — database is up to date.');
    return;
  }

  // Multi-pass: a pass that makes no progress on the remaining files means their
  // dependencies can never be met, so we surface the blocking error.
  while (pending.length > 0) {
    const deferred = [];
    let progressed = false;

    for (const file of pending) {
      const result = await applyOne(file);
      if (result === 'applied') {
        progressed = true;
        console.log(`[migrate] ✓ applied ${file}`);
      } else if (result === 'exists') {
        progressed = true;
        console.log(`[migrate] • ${file} already present — recorded as applied`);
      } else {
        deferred.push(file);
      }
    }

    if (!progressed) {
      // Re-run the first blocked file without catching, to throw its real error.
      const sql = await readFile(join(MIGRATIONS_DIR, deferred[0]), 'utf8');
      await pool.query(sql); // throws the underlying 42P01 with context
      throw new Error(`[migrate] Stuck: cannot resolve dependencies for ${deferred.join(', ')}`);
    }

    pending = deferred;
  }

  console.log('[migrate] Done.');
}

run()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[migrate] Migration run aborted.');
    console.error(err);
    pool.end().finally(() => process.exit(1));
  });
