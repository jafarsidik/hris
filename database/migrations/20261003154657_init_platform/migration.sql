-- CreateEnum
CREATE TYPE "Action" AS ENUM ('view', 'create', 'update', 'delete', 'approve', 'reject', 'export', 'download', 'manage');

-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('SELF', 'TEAM', 'DEPARTMENT', 'ENTITY', 'COMPANY', 'GLOBAL');

-- CreateEnum
CREATE TYPE "OrganizationalUnitType" AS ENUM ('DIVISION', 'DEPARTMENT', 'SECTION', 'TEAM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minor_unit" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" "Action" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "data_scope" "DataScope" NOT NULL DEFAULT 'SELF',
    "scope_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" CITEXT NOT NULL,
    "currency_code" CITEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizational_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "entity_id" UUID,
    "parent_id" UUID,
    "type" "OrganizationalUnitType" NOT NULL,
    "code" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "organizational_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "password_hash" TEXT,
    "has_verified_email" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "company_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" INET,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" UUID,
    "payload" JSONB,
    "previous_hash" TEXT,
    "entry_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_resource_idx" ON "permissions"("resource");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_permission_scope_key" ON "role_permissions"("role_id", "permission_id", "data_scope");

-- CreateIndex
CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "entities_company_id_idx" ON "entities"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "entities_company_id_code_key" ON "entities"("company_id", "code");

-- CreateIndex
CREATE INDEX "organizational_units_company_id_parent_id_idx" ON "organizational_units"("company_id", "parent_id");

-- CreateIndex
CREATE INDEX "organizational_units_entity_id_idx" ON "organizational_units"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizational_units_company_id_code_key" ON "organizational_units"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_company_id_idx" ON "user_roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_company_id_key" ON "user_roles"("user_id", "role_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_company_id_idx" ON "sessions"("company_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_entry_hash_key" ON "audit_logs"("entry_hash");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- ==============================================================================
-- Integrity for created_by_user_id
--
-- Declared as plain uuid columns in schema.prisma (see the note at the top of that
-- file) but still enforced here, so provenance is guaranteed by the database and not
-- merely by convention. `companies` and `users` reference each other, so these
-- constraints are added after both tables exist.
-- ==============================================================================

ALTER TABLE "countries" ADD CONSTRAINT "countries_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entities" ADD CONSTRAINT "entities_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- Tenant isolation
--
-- `DATABASE.md` requires `SET LOCAL app.current_company_id` at the start of a
-- transaction, with policies filtering on it. The value is read through a function
-- so the cast and the empty-string case are handled in exactly one place:
--
--   * unset  -> NULL -> `company_id = NULL` is NULL -> no rows. Fail closed.
--   * set    -> the tenant's uuid.
--
-- Note that `ENABLE ROW LEVEL SECURITY` alone is not enough. A table owner bypasses
-- its own policies unless `FORCE ROW LEVEL SECURITY` is also set, and the
-- `POSTGRES_USER` role created by the official image is both the owner and a
-- superuser. Without FORCE, every policy below would be inert and the isolation
-- would be decorative. `tests/row-level-security.spec.ts` exists to catch exactly
-- that regression.
-- ==============================================================================

CREATE FUNCTION "app_current_company_id"() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid; $$;

ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "companies_tenant_select" ON "companies" FOR SELECT
  USING ("id" = "app_current_company_id"());
CREATE POLICY "companies_tenant_update" ON "companies" FOR UPDATE
  USING ("id" = "app_current_company_id"())
  WITH CHECK ("id" = "app_current_company_id"());
CREATE POLICY "companies_tenant_delete" ON "companies" FOR DELETE
  USING ("id" = "app_current_company_id"());
-- Creating a tenant cannot satisfy `id = current_setting(...)`, because the id does
-- not exist yet. Provisioning is therefore an explicit opt-in performed by an
-- administrative script, never something a request can reach by omitting its
-- tenant context. Reads and writes stay fail-closed.
CREATE POLICY "companies_tenant_provision" ON "companies" FOR INSERT
  WITH CHECK (current_setting('app.allow_company_provisioning', true) = 'on');

ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "entities_tenant_isolation" ON "entities" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "organizational_units" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizational_units" FORCE ROW LEVEL SECURITY;
CREATE POLICY "organizational_units_tenant_isolation" ON "organizational_units" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY "users_tenant_isolation" ON "users" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sessions_tenant_isolation" ON "sessions" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_tenant_select" ON "audit_logs" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "audit_logs_tenant_insert" ON "audit_logs" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_roles" FORCE ROW LEVEL SECURITY;

-- `user_roles` needs asymmetric policies. A NULL `company_id` is a platform-wide
-- grant that every tenant may read, because it applies to all of them. It is not
-- writable from a tenant context: allowing that would let a request grant itself a
-- global role by leaving its tenant context unset.
CREATE POLICY "user_roles_tenant_select" ON "user_roles" FOR SELECT
  USING ("company_id" IS NULL OR "company_id" = "app_current_company_id"());
CREATE POLICY "user_roles_tenant_insert" ON "user_roles" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "user_roles_tenant_update" ON "user_roles" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "user_roles_tenant_delete" ON "user_roles" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

-- ==============================================================================
-- Append-only audit log
--
-- `DATABASE.md` requires an audit row to keep its action and lose only the identity
-- on an erasure request. That is incompatible with UPDATE and DELETE, so both are
-- refused by the database rather than merely omitted by application code. The
-- hash chain makes a silent edit detectable; this trigger is what prevents it.
-- ==============================================================================

CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "audit_logs_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_append_only"();

-- Least privilege is applied by docker/postgres/init, not here.
--
-- The policies above are inert unless the connecting role is neither a superuser
-- nor the table owner bypassing them. The official image creates POSTGRES_USER as a
-- superuser, so the cluster bootstrap demotes it to NOSUPERUSER NOBYPASSRLS.
--
-- It cannot be done in this file: PostgreSQL refuses to let a session remove the
-- SUPERUSER attribute from the role it is connected as ("permission denied to alter
-- role / The bootstrap superuser must have the SUPERUSER attribute"). The demotion
-- has to be executed by a different, more privileged session, which only the
-- bootstrap has.
