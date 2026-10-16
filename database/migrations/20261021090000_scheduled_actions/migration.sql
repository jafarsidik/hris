-- Scheduled actions (Phase 5, workflow & automation).
--
-- A scheduled action is a named cron trigger plus an action. The runner claims due
-- rows atomically, executes them in-process and records the outcome, so the same
-- company-wide trigger cannot fire twice on two API replicas. Keeping the
-- enumeration privileged via the function below is what lets the runner scan every
-- tenant without weakening RLS for ordinary traffic.
CREATE TABLE "scheduled_actions" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID           NOT NULL,
  "name"         TEXT           NOT NULL,
  "description"  TEXT,
  "cron"         TEXT           NOT NULL,
  "action"       JSONB          NOT NULL DEFAULT '{}',
  "is_enabled"   BOOLEAN        NOT NULL DEFAULT true,
  "next_run_at"  TIMESTAMPTZ(3),
  "last_run_at"  TIMESTAMPTZ(3),
  "last_error"   TEXT,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "scheduled_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_actions_company_enabled_next_idx"
  ON "scheduled_actions" ("company_id", "is_enabled", "next_run_at");

ALTER TABLE "scheduled_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_actions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_actions_tenant_isolation" ON "scheduled_actions"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

-- Privileged scan used by the in-process runner. SECURITY DEFINER runs as the table
-- owner, who is not subject to RLS, so the runner sees every tenant's due rows without
-- any such visibility being granted to ordinary API traffic.
CREATE OR REPLACE FUNCTION next_due_scheduled_actions(p_now TIMESTAMPTZ, p_limit INT)
RETURNS SETOF scheduled_actions
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT sa.* FROM scheduled_actions sa
   WHERE sa.is_enabled = true
     AND sa.next_run_at IS NOT NULL
     AND sa.next_run_at <= p_now
   ORDER BY sa.next_run_at ASC
   LIMIT p_limit;
$$;
