-- ==============================================================================
-- Cross-tenant token lookups (authentication flows)
--
-- Password-reset and email-verification endpoints receive only an opaque token and
-- must resolve the owning account before any tenant is known, exactly like the
-- email lookup in ...access_admin_foundation. These two SECURITY DEFINER functions
-- are created by the migration owner (a superuser, hence bypassing RLS) and expose
-- the same minimal read; EXECUTE is revoked from PUBLIC and granted only to the
-- application role by database/scripts/grant-app-privileges.ts.
-- ==============================================================================

CREATE FUNCTION "app_auth_find_user_by_reset_token"(token_hash text)
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
  WHERE password_reset_token_hash = token_hash AND deleted_at IS NULL
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION "app_auth_find_user_by_reset_token"(text) FROM PUBLIC;

CREATE FUNCTION "app_auth_find_user_by_verification_token"(token_hash text)
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
  WHERE email_verification_token_hash = token_hash AND deleted_at IS NULL
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION "app_auth_find_user_by_verification_token"(text) FROM PUBLIC;