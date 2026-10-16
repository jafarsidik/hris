# Implementation roadmap

Phases are ordered by dependency and grouped into small, testable increments. Each
increment must leave `npm run verify`, the database integration tests and the API e2e
suite green, and must not break existing functionality. Phase boundaries are adjusted
to the existing repository; nothing is rewritten for its own sake.

Legend: **DONE** existing and verified · **PARTIAL** partly present · **NEXT** the
increment being implemented now.

## Phase 0 — Discovery and architecture — DONE

Deliverables: `docs/architecture/current-state.md`, `target-architecture.md`,
`platform-modules.md`, `implementation-roadmap.md`. Acceptance: the current state is
verified against source; gaps against the master prompt are stated honestly.

## Phase 1 — Core foundation: Platform Metadata Registry — DONE

The registry is the foundation every later capability references. It is additive and
does not change existing behaviour.

1. **Schema + migration**
   - Platform-wide (no `companyId`, no RLS) tables: `applications`, `app_modules`,
     `resource_definitions`, `resource_fields`, `registered_actions`.
   - Enums for resource type and field data type.
2. **Seed from existing constants** — register the platform application, all
   `MODULE_IDS`, all `RESOURCES`, all `ACTIONS`, plus a small field set for the
   existing `user`/`role` resources. Idempotent upserts.
3. **API** — `apps/api/src/modules/registry`: read endpoints
   `GET /platform/applications`, `GET /platform/modules`, `GET /platform/resources`,
   `GET /platform/resources/:key`, gated by a new `registry` permission resource.
4. **Shared contracts** — `platform/registry.ts` types; add `registry` to `RESOURCES`
   (→ 28 × 9 = 252 permissions; re-seed).
5. **Web** — a built "Resource Registry" screen under a new M00 "Application &
   Metadata" group, reading the API.
6. **Tests** — registry e2e (list, detail, permission denial), schema-contract update,
   navigation spec stays green.

Acceptance: an administrator can see registered applications/modules/resources and
their fields from the console; the registry is DB-backed and extendable without
touching core resource code.

## Phase 2 — Administration console + metadata CRUD engine — DONE

- **Delivered:** the permission manager is now a `resource × action × scope` matrix
  backed by the registry (`apps/web/src/features/iam/permission-matrix.ts`,
  `roles-screen.tsx`), with a metadata-driven field surface
  (`components/metadata/resource-fields-table.tsx`) used by the Resource Registry screen.
- **Delivered:** the registry write path — an operator can register an application,
  module, resource, field and action from the Resource Registry screen without editing
  platform source (`apps/api/src/modules/registry/registry.{service,controller}.ts`,
  `apps/web/src/features/platform/registry-admin.tsx`, `platform-api.ts`). Write
  endpoints are gated on `registry:create` / `registry:update`, validate keys and
  references, and append an audit record via `LogService`.
- **Delivered:** the generic CRUD runtime. Any `supportsCrud` resource gets working
  storage and endpoints with no bespoke module: `ResourceRecord` stores validated field
  values as JSON (`database/migrations/20261013100000_resource_records`), and
  `/api/v1/records/:resource[/:id]` (`apps/api/src/modules/records/`) resolves capability
  and scope from the caller's live permissions on each request. Field values are validated
  against `resource_fields` (unknown keys fail loudly); `ownerUserId`/`organizationalUnitId`
  are projected into real columns so `SELF`, `TEAM`/`DEPARTMENT` and `ENTITY` scopes stay
  database predicates. Covered by `apps/api/test/records.e2e-spec.ts`.
