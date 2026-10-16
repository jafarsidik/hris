-- AI services (Phase 6): policy knowledge base + call audit.
--
-- `ai_knowledge_documents` stores published policy text and its embedding so the
-- gateway can retrieve relevant passages without exposing personal data. The
-- gateway redacts before calling the provider, and permissions are enforced on
-- read/write through the application. Additive; RLS applied.
CREATE TABLE "ai_knowledge_documents" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "title"       TEXT           NOT NULL,
  "kind"        TEXT           NOT NULL DEFAULT 'POLICY',
  "source"      TEXT,
  "content"     TEXT           NOT NULL,
  "embedding"   JSONB,
  "status"      TEXT           NOT NULL DEFAULT 'PUBLISHED',
  "created_by_user_id" UUID,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "ai_knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_knowledge_documents_company_status_idx"
  ON "ai_knowledge_documents" ("company_id", "status");

ALTER TABLE "ai_knowledge_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_knowledge_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_knowledge_documents_tenant_isolation" ON "ai_knowledge_documents"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "ai_calls" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID           NOT NULL,
  "user_id"      UUID           NOT NULL,
  "feature"      TEXT           NOT NULL,
  "provider"     TEXT           NOT NULL,
  "model"        TEXT           NOT NULL,
  "prompt_hash"  TEXT           NOT NULL,
  "input_tokens" INTEGER        NOT NULL DEFAULT 0,
  "output_tokens" INTEGER       NOT NULL DEFAULT 0,
  "latency_ms"   INTEGER        NOT NULL DEFAULT 0,
  "status"       TEXT           NOT NULL DEFAULT 'SUCCESS',
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "ai_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_calls_company_created_idx" ON "ai_calls" ("company_id", "created_at");

ALTER TABLE "ai_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_calls" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_calls_tenant_isolation" ON "ai_calls"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
