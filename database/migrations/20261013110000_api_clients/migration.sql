-- Machine credentials for the developer API (Phase 4).
--
-- The secret is never stored in cleartext: only its SHA-256 hash is kept here, the
-- same treatment as an opaque session token. Tenant isolation is enforced by RLS; the
-- API key is presented without a session, so the cross-tenant lookup below is a
-- SECURITY DEFINER function that returns just enough to authenticate the client.

CREATE TABLE "api_clients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "client_id" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "owner_user_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_by_user_id" UUID,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_clients_client_id_key" ON "api_clients"("client_id");
CREATE INDEX "api_clients_company_id_idx" ON "api_clients"("company_id");

ALTER TABLE "api_clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY "api_clients_tenant_isolation" ON "api_clients" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

CREATE FUNCTION "app_api_find_client"(p_client_id text)
RETURNS TABLE (
  "id" uuid,
  "company_id" uuid,
  "name" text,
  "secret_hash" text,
  "scopes" text[],
  "is_active" boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "company_id", "name", "secret_hash", "scopes", "is_active"
  FROM public.api_clients
  WHERE "client_id" = p_client_id AND "deleted_at" IS NULL
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION "app_api_find_client"(text) FROM PUBLIC;
