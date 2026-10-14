-- Generic storage for registry-declared resources (Phase 2 CRUD runtime).
--
-- Field values are validated against the resource's registered fields and stored as
-- JSON, so a resource registered at runtime needs no schema change. `owner_user_id`
-- and `organizational_unit_id` are real columns so SELF and org-level data scopes stay
-- database-enforced predicates rather than application post-filters.

CREATE TABLE "resource_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "resource_key" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "owner_user_id" UUID,
  "organizational_unit_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_by_user_id" UUID,
  "deleted_at" TIMESTAMPTZ(3),

  CONSTRAINT "resource_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_records_company_resource_idx" ON "resource_records"("company_id", "resource_key");
CREATE INDEX "resource_records_organizational_unit_id_idx" ON "resource_records"("organizational_unit_id");

ALTER TABLE "resource_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "resource_records_tenant_isolation" ON "resource_records" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