- **Delivered:** the administration console — a fixed ten-section map
  (`apps/web/src/lib/console.ts`, `apps/web/src/features/console/console-home.tsx`,
  `apps/web/src/app/(app)/setup/page.tsx`), reorganised to the master prompt's setup
  navigation: Identity & Access, API & Developers, AI Services, Workflow & Automation,
  Integrations & Communication, Application & Metadata, System Configuration, Audit &
  Security, Operations & Observability and Tenant Management. Each item is a shortcut into
  a built route **or an explicit `planned` roadmap entry**, and a built item is shown only
  when the caller holds the permission the backing API enforces (`user.view`,
  `role.view`, …), so the console cannot link to a page the caller cannot use or a route
  that 404s (asserted by `console.spec.ts`, including the fixed count of ten). Each section
  carries a `built/total` status badge and each item a check/dashed marker, so what exists
  and what is planned is visible at a glance. A "Console Home" entry in the sidebar gives
  the whole surface one entry point.
- **Delivered:** the console's `Application & Metadata` section is now derived from the
  live registry. `registryConsoleItems` (`apps/web/src/lib/registry-console.ts`) turns
  every active, CRUD-enabled resource the caller may `view` into a console entry pointing
  at the Resource Registry filtered to it, so a resource registered at runtime appears
  without a web deploy. Items are merged in by `consoleFor(permissions, extraItems)` and
  gated on the same `resource.action` permission the records API enforces; the console
  stays a fixed map and the registry read is best-effort so a failure leaves the curated
  sections intact. Covered by `console.spec.ts` and `registry-console.spec.ts`.

## Phase 3 — Dynamic authorization hardening — DONE

- **Delivered:** `Permission` rows are generated from the registry
  (`database/seeds/rbac.ts` → `buildPermissionRowsFromRegistry`, reading
  `resource_definitions` × `registered_actions`), so a resource or action registered at
  runtime becomes grantable after the next seed. The shared `RESOURCES`/`ACTIONS`
  constants are now only the bootstrap seed read by `seedRegistry`; seed order is
  registry → rbac.
- **Delivered:** record-level data-scope enforcement for `user.view`. A `ScopeDecision`
  resolver (`apps/api/src/common/auth/data-scope.ts`) turns the caller's widest scope
  into a query constraint: `GLOBAL`/`COMPANY` unrestricted within the tenant, `SELF`
  narrowed to the caller, `TEAM`/`DEPARTMENT`/`ENTITY` default-deny with
  `OutOfScopeError` (403 `OUT_OF_SCOPE`). Covered by
  `apps/api/test/data-scope.e2e-spec.ts` (SELF, COMPANY, DEPARTMENT default-deny,
  cross-tenant, GLOBAL).
- **Delivered:** privilege-escalation guard. `canGrant` compares a requested grant to the
  actor's own effective permissions (action match with `manage` implying all, scope rank
  ≥ the granted scope). `AccessService.createRole`, `replaceRolePermissions` and
  `syncUserRoles` (user create/update role assignment) refuse a grant the actor does not
  hold with `FORBIDDEN`. Covered by `apps/api/test/privilege-escalation.e2e-spec.ts`.
- **Delivered:** org-hierarchy scopes. `User.organizationalUnitId` anchors the caller in
  the division → department → team tree; `resolveScope` turns `TEAM`/`DEPARTMENT` into a
  subtree constraint and `ENTITY` into an entity constraint, using a depth-bounded
  recursive walk (`findOrgUnitSubtree`/`findOrgUnitEntity` in `@hris/database`). A grant's
  `scopeId` anchors the scope at a specific unit; an org scope with nothing to resolve
  default-denies. `EffectivePermission` carries the optional `scopeId`. Covered by the
  extended `apps/api/test/data-scope.e2e-spec.ts` (TEAM, DEPARTMENT, ENTITY).
- **Delivered:** field-level read masking. `view_sensitive` is a first-class action
  (`Action` enum + migration `20261014110000_view_sensitive_action`); the records layer
  redacts every `ResourceField.isSensitive` value from a caller without the matching
  `view_sensitive` grant, so a sensitive field is stored and returned only to those who may
  read it.
