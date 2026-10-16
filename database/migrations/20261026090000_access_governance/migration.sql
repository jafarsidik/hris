-- Access governance: user groups + data policies (Phase 6b platform).
--
-- User groups are named collections of users used to assign access collectively;
-- membership is recorded separately so a user can belong to several groups and the
-- set is auditable. Data policies describe a classification, a masking action and
-- the resources they govern. Additive: no existing table is altered.
CREATE TABLE "user_groups" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID           NOT NULL,
  "name"         TEXT           NOT NULL,
  "description"  TEXT,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_groups_company_name_idx" ON "user_groups" ("company_id", "name");

ALTER TABLE "user_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_groups" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_groups_tenant_isolation" ON "user_groups"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "user_group_members" (
  "group_id"   UUID  NOT NULL,
  "user_id"    UUID  NOT NULL,
  "company_id" UUID  NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "user_group_members_pkey" PRIMARY KEY ("group_id","user_id"),
  CONSTRAINT "user_group_members_group_fk"
    FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE,
  CONSTRAINT "user_group_members_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

ALTER TABLE "user_group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_group_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY "user_group_members_tenant_isolation" ON "user_group_members"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "data_policies" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID           NOT NULL,
  "name"         TEXT           NOT NULL,
  "description"  TEXT,
  "classification" TEXT         NOT NULL DEFAULT 'internal',
  "target_resource" TEXT        NOT NULL,
  "masking_action" TEXT        NOT NULL DEFAULT 'mask',
  "is_enabled"   BOOLEAN       NOT NULL DEFAULT true,
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "data_policies_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "data_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "data_policies_tenant_isolation" ON "data_policies"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
