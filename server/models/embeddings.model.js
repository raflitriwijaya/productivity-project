// server/models/embeddings.model.js
// Roadmap Wave 6 (Moonshots): persistence + similarity search for research entry
// embeddings (the research_embeddings table from migration 014_pgvector.sql).
//
// Every function tolerates the table being absent (42P01) — on an environment
// without pgvector the migration skips table creation, and these helpers then
// no-op (writes) or return empty (reads) so the feature degrades gracefully
// instead of 500-ing the request.

import pool from '../lib/db.js';

/** Postgres "undefined_table" — research_embeddings doesn't exist (no pgvector). */
function isMissingTable(err) {
  return err?.code === '42P01';
}

/** Serialise a JS number[] into the pgvector text literal `[a,b,c]`. */
function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

/**
 * Upsert the embedding for an entry (one row per entry via the UNIQUE constraint).
 * @returns {Promise<Object|null>} the stored row, or null if embeddings are unavailable
 */
export async function storeEmbedding(entryId, embedding, model = 'text-embedding-3-small') {
  try {
    const { rows } = await pool.query(
      `INSERT INTO research_embeddings (entry_id, embedding, model)
       VALUES ($1, $2::vector, $3)
       ON CONFLICT (entry_id)
       DO UPDATE SET embedding = $2::vector, model = $3, created_at = NOW()
       RETURNING id, entry_id, model, created_at`,
      [entryId, toVectorLiteral(embedding), model]
    );
    return rows[0];
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/** Fetch the stored embedding metadata for one entry (vector column omitted). */
export async function getEmbedding(entryId) {
  try {
    const { rows } = await pool.query(
      `SELECT id, entry_id, model, created_at FROM research_embeddings WHERE entry_id = $1`,
      [entryId]
    );
    return rows[0] ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/**
 * Cosine-similarity search over a user's research entries.
 * @param {number} userId
 * @param {number[]} queryEmbedding
 * @param {number} [limit=10]
 * @param {number} [threshold=0.3]  Minimum similarity (1 - cosine distance) to include.
 * @returns {Promise<Array>} matching entries, each with a `similarity` score (0..1)
 */
export async function semanticSearch(userId, queryEmbedding, limit = 10, threshold = 0.3) {
  const vec = toVectorLiteral(queryEmbedding);
  try {
    const { rows } = await pool.query(
      `SELECT re.id, re.title, re.type, re.status, re.source, re.tags,
              re.created_at, re.updated_at,
              1 - (rem.embedding <=> $2::vector) AS similarity
         FROM research_embeddings rem
         JOIN research_entries re ON re.id = rem.entry_id
        WHERE re.user_id = $1
          AND 1 - (rem.embedding <=> $2::vector) > $3
        ORDER BY rem.embedding <=> $2::vector
        LIMIT $4`,
      [userId, vec, threshold, limit]
    );
    return rows;
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/** Remove an entry's embedding (entry delete already cascades; this is for explicit cleanup). */
export async function deleteEmbedding(entryId) {
  try {
    await pool.query(`DELETE FROM research_embeddings WHERE entry_id = $1`, [entryId]);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
  }
}
