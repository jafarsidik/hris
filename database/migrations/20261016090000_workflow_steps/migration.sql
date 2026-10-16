-- Workflow steps (Phase 5, increment 5.1).
--
-- A version gains an optional `steps` graph (SEQUENTIAL / PARALLEL / CONDITIONAL) so a
-- definition can express routing, conditions and per-step SLA hints alongside the
-- existing flat state machine. The column is additive and defaults to an empty array, so
-- an existing version with no steps keeps running exactly as before.
--
-- Instances gain the step they currently sit on plus the SLA/escalation timestamps the
-- runtime sets when it enters a step.
ALTER TABLE "workflow_versions"
  ADD COLUMN "steps" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "workflow_instances"
  ADD COLUMN "step_key" TEXT,
  ADD COLUMN "due_at" TIMESTAMPTZ(3),
  ADD COLUMN "escalation_at" TIMESTAMPTZ(3);
