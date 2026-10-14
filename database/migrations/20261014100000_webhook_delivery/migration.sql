-- Signed webhooks (Phase 4 pending / 6b).
--
-- The signing secret is an encrypted envelope on the integration row: it is a credential
-- the platform must read back to sign each delivery, so, like TOTP seeds and SSO client
-- secrets, it is stored as `iv.tag.ciphertext` under its own key and never as plaintext.
--
-- Subscriptions are rows rather than an array in `config` so the dispatcher's event match
-- is a join, and any event a tenant receives is explicitly opted into. `event_type = '*'`
-- subscribes to every event.

ALTER TABLE "integrations" ADD COLUMN "secret_ciphertext" TEXT;

CREATE TABLE "webhook_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" UUID,
  CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhook_subscriptions_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "integrations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "webhook_subscriptions_integration_event_key"
  ON "webhook_subscriptions"("integration_id", "event_type");

ALTER TABLE "webhook_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "webhook_subscriptions_tenant_isolation" ON "webhook_subscriptions" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
