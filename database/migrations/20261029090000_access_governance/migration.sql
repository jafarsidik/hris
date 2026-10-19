-- Access governance (Phase 6b platform).
--
-- Access Reviews: periodic certification that a user's permissions are still
-- appropriate. A review contains one item per (user, resource) grant the reviewer
-- must decide (approve / revoke / no action). Additive: no existing table altered.
CREATE TABLE "access_reviews" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"   UUID           NOT NULL,
  "name"         TEXT           NOT NULL,
  "description"  TEXT,
  "scope"        TEXT           NOT NULL DEFAULT 'company',
  "reviewer_id"  UUID           NOT NULL,
  "status"       TEXT           NOT NULL DEFAULT 'IN_PROGRESS',
  "due_at"       TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "created_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "access_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_reviews_company_status_idx" ON "access_reviews" ("company_id", "status");
CREATE INDEX "access_reviews_reviewer_idx" ON "access_reviews" ("reviewer_id");

ALTER TABLE "access_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY "access_reviews_tenant_isolation" ON "access_reviews"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);

CREATE TABLE "access_review_items" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "review_id"   UUID           NOT NULL,
  "user_id"     UUID           NOT NULL,
  "resource"    TEXT           NOT NULL,
  "resource_id" UUID,
  "permissions" JSONB          NOT NULL DEFAULT '[]',
  "decision"    TEXT           NOT NULL DEFAULT 'NO_ACTION',
  "decided_at"  TIMESTAMPTZ(3),
  "notes"       TEXT,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "access_review_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_review_items_review_fk"
    FOREIGN KEY ("review_id") REFERENCES "access_reviews"("id") ON DELETE CASCADE,
  CONSTRAINT "access_review_items_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "access_review_items_review_idx" ON "access_review_items" ("review_id");
CREATE INDEX "access_review_items_user_idx" ON "access_review_items" ("user_id");

ALTER TABLE "access_review_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_review_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "access_review_items_tenant_isolation" ON "access_review_items"
  USING (
    "review_id" IN (
      SELECT "id" FROM "access_reviews"
      WHERE "company_id" = current_setting('app.current_company_id', true)::uuid
    )
  )
  WITH CHECK (
    "review_id" IN (
      SELECT "id" FROM "access_reviews"
      WHERE "company_id" = current_setting('app.current_company_id', true)::uuid
    )
  );

-- Service Accounts: non-human identities for automation, distinct from API clients
-- in that they are scoped to a single tenant and managed in the tenant console.
CREATE TABLE "service_accounts" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID           NOT NULL,
  "name"        TEXT           NOT NULL,
  "description" TEXT,
  "key"         TEXT           NOT NULL,
  "secret_hash" TEXT           NOT NULL,
  "is_active"   BOOLEAN        NOT NULL DEFAULT true,
  "expires_at"  TIMESTAMPTZ(3),
  "last_used_at" TIMESTAMPTZ(3),
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_accounts_unique" UNIQUE ("company_id", "key")
);

CREATE INDEX "service_accounts_company_idx" ON "service_accounts" ("company_id");
CREATE INDEX "service_accounts_key_idx" ON "service_accounts" ("key");

ALTER TABLE "service_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "service_accounts_tenant_isolation" ON "service_accounts"
  USING ("company_id" = current_setting('app.current_company_id', true)::uuid)
  WITH CHECK ("company_id" = current_setting('app.current_company_id', true)::uuid);
