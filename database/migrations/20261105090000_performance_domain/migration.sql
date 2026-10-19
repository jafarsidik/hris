-- Performance domain (Phase 7, Core HR).
--
-- Tenant-scoped tables for performance management:
--   performance_cycles — review cycles (annual/quarterly windows).
--   performance_goals  — employee goals within a cycle.
--   performance_reviews — manager appraisals per employee per cycle.
--
-- Additive: no existing table altered. All are RLS-scoped.

CREATE TABLE "performance_cycles" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "code"        TEXT            NOT NULL,
  "name"        TEXT            NOT NULL,
  "start_date"  DATE            NOT NULL,
  "end_date"    DATE            NOT NULL,
  "status"      TEXT            NOT NULL DEFAULT 'PLANNED',
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_cycles_company_code_unique" UNIQUE ("company_id", "code"),
  CONSTRAINT "performance_cycles_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "performance_cycles_company_idx" ON "performance_cycles" ("company_id");
CREATE INDEX "performance_cycles_status_idx" ON "performance_cycles" ("status");

ALTER TABLE "performance_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "performance_cycles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "performance_cycles_tenant_isolation" ON "performance_cycles"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "performance_goals" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "cycle_id"    UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "title"       TEXT            NOT NULL,
  "description" TEXT,
  "weight"      INTEGER         NOT NULL DEFAULT 0,
  "progress"    INTEGER         NOT NULL DEFAULT 0,
  "status"      TEXT            NOT NULL DEFAULT 'IN_PROGRESS',
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_goals_cycle_fkey" FOREIGN KEY ("cycle_id")
    REFERENCES "performance_cycles" ("id") ON DELETE CASCADE,
  CONSTRAINT "performance_goals_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "performance_goals_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "performance_goals_company_idx" ON "performance_goals" ("company_id");
CREATE INDEX "performance_goals_cycle_idx" ON "performance_goals" ("cycle_id");
CREATE INDEX "performance_goals_employee_idx" ON "performance_goals" ("employee_id");
CREATE INDEX "performance_goals_status_idx" ON "performance_goals" ("status");

ALTER TABLE "performance_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "performance_goals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "performance_goals_tenant_isolation" ON "performance_goals"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "performance_reviews" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "cycle_id"    UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "reviewer_user_id" UUID,
  "rating"      INTEGER,
  "summary"     TEXT,
  "status"      TEXT            NOT NULL DEFAULT 'DRAFT',
  "submitted_at" TIMESTAMPTZ(3),
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_reviews_cycle_employee_unique" UNIQUE ("cycle_id", "employee_id"),
  CONSTRAINT "performance_reviews_cycle_fkey" FOREIGN KEY ("cycle_id")
    REFERENCES "performance_cycles" ("id") ON DELETE CASCADE,
  CONSTRAINT "performance_reviews_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "performance_reviews_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "performance_reviews_company_idx" ON "performance_reviews" ("company_id");
CREATE INDEX "performance_reviews_cycle_idx" ON "performance_reviews" ("cycle_id");
CREATE INDEX "performance_reviews_employee_idx" ON "performance_reviews" ("employee_id");
CREATE INDEX "performance_reviews_status_idx" ON "performance_reviews" ("status");

ALTER TABLE "performance_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "performance_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY "performance_reviews_tenant_isolation" ON "performance_reviews"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
