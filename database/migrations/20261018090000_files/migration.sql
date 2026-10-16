-- Files (Phase 5, storage).
--
-- Metadata for objects held in the S3-compatible object store. The row is written
-- before the bytes so the API can mint a presigned upload; `status` only becomes
-- AVAILABLE after a HEAD confirms the object exists. Additive: no existing table is
-- altered.

CREATE TYPE "FileObjectStatus" AS ENUM ('PENDING', 'AVAILABLE', 'DELETED');

CREATE TABLE "files" (
  "id"                UUID             NOT NULL DEFAULT gen_random_uuid(),
  "company_id"        UUID             NOT NULL,
  "name"              TEXT             NOT NULL,
  "mime_type"         TEXT             NOT NULL,
  "size"              BIGINT,
  "storage_key"       TEXT             NOT NULL,
  "bucket"            TEXT             NOT NULL,
  "checksum"          TEXT,
  "status"            "FileObjectStatus" NOT NULL DEFAULT 'PENDING',
  "entity"            TEXT,
  "entity_id"         UUID,
  "retention_days"    INTEGER,
  "retention_until"   TIMESTAMPTZ(3),
  "uploaded_by_user_id" UUID,
  "created_at"        TIMESTAMPTZ(3)   NOT NULL DEFAULT now(),
  "updated_at"        TIMESTAMPTZ(3)   NOT NULL DEFAULT now(),
  "removed_at"        TIMESTAMPTZ(3),

  CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "files_storage_key_key" ON "files" ("storage_key");
CREATE INDEX "files_company_status_idx" ON "files" ("company_id", "status");
CREATE INDEX "files_company_entity_idx" ON "files" ("company_id", "entity", "entity_id");
CREATE INDEX "files_status_retention_idx" ON "files" ("status", "retention_until");

-- Enable RLS and force it for all roles (same pattern as workflow_tasks).
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;

-- RLS policy: a row is visible only inside the tenant that owns it. The tenant context is
-- set by the application via `SET LOCAL app.current_company_id = '...'`.
CREATE POLICY "files_tenant_isolation" ON "files"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
