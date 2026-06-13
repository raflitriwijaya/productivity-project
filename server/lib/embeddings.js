// server/lib/embeddings.js
// Roadmap Wave 6 (Moonshots): embedding generation for semantic search + auto-tag.
//
// Generates embeddings via an OpenAI-compatible /embeddings endpoint (DeepSeek by
// default). Configured entirely via environment variables so no key is ever baked
// into the image:
//   EMBEDDING_API_URL    (default: https://api.deepseek.com/v1/embeddings)
//   EMBEDDING_API_KEY    (falls back to DEEPSEEK_API_KEY)
//   EMBEDDING_MODEL      (default: text-embedding-3-small)
//   EMBEDDING_DIMENSIONS (default: 1536 — must match the vector(N) column in 014)
//
// Without a configured key every call throws; callers (the semantic-search route
// and the fire-and-forget indexing hook) treat that as a soft failure so keyword
// search and the rest of the app stay fully functional.

import { aiUpstreamDuration } from './metrics.js';

const EMBEDDING_API_URL    = process.env.EMBEDDING_API_URL || 'https://api.deepseek.com/v1/embeddings';
const EMBEDDING_API_KEY    = process.env.EMBEDDING_API_KEY || process.env.DEEPSEEK_API_KEY || '';
const EMBEDDING_MODEL      = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);

/** True when an embedding API key is configured. Lets callers skip work cheaply. */
export function embeddingsConfigured() {
  return Boolean(EMBEDDING_API_KEY);
}

/** The model name in use — persisted alongside each stored embedding. */
export function embeddingModel() {
  return EMBEDDING_MODEL;
}

/**
 * Generate an embedding vector for a chunk of text.
 * @param {string} text
 * @returns {Promise<number[]>} the embedding (length === EMBEDDING_DIMENSIONS)
 * @throws if no key is configured or the upstream API errors
 */
export async function generateEmbedding(text) {
  if (!EMBEDDING_API_KEY) {
    throw new Error('EMBEDDING_API_KEY or DEEPSEEK_API_KEY is not configured');
  }
  if (!text || !text.trim()) {
    throw new Error('Cannot embed empty text');
  }

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 30_000);
  const embedStart = Date.now();
  let response;
  try {
    response = await fetch(EMBEDDING_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EMBEDDING_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000), // truncate to a safe token budget
      }),
      signal: abort.signal,
    });
  } catch (err) {
    const embedStatus = (err.name === 'AbortError' || err.code === 'ABORT_ERR') ? 'timeout' : 'error';
    aiUpstreamDuration.observe(
      { provider: 'deepseek', model: EMBEDDING_MODEL, status: embedStatus },
      (Date.now() - embedStart) / 1000
    );
    clearTimeout(timeout);
    if (embedStatus === 'timeout') return [];
    throw err;
  }
  clearTimeout(timeout);
  aiUpstreamDuration.observe(
    { provider: 'deepseek', model: EMBEDDING_MODEL, status: 'success' },
    (Date.now() - embedStart) / 1000
  );

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Embedding API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding || data.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error('Embedding API returned no vector');
  }
  return embedding;
}

/**
 * Build the canonical text representation of a research entry and embed it. The
 * field order (title → content → tags → source) keeps the query side
 * (generateEmbedding(query)) and the index side consistent.
 * @param {{ title?: string, content?: string, tags?: string, source?: string }} entry
 * @returns {Promise<number[]>}
 */
export async function generateEmbeddingForEntry(entry) {
  const text = [entry.title, entry.content, entry.tags, entry.source]
    .filter(Boolean)
    .join('\n\n');
  return generateEmbedding(text);
}
