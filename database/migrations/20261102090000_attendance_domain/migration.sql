-- Attendance & Time domain (Phase 7, Core HR).
--
-- Two tenant-scoped tables that turn employees into trackable workforce:
--   attendance_records — daily clock-in/clock-out with status and notes.
--   shift_patterns     — reusable shift definitions (start/end, break, workdays).
--
-- Additive: no existing table altered. Both are RLS-scoped like every other
-- tenant-owned table.

CREATE TABLE "attendance_records" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "attendance_date" DATE        NOT NULL,
  "clock_in"    TIMESTAMPTZ(3),
  "clock_out"   TIMESTAMPTZ(3),
  "break_minutes" INTEGER       NOT NULL DEFAULT 0,
  "status"      TEXT            NOT NULL DEFAULT 'PRESENT',
  "notes"       TEXT,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_records_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_records_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_records_unique_day" UNIQUE ("company_id", "employee_id", "attendance_date")
);

CREATE INDEX "attendance_records_company_idx" ON "attendance_records" ("company_id");
CREATE INDEX "attendance_records_employee_idx" ON "attendance_records" ("employee_id");
CREATE INDEX "attendance_records_date_idx" ON "attendance_records" ("attendance_date");
CREATE INDEX "attendance_records_status_idx" ON "attendance_records" ("status");

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_records_tenant_isolation" ON "attendance_records"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "shift_patterns" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "code"        TEXT            NOT NULL,
  "name"        TEXT            NOT NULL,
  "description" TEXT,
  "start_time"  TIME            NOT NULL,
  "end_time"    TIME            NOT NULL,
  "break_minutes" INTEGER       NOT NULL DEFAULT 0,
  "work_days"   TEXT            NOT NULL DEFAULT '1,2,3,4,5',
  "is_active"   BOOLEAN         NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "shift_patterns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shift_patterns_company_code_unique" UNIQUE ("company_id", "code"),
  CONSTRAINT "shift_patterns_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "shift_patterns_company_idx" ON "shift_patterns" ("company_id");

ALTER TABLE "shift_patterns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_patterns" FORCE ROW LEVEL SECURITY;
CREATE POLICY "shift_patterns_tenant_isolation" ON "shift_patterns"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
