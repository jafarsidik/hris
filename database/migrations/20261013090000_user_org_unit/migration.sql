-- Add the organizational-unit placement to users, the anchor TEAM, DEPARTMENT and
-- ENTITY data scopes resolve against. Nullable so existing users and tenants that do
-- not model a hierarchy are unaffected; a user without a unit keeps the previous
-- default-deny outcome for those scopes.

ALTER TABLE "users" ADD COLUMN "organizational_unit_id" UUID;

ALTER TABLE "users"
  ADD CONSTRAINT "users_organizational_unit_id_fkey"
  FOREIGN KEY ("organizational_unit_id") REFERENCES "organizational_units"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_organizational_unit_id_idx" ON "users"("organizational_unit_id");
