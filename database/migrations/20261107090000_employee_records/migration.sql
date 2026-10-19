-- Employee Data domain (Wave 1, HR core CRUD).
--
-- Seven tenant-scoped sub-record tables owned by an employee:
--   employee_contacts       — emergency contacts.
--   employee_family         — family members; flagged rows are dependents.
--   employee_education      — education history.
--   employee_experience     — previous employment history.
--   employee_skills         — skills with proficiency.
--   employee_certifications — certifications with validity.
--   employee_documents      — contracts, certificates and HR documents.
--
-- Additive: no existing table altered. All are RLS-scoped and soft-deleted.

CREATE TABLE "employee_contacts" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "name"        TEXT            NOT NULL,
  "relationship" TEXT           NOT NULL,
  "phone"       TEXT            NOT NULL,
  "email"       TEXT,
  "address"     TEXT,
  "is_primary"  BOOLEAN         NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_contacts_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_contacts_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_contacts_company_idx" ON "employee_contacts" ("company_id");
CREATE INDEX "employee_contacts_employee_idx" ON "employee_contacts" ("employee_id");
ALTER TABLE "employee_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_contacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_contacts_tenant_isolation" ON "employee_contacts"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_family" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "full_name"   TEXT            NOT NULL,
  "relationship" TEXT           NOT NULL,
  "birth_date"  DATE,
  "occupation"  TEXT,
  "is_dependent" BOOLEAN        NOT NULL DEFAULT false,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_family_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_family_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_family_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_family_company_idx" ON "employee_family" ("company_id");
CREATE INDEX "employee_family_employee_idx" ON "employee_family" ("employee_id");
ALTER TABLE "employee_family" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_family" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_family_tenant_isolation" ON "employee_family"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_education" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "level"       TEXT            NOT NULL,
  "institution" TEXT            NOT NULL,
  "major"       TEXT,
  "start_year"  INTEGER         NOT NULL,
  "end_year"    INTEGER,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_education_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_education_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_education_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_education_company_idx" ON "employee_education" ("company_id");
CREATE INDEX "employee_education_employee_idx" ON "employee_education" ("employee_id");
ALTER TABLE "employee_education" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_education" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_education_tenant_isolation" ON "employee_education"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_experience" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "company_name" TEXT           NOT NULL,
  "position_title" TEXT         NOT NULL,
  "start_date"  DATE            NOT NULL,
  "end_date"    DATE,
  "description" TEXT,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_experience_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_experience_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_experience_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_experience_company_idx" ON "employee_experience" ("company_id");
CREATE INDEX "employee_experience_employee_idx" ON "employee_experience" ("employee_id");
ALTER TABLE "employee_experience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_experience" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_experience_tenant_isolation" ON "employee_experience"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_skills" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "name"        TEXT            NOT NULL,
  "proficiency" TEXT            NOT NULL DEFAULT 'BEGINNER',
  "years_of_experience" INTEGER,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_skills_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_skills_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_skills_company_idx" ON "employee_skills" ("company_id");
CREATE INDEX "employee_skills_employee_idx" ON "employee_skills" ("employee_id");
ALTER TABLE "employee_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_skills" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_skills_tenant_isolation" ON "employee_skills"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_certifications" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "name"        TEXT            NOT NULL,
  "issuer"      TEXT            NOT NULL,
  "issue_date"  DATE            NOT NULL,
  "expiry_date" DATE,
  "credential_id" TEXT,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_certifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_certifications_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_certifications_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_certifications_company_idx" ON "employee_certifications" ("company_id");
CREATE INDEX "employee_certifications_employee_idx" ON "employee_certifications" ("employee_id");
ALTER TABLE "employee_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_certifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_certifications_tenant_isolation" ON "employee_certifications"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "employee_documents" (
  "id"          UUID            NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID            NOT NULL,
  "employee_id" UUID            NOT NULL,
  "title"       TEXT            NOT NULL,
  "category"    TEXT            NOT NULL,
  "file_url"    TEXT,
  "expiry_date" DATE,
  "note"        TEXT,
  "created_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3)  NOT NULL DEFAULT now(),
  "created_by_user_id" UUID,
  "deleted_at"  TIMESTAMPTZ(3),

  CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "employee_documents_employee_fkey" FOREIGN KEY ("employee_id")
    REFERENCES "employees" ("id") ON DELETE CASCADE,
  CONSTRAINT "employee_documents_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies" ("id") ON DELETE CASCADE
);
CREATE INDEX "employee_documents_company_idx" ON "employee_documents" ("company_id");
CREATE INDEX "employee_documents_employee_idx" ON "employee_documents" ("employee_id");
ALTER TABLE "employee_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY "employee_documents_tenant_isolation" ON "employee_documents"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
