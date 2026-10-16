-- Workflow tasks (Phase 5, increment 5.2a).
--
-- Materializes one row per approver per step so the engine can assign, track SLA
-- deadlines, and escalate overdue work. Backward-compatible: versions without
-- steps never create tasks and continue to use the flat state machine.

CREATE TYPE "WorkflowTaskStatus" AS ENUM (
  'PENDING',
  'CLAIMED',
  'APPROVED',
  'REJECTED',
  'SKIPPED',
  'ESCALATED',
  'EXPIRED'
);

CREATE TABLE "workflow_tasks" (
  "id"                 UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"         UUID           NOT NULL,
  "instance_id"        UUID           NOT NULL,
  "step_key"           TEXT           NOT NULL,
  "state_key"          TEXT,
  "status"             "WorkflowTaskStatus" NOT NULL DEFAULT 'PENDING',
  "assignee_user_id"   UUID,
  "required_permission" TEXT,
  "due_at"             TIMESTAMPTZ(3),
  "escalation_at"      TIMESTAMPTZ(3),
  "escalated_at"       TIMESTAMPTZ(3),
  "claimed_at"         TIMESTAMPTZ(3),
  "decided_at"         TIMESTAMPTZ(3),
  "comment"            TEXT,
  "created_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "workflow_tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workflow_tasks"
  ADD CONSTRAINT "workflow_tasks_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "workflow_instances" ("id") ON DELETE CASCADE;

CREATE INDEX "workflow_tasks_instance_status_idx"
  ON "workflow_tasks" ("instance_id", "status");

CREATE INDEX "workflow_tasks_company_assignee_status_idx"
  ON "workflow_tasks" ("company_id", "assignee_user_id", "status");

CREATE INDEX "workflow_tasks_status_due_idx"
  ON "workflow_tasks" ("status", "due_at");

-- Enable RLS and force it for all roles (same pattern as workflow_instances)
ALTER TABLE "workflow_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_tasks" FORCE ROW LEVEL SECURITY;

-- RLS policy: users can only see tasks in their company
-- The tenant context is set by the application via `SET LOCAL app.current_company_id = '...'`
CREATE POLICY "workflow_tasks_tenant_isolation" ON "workflow_tasks"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);