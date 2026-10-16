-- Configuration Schemas (Phase 6b platform).
--
-- A validated configuration shape per registered resource, scoped to a tenant.
-- Operators declare the fields, types and constraints a resource's configuration
-- must satisfy, so generic configuration UIs can render from the schema instead of
-- hardcoding each resource. Additive: no existing table is altered.
CREATE TABLE "configuration_schemas" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "resource_key" TEXT          NOT NULL,
  "name"        TEXT           NOT NULL,
  "description" TEXT,
  "schema_json" JSONB          NOT NULL DEFAULT '{}',
  "is_active"   BOOLEAN        NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "configuration_schemas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "configuration_schemas_unique" UNIQUE ("company_id", "resource_key")
);

CREATE INDEX "configuration_schemas_company_resource_idx"
  ON "configuration_schemas" ("company_id", "resource_key");

ALTER TABLE "configuration_schemas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuration_schemas" FORCE ROW LEVEL SECURITY;
CREATE POLICY "configuration_schemas_tenant_isolation" ON "configuration_schemas"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

-- Extension Registry (Phase 6b platform).
--
-- Third-party and customer extensions registered on the platform: name, key, version
-- and a manifest describing entry points, capabilities and required permissions.
-- Additive: no existing table is altered.
CREATE TABLE "extension_registry" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "name"        TEXT           NOT NULL,
  "description" TEXT,
  "extension_key" TEXT        NOT NULL,
  "version"     TEXT           NOT NULL,
  "manifest"    JSONB          NOT NULL DEFAULT '{}',
  "is_enabled"  BOOLEAN        NOT NULL DEFAULT true,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "extension_registry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "extension_registry_unique" UNIQUE ("company_id", "extension_key")
);

CREATE INDEX "extension_registry_company_extension_idx"
  ON "extension_registry" ("company_id", "extension_key");

ALTER TABLE "extension_registry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extension_registry" FORCE ROW LEVEL SECURITY;
CREATE POLICY "extension_registry_tenant_isolation" ON "extension_registry"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
