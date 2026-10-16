-- Tenant (company) control plane (Phase 6b platform).
--
-- Extends the existing company (the tenant root) with lifecycle + plan + quota
-- attributes and adds a privileged, read-only scan used by the platform module that
-- manages companies without weakening row-level security for ordinary traffic.
--
-- Additive: only new columns on an existing table.

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "plan"   TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "seat_limit" INTEGER,
  ADD COLUMN IF NOT EXISTS "storage_quota_bytes" BIGINT;

CREATE OR REPLACE FUNCTION platform_visible_companies()
RETURNS SETOF "companies"
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT c.* FROM "companies" c ORDER BY c."created_at" DESC;
$$;
