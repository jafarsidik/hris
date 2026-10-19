-- Recruitment domain (Phase 7, Core HR).
--
-- Tenant-scoped tables for hiring:
--   job_requisitions  — approved headcount requests per position.
--   job_candidates    — external people in the candidate pool.
--   job_applications  — a candidate applying to one requisition (pipeline).
--
-- Additive: no existing table altered. All are RLS-scoped.

CREATE TABLE "job_requisitions" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "code"        TEXT            NOT NULL,
  "title"       TEXT            NOT NULL,
  "position_id" UUID,
  "department"  TEXT,
  "headcount"   INTEGER         NOT NULL DEFAULT 1,
  "status"      TEXT            NOT NULL DEFAULT 'DRAFT',
  "opened_at"   TIMESTAMPTZ(3),
  "closed_at"   TIMESTAMPTZ(3),
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "job_requisitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_requisitions_company_code_unique" UNIQUE ("company_id", "code"),
  CONSTRAINT "job_requisitions_position_fkey" FOREIGN KEY ("position_id")
    REFERENCES "positions" ("id") ON DELETE SET NULL,
  CONSTRAINT "job_requisitions_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "job_requisitions_company_idx" ON "job_requisitions" ("company_id");
CREATE INDEX "job_requisitions_status_idx" ON "job_requisitions" ("status");

ALTER TABLE "job_requisitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_requisitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "job_requisitions_tenant_isolation" ON "job_requisitions"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "job_candidates" (
  "id"             UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID            NOT NULL,
  "full_name"      TEXT            NOT NULL,
  "email"          TEXT            NOT NULL,
  "phone"          TEXT,
  "source"         TEXT,
  "resume_summary" TEXT,
  "created_at"     TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"     TIMESTAMPTZ(3),

  CONSTRAINT "job_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_candidates_company_email_unique" UNIQUE ("company_id", "email"),
  CONSTRAINT "job_candidates_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "job_candidates_company_idx" ON "job_candidates" ("company_id");

ALTER TABLE "job_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_candidates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "job_candidates_tenant_isolation" ON "job_candidates"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "job_applications" (
  "id"             UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"     UUID            NOT NULL,
  "requisition_id" UUID            NOT NULL,
  "candidate_id"   UUID            NOT NULL,
  "stage"          TEXT            NOT NULL DEFAULT 'APPLIED',
  "rating"         INTEGER,
  "notes"          TEXT,
  "decided_at"     TIMESTAMPTZ(3),
  "created_at"     TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"     TIMESTAMPTZ(3),

  CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_applications_requisition_candidate_unique" UNIQUE ("requisition_id", "candidate_id"),
  CONSTRAINT "job_applications_requisition_fkey" FOREIGN KEY ("requisition_id")
    REFERENCES "job_requisitions" ("id") ON DELETE CASCADE,
  CONSTRAINT "job_applications_candidate_fkey" FOREIGN KEY ("candidate_id")
    REFERENCES "job_candidates" ("id") ON DELETE CASCADE,
  CONSTRAINT "job_applications_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);

CREATE INDEX "job_applications_company_idx" ON "job_applications" ("company_id");
CREATE INDEX "job_applications_requisition_idx" ON "job_applications" ("requisition_id");
CREATE INDEX "job_applications_stage_idx" ON "job_applications" ("stage");

ALTER TABLE "job_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_applications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "job_applications_tenant_isolation" ON "job_applications"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
