-- Business rules (Phase 5, workflow & automation).
--
-- A business rule is an event trigger + a condition (JSON) + a list of actions
-- (`NOTIFY`, `START_WORKFLOW`, `EMIT_WEBHOOK`). The engine subscribes to every domain
-- event, evaluates enabled rules whose event type matches, and runs their actions.
-- Additive: no existing table is altered.

CREATE TABLE "business_rules" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "name"        TEXT           NOT NULL,
  "description" TEXT,
  "event_type"  TEXT           NOT NULL,
  "condition"   JSONB          NOT NULL DEFAULT '{}',
  "actions"     JSONB          NOT NULL DEFAULT '[]',
  "priority"    INTEGER        NOT NULL DEFAULT 100,
  "is_enabled"  BOOLEAN        NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "business_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_rules_company_event_idx" ON "business_rules" ("company_id", "event_type", "is_enabled");

-- RLS: a rule is visible only inside the tenant that owns it.
ALTER TABLE "business_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_rules" FORCE ROW LEVEL SECURITY;

CREATE POLICY "business_rules_tenant_isolation" ON "business_rules"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
