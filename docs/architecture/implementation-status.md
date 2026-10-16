# Implementation status

## Summary

Phases **0–5 are delivered**. Phase **6 — AI services** is not started. Phase **6b
Enterprise hardening** is partial.

## Phases

### Phase 0–4 — delivered (see earlier revisions)

The platform ships: authentication, MFA/SSO/passkeys, user & role administration with
permissions, organization units, employee records with custom fields and soft-delete,
generic records CRUD, audit trail (hash-chained), notification platform, settings, the
files subsystem (RustFS) and the integration registry.

### Phase 5 — Workflow, integration breadth & automation (DELIVERED)

Delivered: workflow engine core (versioned definitions, permission-checked transitions,
approval routing, transition history); `database/migrations/20261013120000_workflow_engine`,
`apps/api/src/modules/workflows/*`, `apps/api/test/workflows.e2e-spec.ts`.

Step-driven routing, task assignment, conditional/parallel steps and escalation/SLA
timers: materializes a task per candidate approver, arms a delayed SLA job per step, and
the worker (`apps/worker/src/workflow-processor.ts`) escalates overdue tasks.
`database/migrations/20261017090000_workflow_tasks`,
`apps/api/test/workflow-tasks.e2e-spec.ts`.

Integration registry + adapter interface, including EMAIL, WEBHOOK, STORAGE and ANALYTICS
adapters; signed webhook delivery with per-endpoint subscriptions and retries.
`database/migrations/20261013130000_integrations`,
`apps/api/src/modules/integrations/*`.

Outbox: every domain event is persisted to `outbox_events` before fan-out, with delivery
tracking and retry. `database/migrations/20261019090000_outbox`,
`apps/api/src/modules/events/*`. Event Registry web surface at `/setup/events`.

Business rules: event trigger + condition DSL + actions (`NOTIFY`,
`START_WORKFLOW`, `EMIT_WEBHOOK`). `database/migrations/20261020090000_business_rules`,
`apps/api/src/modules/business-rules/*`, `/setup/business-rules`.

Scheduled actions: cron trigger + in-process runner with cross-tenant enumeration.
`database/migrations/20261021090000_scheduled_actions`,
`apps/api/src/modules/scheduled-jobs/*`, `/setup/scheduled-actions`.

Idempotency keys: request-level deduplication for mutating endpoints carrying
`Idempotency-Key`. `database/migrations/20261022090000_idempotency_keys`,
`apps/api/src/modules/idempotency/*`.

Object storage over RustFS: full files module (upload composition, authorisation,
metadata, retention, purge). `database/migrations/20261018090000_files`,
`apps/api/src/modules/files/*`, `apps/web/src/features/files/*`, `/setup/files`.

Web console: top-level `/approvals` (My Approvals), plus `/setup/workflows`,
`/setup/workflows/instances`, `/setup/files`, `/setup/events`, `/setup/business-rules`,
`/setup/scheduled-actions`; workflow section items flipped to `built`.

Acceptance: `npm run verify` exits 0.

### Phase 6 — AI services (IN PROGRESS / INCREMENT 1)

Increment 1 delivered: AI gateway (disabled by default), knowledge base with semantic
search over published policy text, redaction, audit (`ai_calls`), provider-agnostic
OpenAI-compatible client, and the policy FAQ surface at `/ai/assistant`. Configuration:
`AI_ENABLED`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS`.

Remaining: persona-based self-service, resume/JD parsing, payroll/attendance anomaly
detection, attrition risk indicators, MCP access.

### Phase 6b — Enterprise hardening (PARTIAL)

Present: RLS tenant isolation, privilege-escalation guard, audit trail, credential cipher
with per-scope keys (`mfa`/`sso`/`webhook`), webhook signing, login and per-client rate
limiting, object storage over RustFS. Missing: multi-tenancy management UI/quotas, data
governance (classification, masking, retention), backup/restore hooks, security & performance
testing, deployment readiness, and broad rate-limit coverage.

## Selected next phase

Phase 5 is complete. The next eligible phase is **Phase 6 — AI services** (`docs/AI_SPEC.md`),
which remains entirely unimplemented; the platform is fully functional with AI disabled, as
required.

Dependencies: none external. Phase 6 AI and Phase 6b hardening follow.

## Notes

- Working tree is uncommitted beyond the last commit; no commit was made for this
  increment.
Added platform tenant control plane: company lifecycle/plan/quota, cross-tenant listing, web /platform/tenants.
