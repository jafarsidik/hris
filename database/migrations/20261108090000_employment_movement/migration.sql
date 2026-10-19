-- Employment & Movement domain (Wave 2, HR core CRUD).
--
-- Two tenant-scoped tables owned by an employee:
--   employment_contracts — signed employment agreements (permanent, fixed
--     term, probation, internship) with validity and status.
--   employee_movements   — transfers, promotions and role changes over time;
--     unit and position names are snapshotted so history stays accurate
--     after organizational renames.
--
-- Additive: no existing table altered. Both are RLS-scoped and soft-deleted.

CREATE TABLE "employment_contracts" (
  "id"             UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID            NOT NULL,
  "employee_id"    UUID            NOT NULL,
  "contract_number" TEXT           NOT NULL,
  "contract_type"  TEXT            NOT NULL,
  "start_date"     DATE            NOT NULL,
  "end_date"       DATE,
  "status"         TEXT            NOT NULL DEFAULT 'ACTIVE',
  "signed_date"    DATE,
  "notes"          TEXT,
  "created_at"     TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"     TIMESTAMPTZ(3),

  CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employment_contracts_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employment_contracts_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "employment_contracts_company_number_uq"
  ON "employment_contracts" ("company_id", "contract_number")
  WHERE "deleted_at" IS NULL;
CREATE INDEX "employment_contracts_company_idx" ON "employment_contracts" ("company_id");
CREATE INDEX "employment_contracts_employee_idx" ON "employment_contracts" ("employee_id");
ALTER TABLE "employment_contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employment_contracts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employment_contracts_tenant_isolation" ON "employment_contracts"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_movements" (
  "id"                 UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"         UUID            NOT NULL,
  "employee_id"        UUID            NOT NULL,
  "movement_type"      TEXT            NOT NULL,
  "effective_date"     DATE            NOT NULL,
  "from_unit_name"     TEXT,
  "to_unit_name"       TEXT,
  "from_position_name" TEXT,
  "to_position_name"   TEXT,
  "reason"             TEXT,
  "created_at"         TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"         TIMESTAMPTZ(3),

  CONSTRAINT "employee_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_movements_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_movements_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_movements_company_idx" ON "employee_movements" ("company_id");
CREATE INDEX "employee_movements_employee_idx" ON "employee_movements" ("employee_id");
ALTER TABLE "employee_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_movements_tenant_isolation" ON "employee_movements"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
