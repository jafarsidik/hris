-- ==============================================================================
-- Enterprise notifications & security (notifications, MFA, SSO, WebAuthn, approvals)
--
-- Adds the tenant-scoped tables behind the completed System (M00) surface:
--
--   * notifications / notification_preferences / notification_templates  - the
--     in-app notification platform with per-recipient channel toggles and
--     per-event renderable templates.
--   * mfa_factors / mfa_recovery_codes - TOTP enrolment and one-time recovery
--     codes. Factor secrets are AES-256-GCM encrypted in application code; the
--     database only ever stores ciphertext.
--   * identity_providers / sso_identities - OIDC and SAML providers plus the
--     map from a provider subject to a local user.
--   * authenticators - WebAuthn passkeys registered by users.
--   * approval_authorities / approval_delegations - approval limits and
--     temporary delegation authority.
--
-- Every tenant table follows the phase 1/3 pattern: enable AND force RLS, filter
-- on app.current_company_id(), fail closed when it is unset, and carry the
-- created_by_user_id FK as a plain constraint (see schema.prisma header).
-- ==============================================================================

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "MfaFactorType" AS ENUM ('TOTP');

-- CreateEnum
CREATE TYPE "IdentityProviderType" AS ENUM ('OIDC', 'SAML');

-- CreateEnum
CREATE TYPE "ApprovalSubjectType" AS ENUM ('USER', 'ROLE');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "event_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "href" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "delivery_status" "NotificationDeliveryStatus" NOT NULL,
    "correlation_id" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject_template" TEXT NOT NULL,
    "body_template" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MfaFactorType" NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Default authenticator',
    "confirmed_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IdentityProviderType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "domains" JSONB,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "email" CITEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "sso_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" JSONB,
    "device_name" TEXT,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "authenticators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_authorities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "subject_type" "ApprovalSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "resource" TEXT,
    "category" TEXT,
    "max_amount" DECIMAL(18,2),
    "currency_code" CITEXT,
    "effective_from" TIMESTAMPTZ(3),
    "effective_to" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "approval_authorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_delegations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "delegator_user_id" UUID NOT NULL,
    "delegatee_user_id" UUID NOT NULL,
    "resource" TEXT,
    "category" TEXT,
    "effective_from" TIMESTAMPTZ(3),
    "effective_to" TIMESTAMPTZ(3),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "approval_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_company_user_created_idx" ON "notifications"("company_id", "user_id", "created_at" DESC);
CREATE INDEX "notifications_company_status_idx" ON "notifications"("company_id", "delivery_status");
CREATE UNIQUE INDEX "notification_preferences_company_user_channel_key" ON "notification_preferences"("company_id", "user_id", "channel");
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");
CREATE UNIQUE INDEX "notification_templates_company_event_channel_key" ON "notification_templates"("company_id", "event_key", "channel");
CREATE INDEX "mfa_factors_company_user_idx" ON "mfa_factors"("company_id", "user_id");
CREATE INDEX "mfa_recovery_codes_company_user_idx" ON "mfa_recovery_codes"("company_id", "user_id");
CREATE INDEX "mfa_recovery_codes_code_hash_idx" ON "mfa_recovery_codes"("code_hash");
CREATE INDEX "identity_providers_company_enabled_idx" ON "identity_providers"("company_id", "enabled");
CREATE UNIQUE INDEX "sso_identities_provider_subject_key" ON "sso_identities"("provider_id", "subject");
CREATE INDEX "sso_identities_company_user_idx" ON "sso_identities"("company_id", "user_id");
CREATE UNIQUE INDEX "authenticators_company_credential_key" ON "authenticators"("company_id", "credential_id");
CREATE INDEX "authenticators_company_user_idx" ON "authenticators"("company_id", "user_id");
CREATE INDEX "approval_authorities_company_subject_idx" ON "approval_authorities"("company_id", "subject_id");
CREATE INDEX "approval_delegations_company_delegator_idx" ON "approval_delegations"("company_id", "delegator_user_id");

-- ==============================================================================
-- Ownership foreign keys
-- ==============================================================================

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_user_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_authorities" ADD CONSTRAINT "approval_authorities_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_delegations" ADD CONSTRAINT "approval_delegations_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- Tenant isolation
-- ==============================================================================

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notifications_tenant_select" ON "notifications" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "notifications_tenant_insert" ON "notifications" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "notifications_tenant_update" ON "notifications" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "notifications_tenant_delete" ON "notifications" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_preferences_tenant_select" ON "notification_preferences" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "notification_preferences_tenant_insert" ON "notification_preferences" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "notification_preferences_tenant_update" ON "notification_preferences" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "notification_preferences_tenant_delete" ON "notification_preferences" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_templates_tenant_select" ON "notification_templates" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "notification_templates_tenant_insert" ON "notification_templates" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "notification_templates_tenant_update" ON "notification_templates" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "notification_templates_tenant_delete" ON "notification_templates" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "mfa_factors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_factors" FORCE ROW LEVEL SECURITY;
CREATE POLICY "mfa_factors_tenant_select" ON "mfa_factors" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "mfa_factors_tenant_insert" ON "mfa_factors" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "mfa_factors_tenant_update" ON "mfa_factors" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "mfa_factors_tenant_delete" ON "mfa_factors" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "mfa_recovery_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mfa_recovery_codes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "mfa_recovery_codes_tenant_select" ON "mfa_recovery_codes" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "mfa_recovery_codes_tenant_insert" ON "mfa_recovery_codes" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "mfa_recovery_codes_tenant_update" ON "mfa_recovery_codes" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "mfa_recovery_codes_tenant_delete" ON "mfa_recovery_codes" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "identity_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identity_providers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "identity_providers_tenant_select" ON "identity_providers" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "identity_providers_tenant_insert" ON "identity_providers" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "identity_providers_tenant_update" ON "identity_providers" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "identity_providers_tenant_delete" ON "identity_providers" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "sso_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sso_identities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sso_identities_tenant_select" ON "sso_identities" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "sso_identities_tenant_insert" ON "sso_identities" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "sso_identities_tenant_update" ON "sso_identities" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "sso_identities_tenant_delete" ON "sso_identities" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "authenticators" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "authenticators" FORCE ROW LEVEL SECURITY;
CREATE POLICY "authenticators_tenant_select" ON "authenticators" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "authenticators_tenant_insert" ON "authenticators" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "authenticators_tenant_update" ON "authenticators" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "authenticators_tenant_delete" ON "authenticators" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "approval_authorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_authorities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "approval_authorities_tenant_select" ON "approval_authorities" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "approval_authorities_tenant_insert" ON "approval_authorities" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "approval_authorities_tenant_update" ON "approval_authorities" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "approval_authorities_tenant_delete" ON "approval_authorities" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

ALTER TABLE "approval_delegations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_delegations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "approval_delegations_tenant_select" ON "approval_delegations" FOR SELECT
  USING ("company_id" = "app_current_company_id"());
CREATE POLICY "approval_delegations_tenant_insert" ON "approval_delegations" FOR INSERT
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "approval_delegations_tenant_update" ON "approval_delegations" FOR UPDATE
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
CREATE POLICY "approval_delegations_tenant_delete" ON "approval_delegations" FOR DELETE
  USING ("company_id" = "app_current_company_id"());

-- ==============================================================================
-- Default notification templates
--
-- Provisioned per tenant by the seed (database/seeds/notifications.ts); nothing
-- here, so a company created later starts with the same catalogued defaults that
-- the seed applies idempotently.
-- ==============================================================================