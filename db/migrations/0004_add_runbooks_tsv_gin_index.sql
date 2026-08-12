CREATE INDEX IF NOT EXISTS "runbooks_tsv_content_gin_idx" ON "runbooks" USING GIN ("tsv_content");
