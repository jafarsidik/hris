-- ==============================================================================
-- log_events.resource_id and audit_logs.resource_id become free-form text
--
-- The Administration surface logs resource references for all kinds of targets:
-- users/roles carry uuid identifiers, but settings updates carry a setting key
-- such as "company.displayName". A uuid-typed column cannot hold the latter, so the
-- two columns are widened to text. Existing uuid-shaped values remain valid; nothing
-- is rewritten. No trigger or function depends on the column type.
-- ==============================================================================

ALTER TABLE "log_events"
  ALTER COLUMN "resource_id" TYPE text;

ALTER TABLE "audit_logs"
  ALTER COLUMN "resource_id" TYPE text;