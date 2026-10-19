-- Employee master data (Phase 7, Core HR).
--
-- Two tenant-scoped tables that turn the identity `User` into an employed person:
--   positions   — job-title catalogue tied to an organizational unit.
--   employees   — employment record linking a User to a unit, position and tenure.
--
-- Additive: no existing table altered. Both are RLS-scoped like every other
-- tenant-owned table.

CREATE TABLE "positions" (
  "id"                 UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"         UUID            NOT NULL,
  "code"               TEXT            NOT NULL,
  "name"               TEXT            NOT NULL,
  "description"        TEXT,
  "organizational_unit_id" UUID,
  "job_grade"          TEXT,
  "is_active"          BOOLEAN         NOT NULL DEFAULT true,
  "created_at"         TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"         TIMESTAMPTZ(3),

  CONSTRAINT "positions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "positions_company_code_unique" UNIQUE ("company_id", "code"),
  CONSTRAINT "positions_unit_fkey" FOREIGN KEY ("organizational_unit_id")
    REFERENCES "organizational_units" ("id")
    ON DELETE SET NULL
);

CREATE INDEX "positions_company_idx" ON "positions" ("company_id");
CREATE INDEX "positions_unit_idx" ON "positions" ("organizational_unit_id");

ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "positions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "positions_tenant_isolation" ON "positions"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employees" (
  "id"                 UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"         UUID            NOT NULL,
  "user_id"            UUID            NOT NULL,
  "employee_number"    TEXT            NOT NULL,
  "organizational_unit_id" UUID,
  "position_id"        UUID,
  "employment_type"    TEXT            NOT NULL,
  "status"             TEXT            NOT NULL,
  "hire_date"          TIMESTAMPTZ(3)  NOT NULL,
  "termination_date"   TIMESTAMPTZ(3),
  "created_at"         TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"         TIMESTAMPTZ(3),

  CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employees_company_number_unique" UNIQUE ("company_id", "employee_number"),
  CONSTRAINT "employees_user_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id")
    ON DELETE CASCADE,
  CONSTRAINT "employees_unit_fkey" FOREIGN KEY ("organizational_unit_id")
    REFERENCES "organizational_units" ("id")
    ON DELETE SET NULL,
  CONSTRAINT "employees_position_fkey" FOREIGN KEY ("position_id")
    REFERENCES "positions" ("id")
    ON DELETE SET NULL
);

CREATE INDEX "employees_company_idx" ON "employees" ("company_id");
CREATE INDEX "employees_user_idx" ON "employees" ("user_id");
CREATE INDEX "employees_unit_idx" ON "employees" ("organizational_unit_id");
CREATE INDEX "employees_position_idx" ON "employees" ("position_id");

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employees" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employees_tenant_isolation" ON "employees"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
