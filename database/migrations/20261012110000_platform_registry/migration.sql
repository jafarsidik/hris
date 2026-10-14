-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('ENTITY', 'REFERENCE', 'CONFIGURATION', 'DOCUMENT', 'TRANSACTION');

-- CreateEnum
CREATE TYPE "FieldDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON', 'ENUM', 'REFERENCE');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "app_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "module_id" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource_type" "ResourceType" NOT NULL,
    "supports_crud" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "resource_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_type" "FieldDataType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "resource_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID,

    CONSTRAINT "registered_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_key_key" ON "applications"("key");

-- CreateIndex
CREATE UNIQUE INDEX "app_modules_key_key" ON "app_modules"("key");

-- CreateIndex
CREATE INDEX "app_modules_application_id_idx" ON "app_modules"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_definitions_key_key" ON "resource_definitions"("key");

-- CreateIndex
CREATE INDEX "resource_definitions_application_id_idx" ON "resource_definitions"("application_id");

-- CreateIndex
CREATE INDEX "resource_definitions_module_id_idx" ON "resource_definitions"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_fields_resource_id_key_key" ON "resource_fields"("resource_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "registered_actions_resource_id_action_key" ON "registered_actions"("resource_id", "action");

-- AddForeignKey
ALTER TABLE "app_modules" ADD CONSTRAINT "app_modules_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_definitions" ADD CONSTRAINT "resource_definitions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_definitions" ADD CONSTRAINT "resource_definitions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "app_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_fields" ADD CONSTRAINT "resource_fields_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resource_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registered_actions" ADD CONSTRAINT "registered_actions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resource_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==============================================================================
-- Integrity for created_by_user_id
--
-- Declared as plain uuid columns in schema.prisma but enforced here, matching the
-- convention applied to every other table. These tables are global (no tenant
-- column and no RLS), so no tenant policy follows.
-- ==============================================================================

ALTER TABLE "applications" ADD CONSTRAINT "applications_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "app_modules" ADD CONSTRAINT "app_modules_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_definitions" ADD CONSTRAINT "resource_definitions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_fields" ADD CONSTRAINT "resource_fields_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registered_actions" ADD CONSTRAINT "registered_actions_created_by_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
