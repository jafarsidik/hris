-- ==============================================================================
-- Access & Administration foundation (phase 3)
--
-- Extends the phase 1 platform schema with the tables and columns the Setup /
-- System Administration surface needs:
--
--   * users gains account-lockout, password-rotation and token columns for the
--     authentication flows (login lockout, change/reset password, email
--     verification). Tokens are stored as SHA-256 hashes per ADR 0010.
--   * log_events is the append-only, structured event log behind the Logs
--     surface (activity, access, authentication, security, API, error). The
--     hash-chained audit_logs table remains authoritative for the AUDIT tab.
--   * system_settings holds company-scoped configuration values for the System
--     Settings surface; values are JSON so any type survives a round trip.
--
-- RLS is enabled and FORCED on the new tenant tables, mirroring phase 1. The
-- created_by_user_id foreign keys are kept as plain columns like every other
-- phase 1 table (see the header of schema.prisma): they are enforced by the
-- explicit constraints below, not by a Prisma relation, to avoid a relation
-- cycle with users.
--
-- This file is hand-extended from `prisma migrate diff` output: the generated
-- portion cannot express foreign keys Prisma deliberately does not model, nor
-- row-level security or triggers, all of which this project owns in migrations.
-- ==============================================================================

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'STRING_LIST');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('ACTIVITY', 'ACCESS', 'AUTHENTICATION', 'SECURITY', 'API', 'ERROR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verification_token_hash" TEXT,
ADD COLUMN     "failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ(3),
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(3),
ADD COLUMN     "password_reset_expires_at" TIMESTAMPTZ(3),
ADD COLUMN     "password_reset_token_hash" TEXT;

-- CreateTable
CREATE TABLE "log_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "category" "LogCategory" NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" UUID,
    "resource" TEXT,
    "resource_id" UUID,
    "status" TEXT,
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "log_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "group" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "value_type" "SettingValueType" NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_events_company_id_created_at_idx" ON "log_events"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "log_events_category_created_at_idx" ON "log_events"("category", "created_at" DESC);

-- CreateIndex
CREATE INDEX "log_events_actor_user_id_created_at_idx" ON "log_events"("actor_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "log_events_resource_resource_id_idx" ON "log_events"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "system_settings_company_id_group_idx" ON "system_settings"("company_id", "group");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_company_id_group_key_key" ON "system_settings"("company_id", "group", "key");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_verification_token_hash_key" ON "users"("email_verification_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_hash_key" ON "users"("password_reset_token_hash");

-- ==============================================================================
-- Audit and access-log ownership foreign keys
--
-- Every mutable table carries created_by_user_id, enforced against users(id) the
-- same way phase 1 did: a plain constraint, no Prisma relation, no relation cycle.
-- ==============================================================================

ALTER TABLE "log_events" ADD CONSTRAINT "log_events_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- Tenant isolation
--
-- Both new tables are tenant-scoped and follow the phase 1 pattern: policies
-- filter on app.current_company_id, fail closed when it is unset, and are FORCED
-- so even the table owner cannot bypass them.
-- ==============================================================================

ALTER TABLE "log_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "log_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "log_events_tenant_select" ON "log_events" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "log_events_tenant_insert" ON "log_events" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "system_settings_tenant_select" ON "system_settings" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "system_settings_tenant_insert" ON "system_settings" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "system_settings_tenant_update" ON "system_settings" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "system_settings_tenant_delete" ON "system_settings" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

-- ==============================================================================
-- Append-only event log
--
-- log_events keeps the action and the actor; DATABASE.md requires the same
-- guarantees as audit_logs, so UPDATE, DELETE and TRUNCATE are refused by the
-- database rather than merely omitted by application code.
-- ==============================================================================

CREATE FUNCTION "log_events_append_only"() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'log_events is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "log_events_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "log_events"
  FOR EACH ROW EXECUTE FUNCTION "log_events_append_only"();

CREATE TRIGGER "log_events_no_truncate"
  BEFORE TRUNCATE ON "log_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "log_events_append_only"();

-- ==============================================================================
-- Cross-tenant authentication lookup
--
-- ADR 0010 requires the sign-in lookup to happen "before a tenant is known",
-- which a normal tenant-context query cannot do: with app.current_company_id
-- unset, the users select policy fails closed and login would find nobody.
--
-- This SECURITY DEFINER function is owned by the migration role (a superuser, so
-- it bypasses RLS exactly like the bootstrap), and it exposes the minimum read a
-- sign-in needs. It is the single tenant-agnostic read the application is
-- allowed; everything else runs inside withTenantContext().
--
-- Search path is pinned so a caller cannot hijack the function body resolution,
-- and EXECUTE is revoked from PUBLIC and granted only to the application role by
-- database/scripts/grant-app-privileges.ts, which is the one place that knows the
-- role name (from the environment) and is re-runnable.
-- ==============================================================================

CREATE FUNCTION "app_auth_find_user_by_email"(user_email citext)
RETURNS TABLE (
  "id" uuid,
  "companyId" uuid,
  "email" citext,
  "displayName" text,
  "status" "UserStatus",
  "passwordHash" text,
  "hasVerifiedEmail" boolean,
  "failedAttempts" integer,
  "lockedUntil" timestamptz,
  "passwordChangedAt" timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "company_id", "email", "display_name", "status", "password_hash",
         "has_verified_email", "failed_attempts", "locked_until", "password_changed_at"
  FROM public.users
  WHERE email = user_email AND deleted_at IS NULL
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION "app_auth_find_user_by_email"(citext) FROM PUBLIC;