- **Delivered:** the scope resolver adopted on a bespoke resource. The integrations list and
  detail reads resolve `integration.view` through `resolveScope`, so a scoped administrator
  cannot enumerate a sibling subtree
  (`apps/api/src/modules/integrations/integrations.service.ts`, e2e in
  `apps/api/test/integrations.e2e-spec.ts`).
- **Delivered:** full organizational-structure CRUD and user placement. A new
  `apps/api/src/modules/organization` module exposes `/api/v1/organization/entities` and
  `/api/v1/organization/units` (create/read/update/delete), each gated by its
  `organization.*` action and narrowed on read by `resolveScope`; placement is validated
  against the actor's subtree, entity and self scopes. `AccessService` accepts
  `organizationalUnitId` on user create/update, so users are placed in the hierarchy through
  the API rather than directly. Covered by `apps/api/test/organization.e2e-spec.ts`.
- **Delivered:** the data-scope resolver applied to the log surface. `LogService.listEvents`
  and `listAudit` take the caller's principal: `GLOBAL`/`COMPANY` see the whole tenant,
  `SELF` sees only its own actor rows, and any other org scope default-denies (the log has
  no organizational dimension), with the scope folded into the cursor fingerprint so paging
  cannot leak. Covered by `apps/api/test/logs.e2e-spec.ts`.
- **Delivered:** the web surface. `/setup/organization` (under the console's Identity &
  Access section, gated on `organization.view`) manages legal entities and the unit tree
  through a repository seam (`apps/web/src/features/organization/*`); the Add-user dialog
  offers an organizational-unit picker and the users table shows each user's unit.

## Phase 4 — API & developer platform — DONE

- **Delivered:** API clients / machine credentials. An operator can create a client with
  a scope set (`api-client` resource, management API `/api/v1/developers/clients`). The
  secret is shown once and stored only as a SHA-256 hash
  (`database/migrations/20261013110000_api_clients`), authentication is a cross-tenant
  `SECURITY DEFINER` lookup plus a constant-time hash comparison
  (`apps/api/src/common/auth/api-client-authenticator.service.ts`), and a key is limited
  to exactly its granted scopes (each validated as a real `resource.action` and against
  what the creator may grant). Rotation, disable and delete revoke immediately. Covered
  by `apps/api/test/api-clients.e2e-spec.ts`.
- **Delivered:** the API-client management web surface. `/setup/api/clients` lists the
  tenant's machine identities and lets an administrator create, edit, rotate (secret shown
  once), disable/enable and delete them, with a registry-backed scope picker
  (`apps/web/src/features/developers/*`). Reads require `api-client.view`, each mutation its
  own `api-client.*` permission. Covered by
  `apps/web/src/features/developers/developer-repository.spec.ts`.
- **Delivered:** per-client rate limiting. A `RateLimiter` fixed-window limiter
  (`apps/api/src/common/rate-limit/rate-limiter.service.ts`, Redis-backed) now caps each
  developer API client at `API_RATE_LIMIT_PER_MINUTE` requests (`AuthGuard`), and the
  sign-in throttle reuses it. A spent window returns `429 RATE_LIMITED` with a
  `Retry-After` header. Covered by `apps/api/test/api-clients.e2e-spec.ts` and
  `apps/api/src/common/rate-limit/rate-limiter.service.spec.ts`.
- **Delivered:** the OpenAPI surface for consumers. The document is built by
  `buildOpenApiDocument` (`apps/api/src/openapi.ts`) and served at `/api/docs` and
  `/api/docs-json`, documenting both credential kinds (`access-token` session bearer and
  `api-key` `X-API-Key`) and the module tags. `apps/api/test/openapi.e2e-spec.ts` re-reads
  the served document so a refactor cannot silently drop a route or scheme, and asserts it
  is absent when `SWAGGER_ENABLED=false`.
