-- Leave domain (Phase 7, Core HR).
--
-- Three tenant-scoped tables that turn employee records into leavable people:
--   leave_types   — catalogue of leave kinds (annual, sick, maternity, etc.)
--   leave_policies — per-company entitlement overrides for each leave type
--   leave_requests — employee leave requests with approval lifecycle
--
-- Additive: no existing table altered. All three are RLS-scoped like every other
-- tenant-owned table.

CREATE TABLE "leave_types" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "code"        TEXT            NOT NULL,
  "name"        TEXT            NOT NULL,
  "description" TEXT,
  "is_paid"     BOOLEAN         NOT NULL DEFAULT true,
  "default_days" INTEGER        NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN         NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leave_types_company_code_unique" UNIQUE ("company_id", "code"),
  CONSTRAINT "leave_types_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "leave_types_company_idx" ON "leave_types" ("company_id");

ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY "leave_types_tenant_isolation" ON "leave_types"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "leave_policies" (
  "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID            NOT NULL,
  "leave_type_id" UUID            NOT NULL,
  "annual_days"   INTEGER         NOT NULL,
  "carry_forward" BOOLEAN         NOT NULL DEFAULT false,
  "is_active"     BOOLEAN         NOT NULL DEFAULT true,
  "created_at"    TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"    TIMESTAMPTZ(3),

  CONSTRAINT "leave_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leave_policies_company_type_unique" UNIQUE ("company_id", "leave_type_id"),
  CONSTRAINT "leave_policies_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "leave_policies_leave_type_fkey" FOREIGN KEY ("leave_type_id")
    REFERENCES "leave_types" ("id") ON DELETE CASCADE
);

CREATE INDEX "leave_policies_company_idx" ON "leave_policies" ("company_id");
CREATE INDEX "leave_policies_type_idx" ON "leave_policies" ("leave_type_id");

ALTER TABLE "leave_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "leave_policies_tenant_isolation" ON "leave_policies"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "leave_requests" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "leave_type_id" UUID          NOT NULL,
  "start_date"  TIMESTAMPTZ(3)  NOT NULL,
  "end_date"    TIMESTAMPTZ(3)  NOT NULL,
  "days"        DECIMAL(5,2)    NOT NULL,
  "reason"      TEXT,
  "status"      TEXT            NOT NULL DEFAULT 'PENDING',
  "approver_id" UUID,
  "approved_at" TIMESTAMPTZ(3),
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leave_requests_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "leave_requests_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "leave_requests_leave_type_fkey" FOREIGN KEY ("leave_type_id")
    REFERENCES "leave_types" ("id") ON DELETE CASCADE
);

CREATE INDEX "leave_requests_company_idx" ON "leave_requests" ("company_id");
CREATE INDEX "leave_requests_employee_idx" ON "leave_requests" ("employee_id");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" ("status");

ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "leave_requests_tenant_isolation" ON "leave_requests"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
