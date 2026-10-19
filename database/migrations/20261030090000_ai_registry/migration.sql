-- AI registry (Phase 6c platform console).
--
-- Four tenant-scoped registries that turn the AI gateway from a hardcoded single
-- assistant into configurable surface area:
--   ai_models  — model catalogue with optional per-model pricing (drives Usage & Cost)
--                and a default flag the gateway prefers over the env-configured model.
--   ai_prompts — versioned system-prompt templates; an enabled version overrides the
--                gateway's built-in prompt for its key.
--   ai_agents  — assistant definitions (prompt key, model key, granted tool keys) that
--                `/ai/ask` applies when an `agentKey` is supplied.
--   ai_tools   — per-company overrides for the built-in agent tools; an explicit
--                `is_enabled = false` row gates the tool off (absence keeps the default).
--
-- Additive: no existing table altered. All four are RLS-scoped like every other
-- tenant-owned table.
CREATE TABLE "ai_models" (
  "id"                       UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"               UUID            NOT NULL,
  "key"                      TEXT            NOT NULL,
  "name"                     TEXT            NOT NULL,
  "provider"                 TEXT            NOT NULL DEFAULT 'openai-compatible',
  "context_window"           INTEGER,
  "input_price_per_million"  DECIMAL(12,6),
  "output_price_per_million" DECIMAL(12,6),
  "is_default"               BOOLEAN         NOT NULL DEFAULT false,
  "is_enabled"               BOOLEAN         NOT NULL DEFAULT true,
  "created_at"               TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),

  CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_models_company_key_unique" UNIQUE ("company_id", "key")
);

CREATE INDEX "ai_models_company_idx" ON "ai_models" ("company_id");

ALTER TABLE "ai_models" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_models" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_models_tenant_isolation" ON "ai_models"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "ai_prompts" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "key"         TEXT           NOT NULL,
  "version"     INTEGER        NOT NULL DEFAULT 1,
  "name"        TEXT,
  "content"     TEXT           NOT NULL,
  "is_enabled"  BOOLEAN        NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "ai_prompts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_prompts_company_key_version_unique" UNIQUE ("company_id", "key", "version"),
  CONSTRAINT "ai_prompts_version_positive" CHECK ("version" > 0)
);

CREATE INDEX "ai_prompts_company_key_idx" ON "ai_prompts" ("company_id", "key");

ALTER TABLE "ai_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_prompts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_prompts_tenant_isolation" ON "ai_prompts"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "ai_agents" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "key"         TEXT           NOT NULL,
  "name"        TEXT           NOT NULL,
  "description" TEXT,
  "prompt_key"  TEXT,
  "model_key"   TEXT,
  "tools"       JSONB          NOT NULL DEFAULT '[]',
  "is_enabled"  BOOLEAN        NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_agents_company_key_unique" UNIQUE ("company_id", "key")
);

CREATE INDEX "ai_agents_company_idx" ON "ai_agents" ("company_id");

ALTER TABLE "ai_agents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_agents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents_tenant_isolation" ON "ai_agents"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "ai_tools" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "key"         TEXT           NOT NULL,
  "is_enabled"  BOOLEAN        NOT NULL,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "ai_tools_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_tools_company_key_unique" UNIQUE ("company_id", "key")
);

CREATE INDEX "ai_tools_company_idx" ON "ai_tools" ("company_id");

ALTER TABLE "ai_tools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_tools" FORCE ROW LEVEL SECURITY;
CREATE POLICY "ai_tools_tenant_isolation" ON "ai_tools"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