- **Delivered:** signed webhooks with delivery attempts and retries. Domain events dispatch
  to subscribed endpoints, the worker signs and retries deliveries, and the signing secret is
  encrypted at rest (`database/migrations/20261014100000_webhook_delivery`,
  `apps/api/src/modules/integrations/webhook-dispatcher.service.ts`,
  `apps/worker/src/webhook-{processor,crypto}.ts`), covered by
  `apps/api/test/integrations.e2e-spec.ts`.
- **Delivered:** API usage and access-log surfaces. Every authenticated machine request is
  recorded in `api_request_log` (append-only, tenant RLS, `ON DELETE CASCADE` from the
  client) with the method, path, status, duration and correlation id — never the query
  string or body (`apps/api/src/modules/api-usage/*`,
  `database/migrations/20261015120000_api_request_log`). `GET /api/v1/developers/usage`
  returns a windowed per-client rollup aggregated server-side; `GET
  /api/v1/developers/requests` returns the newest-first log under the shared cursor
  contract. The web surfaces `/setup/api/usage` and `/setup/api/access-log` (console API
  and audit sections, gated on `api-client.view`) read them through the same repository
  seam. Covered by `apps/api/test/api-usage.e2e-spec.ts` and
  `apps/web/src/features/developers/developer-repository.spec.ts`.
- **Delivered:** the developer-facing web surfaces. `/setup/api/docs` links the served
  OpenAPI explorer and raw document (gated on `api-client.view`); `/setup/api/webhooks`
  and `/setup/integrations` (+ `/setup/integrations/[id]`) list, register, edit, delete
  and test integrations, open one for its delivery log, edit a webhook's event
  subscriptions and rotate its signing secret (`apps/web/src/features/integrations/*`,
  gated on `integration.view`/`integration.*`). The webhook surface reuses the integration
  feature filtered to `WEBHOOK`. Covered by
  `apps/web/src/features/integrations/integration-repository.spec.ts`.

## Phase 5 — Workflow & integration

- **Workflow engine core delivered.** Tenant-scoped, configurable state machines
  (`database/migrations/20261013120000_workflow_engine`): a definition has immutable
  versions whose states and transitions are validated JSON; publishing activates a
  version and archives the previous one, and each instance pins the version it started
  on so a later publish never rewrites an in-flight process. Authoring lives under
  `/api/v1/workflows` (`workflow:view/create/update/delete`); runtime lives under
  `/api/v1/workflow-instances`. Every transition re-checks the actor's live permissions
  (its declared `requiredPermission`, defaulting to `workflow.approve`) and, when it
  declares `requiresApproval`, the `ApprovalAuthority` rules (directly or via an active
  delegation) — so `ApprovalAuthority` is now wired into routing. Full history is
  appended to `workflow_transition_events`. Covered by
  `apps/api/test/workflows.e2e-spec.ts` (`apps/api/src/modules/workflows/*`).
- **Integration registry + adapter interface delivered.** Every configured external
  system is one row in `integrations` (`database/migrations/20261013130000_integrations`),
  tenant-scoped and soft-deletable, with a linked append-only `integration_deliveries`
  ledger. Adapters are code keyed by `IntegrationKind`; the first is `EmailAdapter`,
  which resolves the tenant's SMTP relay from encrypted System Settings (or a non-secret
  `host`/`port` override) and probes it over TCP without loading a mail library into the
  API. `integration.config` is validated to reject credential-like keys, so secrets stay
  in System Settings. The worker appends an outbound delivery record for every real email
  it sends when an `EMAIL` integration is registered. Routes live under
  `/api/v1/integrations` (`integration:view/create/update/delete`, with the connection
  test gated on `integration:manage`). Covered by `apps/api/test/integrations.e2e-spec.ts`
  (`apps/api/src/modules/integrations/*`).
