-- 014_pgvector.sql
-- Roadmap Wave 6 (Moonshots): pgvector-backed semantic search for research entries.
--
-- Stores one OpenAI-compatible embedding per research entry so that
-- GET /api/research/semantic-search can rank entries by cosine similarity, and
-- the auto-tagger (server/lib/autoTagger.js) can find semantically similar
-- neighbours.
--
-- ── Why this whole migration is wrapped in a guarded DO block ────────────────
-- The pgvector extension ships with the production image (pgvector/pgvector:pg16,
-- see docker-compose.yml) but NOT with the stock `postgres:16-alpine` image used
-- by CI (.github/workflows/ci.yml) or a vanilla local Postgres. The migration
-- runner (db/migrate.js) aborts the entire run on any unrecognised error, so a
-- naked `CREATE EXTENSION vector` would break CI's migrate step and, with it, the
-- whole integration + e2e suite.
--
-- So: we only create the extension, table, and indexes when `vector` is actually
-- available (pg_available_extensions). Where it isn't, we RAISE NOTICE and record
-- the migration as applied with no objects created — semantic search and auto-tag
-- then degrade gracefully (their model/route code is best-effort, see
-- embeddings.model.js / autoTagger.js). The DDL runs via EXECUTE so the `vector`
-- type is never parsed on an image that lacks the extension.
--
-- NOTE: on an environment that started without pgvector and later gains it, this
-- file is already recorded as applied and will NOT re-run. Production deploys on
-- the pgvector image from the first migrate, so this only affects CI/dev — re-run
-- by deleting the '014_pgvector.sql' row from schema_migrations if you add
-- pgvector to an existing dev DB.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Embeddings table — one row per research entry (UNIQUE on entry_id), cascading
    -- away when the parent entry is deleted.
    EXECUTE $ddl$
      DROP TABLE IF EXISTS research_embeddings CASCADE;

      CREATE TABLE research_embeddings (
        id          SERIAL PRIMARY KEY,
        entry_id    INTEGER NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE,
        embedding   vector(1536),  -- text-embedding-3-small / ada-002 dimension
        model       VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (entry_id)
      );

      CREATE INDEX idx_research_embeddings_entry
        ON research_embeddings (entry_id);

      -- ivfflat cosine index. Effective once the table holds enough rows (~100+);
      -- below that, Postgres falls back to a sequential scan, which is plenty fast.
      CREATE INDEX idx_research_embeddings_vector
        ON research_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    $ddl$;

    RAISE NOTICE '[014_pgvector] pgvector enabled — research_embeddings created.';
  ELSE
    RAISE NOTICE '[014_pgvector] pgvector not available on this server — skipping research_embeddings. Semantic search and auto-tag will degrade gracefully.';
  END IF;
END $$;
