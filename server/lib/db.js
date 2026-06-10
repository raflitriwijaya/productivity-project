// server/lib/db.js
// Single shared PostgreSQL connection pool for the entire server (§6.1).
// No ORM — models issue raw parameterized queries against this pool (§6.5).
//
// Exported as BOTH a named and a default binding so models written either way
// resolve the same singleton:
//   import { pool } from '../lib/db.js'   (user/todo models, index.js)
//   import pool      from '../lib/db.js'   (finance/learning/research models)

import 'dotenv/config';
import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('Missing env var: DATABASE_URL');
}

/**
 * Shared pg connection pool. Pool sizing/timeouts (§ hardening 3A):
 *  - max: PG_POOL_MAX (env) or 10  cap concurrent connections; ops-configurable
 *  - idleTimeoutMillis: 30000      reclaim idle clients after 30s
 *  - connectionTimeoutMillis: 2000 fail fast if the DB is unreachable
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX ?? '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Surface unexpected pool-level errors instead of crashing silently.
pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected pg pool error');
});

export default pool;