- **Step-driven routing + task assignment delivered.** A version may declare `steps`
  (`SEQUENTIAL`/`PARALLEL`/`CONDITIONAL`, `ALL_PREDECESSORS`/`ANY_PREDECESSOR`, optional
  `condition`, `timeoutMinutes`, `escalationPolicy`). The engine materializes one task per
  candidate approver for each step an instance enters, mirrors the step's state onto the
  instance, and advances only when the step's decision rule is satisfied; a rejection on any
  step terminates the instance. Versions without `steps` keep the transition-driven engine.
  Covered by `apps/api/test/workflow-tasks.e2e-spec.ts`
  (`database/migrations/20261017090000_workflow_tasks`, `apps/api/src/modules/workflows/*`).
- **Escalation/SLA delivered.** Entering a step arms a delayed job on the workflow queue; the
  worker (`apps/worker/src/workflow-processor.ts`, `QUEUE_WORKFLOW`) expires the
  timed-out task, re-routes it to holders of the step's `escalationPolicy` (default
  `workflow.manage`), notifies them and records the escalation. The timer is idempotent and
  lives in Redis, so escalation survives an API restart.
- **Pending:** webhook/storage/analytics adapter breadth, scheduled jobs beyond SLA timers,
  idempotency keys, and an outbox for exactly-once delivery.

## Phase 5b — Example domain application (Project/Task)

- **Delivered.** The "Projects" application exists only as metadata plus two small pieces
  of code, and never appears in a core module's imports. `database/seeds/example-projects.ts`
  registers the `PROJECTS` application, the `PROJECT_MANAGEMENT` module, the `project` and
  `task` resources with their fields, the standard actions for both, and one custom
  `complete` action on `task`. `seedRbac` then generates the `project.*`/`task.*`
  permissions from those rows, so an administrator grants them like any other resource —
  the core `RESOURCES`/`ACTIONS` bootstrap constants are unchanged. The seed is idempotent
  and runs after the platform registry and before RBAC in `database/seeds/seed.ts`.
- **Generic runtime for free.** Because `project`/`task` set `supportsCrud`, the existing
  records endpoints (`/api/v1/records/project`, `/api/v1/records/task`) provide CRUD with
  live permission checks and data-scope predicates; no controller or service was written.
- **Custom actions and events.** A new `POST /api/v1/records/:resource/:id/actions/:action`
  route dispatches to a `RecordActionRegistry`, whose `RecordActionDefinition` is just
  `{ permission, handle }` (`apps/api/src/modules/records/record-action.*`). The example's
  `task.complete` handler reuses the standard `task.update` grant, refuses a second
  completion with `409`, patches the record and emits `task.completed` on an in-process,
  `@Global` `DomainEventBus` (`apps/api/src/modules/events/*`); nothing in core imports the
  example. Its `TaskEventsConsumer` writes an operational event, and the event contract is
  `{ type, companyId, actorUserId, resource, resourceId, payload, occurredAt }`.
- **Verified.** `apps/api/test/example-app.e2e-spec.ts` exercises registry discovery,
  seeded CRUD, the custom action, the emitted event, the conflict, an unknown action
  (`404`), the permission denial (`403`) and required-field validation. Covered by
  `apps/api/src/modules/example-projects/*`.

## Phase 6 — AI services (optional)

- Provider/model/prompt/tool/agent registries; permission-aware tool execution;
  Redaction by default; budget/quota; request/error logs; usage analytics.
- Platform remains fully functional when AI is disabled.

## Phase 6b — Enterprise hardening

- Optional multi-tenancy management UI (tenant registry, quotas, entitlements) atop
  existing `Company` + RLS.
- Data governance (classification, masking, retention), file/storage integration,
  backup/restore hooks, performance and security testing, deployment readiness.

## Guardrails applied to every phase

- Additive migrations; no destructive schema change without an approved migration doc.
- Permission vocabulary changes re-run the idempotent seeds.
- Every new protected endpoint declares `@RequirePermission`.
- New secrets are encrypted at rest and masked on read.
- Tests: `npm run verify`, `database` integration, `apps/api` e2e, and the relevant
  web vitest file must pass before a phase is declared complete.
