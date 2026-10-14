# Implementation status

Inspected the repository (source, migrations, tests, routes) on Wed Oct 14 2026.
`npm run verify`, the API e2e suite, the database integration tests and the web vitest
suite are the acceptance gates; a phase is not called COMPLETE on documentation or UI
placeholders alone.

Classification: **COMPLETE** (implementation + persistence + security enforcement +
tests verified) · **PARTIAL** (some functionality, important requirements remain) ·
**NOT STARTED**.

## Verified completed phases

| Phase | Status | Evidence |
| --- | --- | --- |
| 0 — Discovery & architecture | COMPLETE | `docs/architecture/{current-state,target-architecture,platform-modules,implementation-roadmap}.md` |
| 1 — Platform metadata registry | COMPLETE | `database/migrations/20261013090000_platform_registry`, `database/seeds/registry.ts`, `apps/api/src/modules/registry/*`, `apps/web/src/features/platform/registry-*` |
| 2 — Administration console + metadata CRUD engine | COMPLETE | see below |
| 5b — Example domain application (Project/Task) | COMPLETE | `database/seeds/example-projects.ts`, `apps/api/src/modules/records/*`, `apps/api/test/{records,example-projects}.e2e-spec.ts` |

Cross-cutting capabilities delivered and verified (not phase-scoped):

- API clients / machine credentials — hash-only storage, constant-time lookup, per-key
  scope enforcement, per-key rate limiting (`database/migrations/20261013110000_api_clients`,
  `apps/api/src/common/auth/api-client-authenticator.service.ts`, `apps/api/test/api-clients.e2e-spec.ts`).
- OpenAPI surface — `apps/api/src/openapi.ts`, `apps/api/test/openapi.e2e-spec.ts`.
- Signed webhooks with delivery attempts and retries — dispatch on domain events, worker
  signing/retry, encrypted signing secret, subscription rows
  (`database/migrations/20261014100000_webhook_delivery`, `apps/api/src/modules/integrations/webhook-dispatcher.service.ts`,
  `apps/worker/src/webhook-{processor,crypto}.ts`, `apps/api/test/integrations.e2e-spec.ts`).

## Phase 2 — Administration console + metadata CRUD engine (COMPLETE)

Evidence:

- Generic CRUD runtime for any `supportsCrud` resource without a bespoke module:
  `database/migrations/20261013100000_resource_records`, `apps/api/src/modules/records/*`
  (`/api/v1/records/:resource[/:id]`), capability and scope resolved per request from live
  permissions, field values validated against `resource_fields`.
- Registry write path with `registry:create`/`registry:update` gating and audit:
  `apps/api/src/modules/registry/registry.{service,controller}.ts`,
  `apps/web/src/features/platform/registry-admin.tsx`.
- Permission manager: `resource × action × scope` matrix backed by the registry
  (`apps/web/src/features/iam/permission-matrix.ts`, `roles-screen.tsx`).
- Console: fixed ten-section map, permission-filtered, with the `Applications & Metadata`
  section **derived from the live registry** (`apps/web/src/lib/console.ts`,
  `apps/web/src/lib/registry-console.ts`, `apps/web/src/features/console/console-home.tsx`,
  `apps/web/src/app/(app)/setup/page.tsx`). Tests: `console.spec.ts`, `registry-console.spec.ts`.

Remaining acceptance criterion: none material for this phase. The generic CRUD runtime is
exposed through the records API; a dedicated generic records *screen* remains a future
enhancement but is not required for the phase's registry-driven acceptance criterion.

## Partially completed phases

### Phase 3 — Dynamic authorization hardening (PARTIAL)

Delivered: permissions generated from the registry (`database/seeds/rbac.ts` →
`buildPermissionRowsFromRegistry`); record-level data-scope resolver with
`GLOBAL/COMPANY/SELF/TEAM/DEPARTMENT/ENTITY` and `OutOfScopeError` for default-deny
(`apps/api/src/common/auth/data-scope.ts`, `apps/api/test/data-scope.e2e-spec.ts`);
privilege-escalation guard `canGrant` on every grant path
(`apps/api/test/privilege-escalation.e2e-spec.ts`); org-hierarchy scope resolution.

Missing: apply the scope resolver to the remaining bespoke resources (only `user.view` and
the generic records layer use it today); field-level/attribute read masking for sensitive
fields (`ResourceField.isSensitive` is stored but not enforced); assign users into the org
hierarchy through the API rather than directly.

### Phase 4 — API & developer platform (PARTIAL)

Delivered: API clients, per-client rate limiting, OpenAPI document, signed webhooks.

Missing: usage/access-log surfacing for API consumers (delivery/audit rows exist but are
not exposed as a usage view); conditional/parallel workflow routing and scheduled jobs are
Phase 5 concerns, not here.

### Phase 5 — Workflow & integration (PARTIAL)

Delivered: workflow engine core (versioned definitions, permission-checked transitions,
approval routing, transition history) — `database/migrations/20261013120000_workflow_engine`,
`apps/api/src/modules/workflows/*`, `apps/api/test/workflows.e2e-spec.ts`; integration
registry + adapter interface (`database/migrations/20261013130000_integrations`,
`apps/api/src/modules/integrations/*`); signed webhooks (above).

Missing: conditional/parallel routing, multi-level approval steps, escalation/SLA timers,
task assignment, webhook/storage/analytics adapter breadth, scheduled jobs, idempotency,
an outbox for exactly-once delivery.

### Phase 6 — AI services (NOT STARTED)

`docs/AI_SPEC.md` is the detailed spec; no implementation code, migrations or tests exist.
The platform is fully functional with AI disabled, as required.

### Phase 6b — Enterprise hardening (PARTIAL)

Present: RLS tenant isolation, privilege-escalation guard, audit trail, credential cipher
with per-scope keys (`mfa`/`sso`/`webhook`), webhook signing, login and per-client rate
limiting. Missing: multi-tenancy management UI/quotas, data governance (classification,
masking, retention), file/storage integration, backup/restore hooks, security & performance
testing, deployment readiness, and broad rate-limit coverage.

## Selected next phase

**Phase 3 — Dynamic authorization hardening.** It is the earliest incomplete phase whose
dependencies (0, 1, 2) are satisfied, and it is a prerequisite for safely exposing more
bespoke resources. Scope for this increment:

1. **Field-level read masking.** Enforce `ResourceField.isSensitive` in the records layer:
   a caller without a sensitive-read permission receives the field redacted. Add the
   permission vocabulary and a test.
2. **Adopt the scope resolver on a bespoke resource** beyond `user.view`, proving the
   resolver is reusable (e.g. the integration or notification list path), with an e2e test.
3. Re-run `npm run verify`, the API e2e suite and the database integration tests; update
   this document and the roadmap.

Dependencies: none external. Later phases (4 surfacing, 5 workflow breadth, 6 AI, 6b
hardening) follow.

## Notes

- Working tree is uncommitted; no commits were made.
- Web suite: 306 tests. API e2e: 16 suites / 149 tests. Database integration: 9 tests.
