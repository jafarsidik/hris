-- Per-request usage for the developer API (Phase 4).
--
-- `api_clients.last_used_at` answers "is this key live?"; this table answers "how is
-- it used?". Only the path is stored, never the query string or a request body, because
-- either can carry personal data; the correlation id is the thread back to the request
-- that produced the row. Rows are high-volume and append-only, and cascade away with the
-- client they belong to, so a revoked credential takes its history with it.

CREATE TABLE "api_request_log" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "api_client_id" UUID NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "correlation_id" TEXT,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_request_log_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_request_log_api_client_id_fkey"
    FOREIGN KEY ("api_client_id") REFERENCES "api_clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "api_request_log_company_occurred_idx"
  ON "api_request_log"("company_id", "occurred_at" DESC);
CREATE INDEX "api_request_log_client_occurred_idx"
  ON "api_request_log"("api_client_id", "occurred_at" DESC);

ALTER TABLE "api_request_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_request_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "api_request_log_tenant_isolation" ON "api_request_log" FOR ALL
  USING ("company_id" = "app_current_company_id"())
  WITH CHECK ("company_id" = "app_current_company_id"());
