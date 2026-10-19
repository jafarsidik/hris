-- Payroll domain (Phase 7, Core HR).
--
-- Tenant-scoped tables for payroll processing:
--   payroll_periods   — pay period calendar with start/end dates and status.
--   salary_structures — base salary per position grade and component definitions.
--   payroll_runs      — processed payroll results per period per employee.
--   payroll_components — earning/deduction line items within a run.
--
-- Additive: no existing table altered. All are RLS-scoped.

CREATE TABLE "payroll_periods" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "code"        TEXT            NOT NULL,
  "name"        TEXT            NOT NULL,
  "start_date"  DATE            NOT NULL,
  "end_date"    DATE            NOT NULL,
  "status"      TEXT            NOT NULL DEFAULT 'DRAFT',
  "pay_date"    DATE,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_periods_company_code_unique" UNIQUE ("company_id", "code"),
  CONSTRAINT "payroll_periods_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "payroll_periods_company_idx" ON "payroll_periods" ("company_id");
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods" ("status");

ALTER TABLE "payroll_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payroll_periods_tenant_isolation" ON "payroll_periods"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "salary_structures" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "position_id" UUID            NOT NULL,
  "base_salary" DECIMAL(15,2)   NOT NULL DEFAULT 0,
  "currency"    TEXT            NOT NULL DEFAULT 'IDR',
  "effective_from" DATE        NOT NULL,
  "effective_to"  DATE,
  "is_active"   BOOLEAN         NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "salary_structures_position_fkey" FOREIGN KEY ("position_id")
    REFERENCES "positions" ("id") ON DELETE CASCADE,
  CONSTRAINT "salary_structures_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "salary_structures_company_idx" ON "salary_structures" ("company_id");
CREATE INDEX "salary_structures_position_idx" ON "salary_structures" ("position_id");

ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_structures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "salary_structures_tenant_isolation" ON "salary_structures"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "payroll_runs" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "period_id"   UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "base_salary" DECIMAL(15,2)   NOT NULL DEFAULT 0,
  "total_earnings" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_deductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "net_pay"     DECIMAL(15,2)   NOT NULL DEFAULT 0,
  "status"      TEXT            NOT NULL DEFAULT 'DRAFT',
  "paid_at"     TIMESTAMPTZ(3),
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_runs_period_employee_unique" UNIQUE ("period_id", "employee_id"),
  CONSTRAINT "payroll_runs_period_fkey" FOREIGN KEY ("period_id")
    REFERENCES "payroll_periods" ("id") ON DELETE CASCADE,
  CONSTRAINT "payroll_runs_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "payroll_runs_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "payroll_runs_company_idx" ON "payroll_runs" ("company_id");
CREATE INDEX "payroll_runs_period_idx" ON "payroll_runs" ("period_id");
CREATE INDEX "payroll_runs_employee_idx" ON "payroll_runs" ("employee_id");
CREATE INDEX "payroll_runs_status_idx" ON "payroll_runs" ("status");

ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payroll_runs_tenant_isolation" ON "payroll_runs"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "payroll_components" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "run_id"      UUID            NOT NULL,
  "component"   TEXT            NOT NULL,
  "type"        TEXT            NOT NULL,
  "amount"      DECIMAL(15,2)   NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_components_run_fkey" FOREIGN KEY ("run_id")
    REFERENCES "payroll_runs" ("id") ON DELETE CASCADE,
  CONSTRAINT "payroll_components_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "payroll_components_company_idx" ON "payroll_components" ("company_id");
CREATE INDEX "payroll_components_run_idx" ON "payroll_components" ("run_id");

ALTER TABLE "payroll_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_components" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payroll_components_tenant_isolation" ON "payroll_components"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
