-- Feature flags (Phase 6b platform).
--
-- A feature flag is a toggle keyed by a code, optionally scoped per company (a
-- company-specific row overrides the global fallback). The flag runner scans both
-- global and tenant-owned flags to build the effective set for a caller.
CREATE TABLE "feature_flags" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID,                       -- NULL => global, applies to every tenant
  "key"          TEXT           NOT NULL,
  "name"         TEXT           NOT NULL,
  "description"  TEXT,
  "enabled"      BOOLEAN        NOT NULL DEFAULT false,
  "rollout"      JSONB          NOT NULL DEFAULT '{}',
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feature_flags_key_company_idx" ON "feature_flags" ("key", "company_id");

ALTER TABLE "feature_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_flags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_tenant_isolation" ON "feature_flags"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid OR "company_id" IS NULL)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid OR "company_id" IS NULL);

-- Privileged scan used by the platform control plane to see every flag across tenants.
CREATE OR REPLACE FUNCTION platform_visible_feature_flags()
RETURNS SETOF "feature_flags"
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM "feature_flags" ORDER BY "key", "company_id" NULLS LAST;
$$;
