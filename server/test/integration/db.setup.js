// Phase 10: real-Postgres integration harness.
// Uses DATABASE_URL when present (CI service / local docker).
// Skips cleanly when no DB is configured so the default fast suite
// still passes on a machine with no Postgres.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

export const hasDb = !!process.env.DATABASE_URL;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let _pool = null;
let _migrationsRun = false;

export async function setupDb() {
  if (!hasDb) return null;
  if (!_migrationsRun) {
    execFileSync(process.execPath, [join(ROOT, 'db', 'migrate.js')], {
      stdio: 'pipe',
      cwd: ROOT,
      env: { ...process.env },
    });
    _migrationsRun = true;
  }
  _pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  return _pool;
}

export async function teardownDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

export async function makeUser(pool, email) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, 'x', $2) RETURNING id`,
    [email, email.split('@')[0]]
  );
  return rows[0].id;
}

// ON DELETE CASCADE on user_id FKs removes child rows (transactions, accounts, etc.)
export async function cleanupUsers(pool, ids) {
  if (!ids?.length) return;
  await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [ids]);
}
