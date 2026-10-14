-- ==============================================================================
-- Expose password_reset_expires_at on the cross-tenant authentication lookups
--
-- The register-by-invitation and reset-password flows resolve the owning account by
-- token hash and must enforce the invite/reset expiry. That column was not part of
-- the original function return shapes, so the three functions are redefined here with
-- idempotent drops. Execution privileges are re-applied by db:grant, which always
-- runs after db:deploy.
-- ==============================================================================

DROP FUNCTION IF EXISTS "app_auth_find_user_by_email"(citext);
DROP FUNCTION IF EXISTS "app_auth_find_user_by_reset_token"(text);
DROP FUNCTION IF EXISTS "app_auth_find_user_by_verification_token"(text);

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
  "passwordChangedAt" timestamptz,
  "passwordResetExpiresAt" timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "company_id", "email", "display_name", "status", "password_hash",
         "has_verified_email", "failed_attempts", "locked_until", "password_changed_at",
         "password_reset_expires_at"
  FROM public.users
  WHERE email = user_email AND deleted_at IS NULL
  LIMIT 1
$$;

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
  "passwordChangedAt" timestamptz,
  "passwordResetExpiresAt" timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "company_id", "email", "display_name", "status", "password_hash",
         "has_verified_email", "failed_attempts", "locked_until", "password_changed_at",
         "password_reset_expires_at"
  FROM public.users
  WHERE password_reset_token_hash = token_hash AND deleted_at IS NULL
  LIMIT 1
$$;

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
  "passwordChangedAt" timestamptz,
  "passwordResetExpiresAt" timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT "id", "company_id", "email", "display_name", "status", "password_hash",
         "has_verified_email", "failed_attempts", "locked_until", "password_changed_at",
         "password_reset_expires_at"
  FROM public.users
  WHERE email_verification_token_hash = token_hash AND deleted_at IS NULL
  LIMIT 1
$$;