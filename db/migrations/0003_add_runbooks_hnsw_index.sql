-- HNSW index for cosine similarity search on runbook embeddings.
-- See db/migrations/0002_add_hnsw_embedding_index.sql equivalent from Phase 1
-- (smart-semantic-bookmarking-and-memory-engine) for why HNSW over IVFFlat.
CREATE INDEX IF NOT EXISTS "runbooks_embedding_hnsw_idx"
    ON "runbooks"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
