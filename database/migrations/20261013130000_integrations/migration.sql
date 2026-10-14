-- Integration registry (Phase 5).
--
-- One row per configured adapter instance for a tenant. `config` is non-secret
-- configuration only; secrets stay in encrypted System Settings. Delivery history is
-- append-only and tenant-scoped like the rest of the data plane.

CREATE TYPE "IntegrationKind" AS ENUM ('EMAIL', 'WEBHOOK', 'STORAGE', 'ANALYTICS', 'OTHER');
CREATE TYPE "IntegrationStatus" AS ENUM ('UNKNOWN', 'CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "IntegrationDeliveryDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "IntegrationDeliveryStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'RETRYING');

CREATE TABLE "integrations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "IntegrationKind" NOT NULL,
  "provider" TEXT NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'UNKNOWN',
  "last_checked_at" TIMESTAMPTZ(3),
  "last_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_by_user_id" UUID,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integrations_company_key_key" ON "integrations"("company_id", "key");

CREATE TABLE "integration_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "direction" "IntegrationDeliveryDirection" NOT NULL DEFAULT 'OUTBOUND',
  "operation" TEXT NOT NULL,
  "status" "IntegrationDeliveryStatus" NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "error" TEXT,
  "duration_ms" INTEGER,
  "request" JSONB,
  "response" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_deliveries_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "integrations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "integration_deliveries_integration_created_idx"
  ON "integration_deliveries"("company_id", "integration_id", "created_at" DESC);

ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "integrations_tenant_isolation" ON "integrations" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "integration_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "integration_deliveries_tenant_isolation" ON "integration_deliveries" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
