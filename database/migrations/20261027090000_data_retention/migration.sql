-- Data retention schedules (Phase 6b platform).
--
-- A retention schedule defines how long a class of platform data is kept before it is
-- purged. `retention_days` is the window after `occurred_at`/`created_at`; `purge_after`
-- days after that the row is physically removed. Additive: no existing table is altered.
CREATE TABLE "data_retention_schedules" (
  "id"             UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID           NOT NULL,
  "resource"       TEXT           NOT NULL,
  "retention_days" INTEGER        NOT NULL,
  "purge_after_days" INTEGER      NOT NULL DEFAULT 30,
  "is_enabled"     BOOLEAN        NOT NULL DEFAULT true,
  "created_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "data_retention_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_retention_schedules_company_resource_idx"
  ON "data_retention_schedules" ("company_id", "resource");

ALTER TABLE "data_retention_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_retention_schedules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "data_retention_schedules_tenant_isolation" ON "data_retention_schedules"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

-- Privileged scan for the retention sweep across tenants.
CREATE OR REPLACE FUNCTION platform_visible_retention_schedules()
RETURNS SETOF data_retention_schedules
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT s.* FROM data_retention_schedules s
   WHERE s.is_enabled = true
   ORDER BY s.resource ASC;
$$;
