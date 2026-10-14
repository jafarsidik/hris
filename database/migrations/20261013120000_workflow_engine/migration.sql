-- Configurable workflow engine (Phase 5).
--
-- A workflow definition is a stable key; its versions carry immutable state-machine
-- definitions as JSON. Instances pin the version they started on so publishing a new
-- version never rewrites a running process. Every table is tenant-scoped and guarded
-- by RLS like the rest of the tenant data plane.

CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "WorkflowInstanceStatus" AS ENUM (
  'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'CANCELLED'
);

CREATE TABLE "workflow_definitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_by_user_id" UUID,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workflow_definitions_company_key_key"
  ON "workflow_definitions"("company_id", "key");

CREATE TABLE "workflow_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "definition_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "states" JSONB NOT NULL DEFAULT '[]',
  "transitions" JSONB NOT NULL DEFAULT '[]',
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_by_user_id" UUID,
  CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_versions_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "workflow_versions_definition_version_key"
  ON "workflow_versions"("definition_id", "version");

CREATE TABLE "workflow_instances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "definition_id" UUID NOT NULL,
  "version_id" UUID NOT NULL,
  "resource" TEXT,
  "resource_id" TEXT,
  "current_state_key" TEXT NOT NULL,
  "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "created_by_user_id" UUID,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_instances_definition_id_fkey"
    FOREIGN KEY ("definition_id") REFERENCES "workflow_definitions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workflow_instances_version_id_fkey"
    FOREIGN KEY ("version_id") REFERENCES "workflow_versions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "workflow_instances_company_id_idx"
  ON "workflow_instances"("company_id", "definition_id");
CREATE INDEX "workflow_instances_resource_idx"
  ON "workflow_instances"("resource", "resource_id");

CREATE TABLE "workflow_transition_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "instance_id" UUID NOT NULL,
  "from_state_key" TEXT,
  "to_state_key" TEXT NOT NULL,
  "transition_name" TEXT NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workflow_transition_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workflow_transition_events_instance_id_fkey"
    FOREIGN KEY ("instance_id") REFERENCES "workflow_instances"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "workflow_transition_events_instance_created_idx"
  ON "workflow_transition_events"("instance_id", "created_at");

ALTER TABLE "workflow_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_definitions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workflow_definitions_tenant_isolation" ON "workflow_definitions" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "workflow_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workflow_versions_tenant_isolation" ON "workflow_versions" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "workflow_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_instances" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workflow_instances_tenant_isolation" ON "workflow_instances" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());

ALTER TABLE "workflow_transition_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_transition_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "workflow_transition_events_tenant_isolation" ON "workflow_transition_events" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
