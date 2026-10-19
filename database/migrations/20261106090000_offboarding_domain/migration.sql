-- Offboarding domain (Phase 7, Core HR).
--
-- Tenant-scoped tables for employee exits:
--   offboarding_cases         — one exit case per departing employee.
--   offboarding_checklist_items — clearance checklist lines within a case.
--
-- Additive: no existing table altered. Both are RLS-scoped.

CREATE TABLE "offboarding_cases" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "reason"      TEXT            NOT NULL,
  "last_working_date" DATE      NOT NULL,
  "status"      TEXT            NOT NULL DEFAULT 'INITIATED',
  "exit_interview_notes" TEXT,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "offboarding_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offboarding_cases_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "offboarding_cases_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "offboarding_cases_company_idx" ON "offboarding_cases" ("company_id");
CREATE INDEX "offboarding_cases_employee_idx" ON "offboarding_cases" ("employee_id");
CREATE INDEX "offboarding_cases_status_idx" ON "offboarding_cases" ("status");

ALTER TABLE "offboarding_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offboarding_cases" FORCE ROW LEVEL SECURITY;
CREATE POLICY "offboarding_cases_tenant_isolation" ON "offboarding_cases"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "offboarding_checklist_items" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "case_id"     UUID            NOT NULL,
  "task"        TEXT            NOT NULL,
  "is_done"     BOOLEAN         NOT NULL DEFAULT false,
  "completed_at" TIMESTAMPTZ(3),
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "offboarding_checklist_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "offboarding_checklist_items_case_fkey" FOREIGN KEY ("case_id")
    REFERENCES "offboarding_cases" ("id") ON DELETE CASCADE,
  CONSTRAINT "offboarding_checklist_items_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "offboarding_checklist_items_company_idx" ON "offboarding_checklist_items" ("company_id");
CREATE INDEX "offboarding_checklist_items_case_idx" ON "offboarding_checklist_items" ("case_id");

ALTER TABLE "offboarding_checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offboarding_checklist_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "offboarding_checklist_items_tenant_isolation" ON "offboarding_checklist_items"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
