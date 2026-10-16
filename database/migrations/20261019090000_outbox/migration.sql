-- Outbox events (Phase 5, workflow & automation).
--
-- The durable log of every domain event. Producers emit a fact; the bus writes the row
-- before any in-process consumer runs, so the event survives a consumer failure and is
-- visible to the Event Registry. `published_at` stays null until every consumer
-- succeeds, which is what lets an operator retry a delivery that was owed but not made.
-- Additive: no existing table is altered.

CREATE TABLE "outbox_events" (
  "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID           NOT NULL,
  "type"          TEXT           NOT NULL,
  "resource"      TEXT           NOT NULL,
  "resource_id"   TEXT           NOT NULL,
  "actor_user_id" UUID,
  "payload"       JSONB          NOT NULL DEFAULT '{}',
  "occurred_at"   TIMESTAMPTZ(3) NOT NULL,
  "published_at"  TIMESTAMPTZ(3),
  "attempts"      INTEGER        NOT NULL DEFAULT 0,
  "last_error"    TEXT,
  "created_at"    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_events_company_occurred_idx" ON "outbox_events" ("company_id", "occurred_at");
CREATE INDEX "outbox_events_company_type_idx" ON "outbox_events" ("company_id", "type");
CREATE INDEX "outbox_events_company_published_idx" ON "outbox_events" ("company_id", "published_at");

-- Enable RLS and force it for all roles (same pattern as workflow_tasks).
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;

-- RLS policy: an event is visible only inside the tenant that produced it. The tenant
-- context is set by the application via `SET LOCAL app.current_company_id = '...'`.
CREATE POLICY "outbox_events_tenant_isolation" ON "outbox_events"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
