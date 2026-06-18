-- Migration: 021_engineer_doc_attachments
-- Adds file attachment support to engineer_documents, matching the
-- research_attachments pattern (migration 004_research_topics.sql).
--
-- engineer_doc_attachments — per-document uploaded files; metadata row in PG,
--   bytes on disk under server/uploads/ (shared with research attachments).
--
-- Re-runnable: DROP IF EXISTS before CREATE.

DROP TABLE IF EXISTS engineer_doc_attachments CASCADE;

CREATE TABLE engineer_doc_attachments (
  id            SERIAL PRIMARY KEY,
  document_id   INTEGER NOT NULL REFERENCES engineer_documents(id) ON DELETE CASCADE,
  filename      VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  mime_type     VARCHAR(100),
  size          INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_engineer_doc_attachments_document_id ON engineer_doc_attachments(document_id);
