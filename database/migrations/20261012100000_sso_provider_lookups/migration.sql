-- ==============================================================================
-- Cross-tenant identity-provider lookups for the (pre-session) SSO sign-in flow
--
-- Sign-in runs before a session exists, so there is no company context to set and
-- the row-level-security policies on `identity_providers` would hide every row. These
-- SECURITY DEFINER functions resolve a provider by id (from the redirect URL) and by
-- the email domain a user typed, exposing only the fields the public flow needs.
--
-- EXECUTE is revoked from PUBLIC here; db:grant re-grants it to the application role
-- after every deploy, matching the existing app_auth_find_* convention.
-- ==============================================================================

CREATE FUNCTION "app_sso_find_provider"(provider_id uuid)
RETURNS TABLE (
  "id" uuid,
  "companyId" uuid,
  "name" text,
  "type" "IdentityProviderType",
  "enabled" boolean,
  "domains" jsonb,
  "config" jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "company_id", "name", "type", "enabled", "domains", "config"
  FROM public.identity_providers
  WHERE "id" = provider_id AND "deleted_at" IS NULL
  LIMIT 1
$$;

CREATE FUNCTION "app_sso_find_providers_for_email"(user_email citext)
RETURNS TABLE (
  "id" uuid,
  "name" text,
  "type" "IdentityProviderType"
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "name", "type"
  FROM public.identity_providers
  WHERE "enabled" = true
    AND "deleted_at" IS NULL
    AND "domains" ? lower(split_part(user_email::text, '@', 2))
  ORDER BY "name"
$$;

REVOKE EXECUTE ON FUNCTION "app_sso_find_provider"(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION "app_sso_find_providers_for_email"(citext) FROM PUBLIC;
