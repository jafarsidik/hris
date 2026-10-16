-- Idempotency keys (Phase 5, workflow & automation).
--
-- Stored response for a retried request so a client can safely retry a `POST` without
-- duplicating the side effect. Keyed per tenant, user, route and the header value the
-- client supplied, so two different users or routes never collide and a different
-- body on the same key is rejected (409) rather than replayed. Additive.
CREATE TABLE "idempotency_keys" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID        NOT NULL,
  "user_id"      UUID        NOT NULL,
  "route"        TEXT        NOT NULL,
  "key"          TEXT        NOT NULL,
  "request_hash" TEXT        NOT NULL,
  "status_code"  INTEGER,
  "response_body" JSONB,
  "expires_at"   TIMESTAMPTZ(3) NOT NULL,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ(3),

  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_keys_unique" UNIQUE ("company_id","user_id","route","key")
);

CREATE INDEX "idempotency_keys_expires_idx" ON "idempotency_keys" ("expires_at");

ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;

CREATE POLICY "idempotency_keys_tenant_isolation" ON "idempotency_keys"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
