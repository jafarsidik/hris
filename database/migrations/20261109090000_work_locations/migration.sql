-- Work locations (Wave 3, Organization).
--
-- Tenant-scoped list of office/work sites. Referenced by employees and
-- organizational planning; no existing table is altered. RLS-scoped and
-- soft-deleted like the rest of the organization domain.

CREATE TABLE "work_locations" (
  "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID            NOT NULL,
  "code"          TEXT            NOT NULL,
  "name"          TEXT            NOT NULL,
  "city"          TEXT,
  "country"       TEXT,
  "address"       TEXT,
  "timezone"      TEXT,
  "is_headquarters" BOOLEAN       NOT NULL DEFAULT false,
  "created_at"    TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"    TIMESTAMPTZ(3),

  CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "work_locations_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "work_locations_company_code_uq"
  ON "work_locations" ("company_id", "code")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "work_locations_company_idx" ON "work_locations" ("company_id");
ALTER TABLE "work_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "work_locations_tenant_isolation" ON "work_locations"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
