# Plan — Phase 4 completion: API & Developer Platform

Status: awaiting approval (plan mode)
Owner decisions (confirmed):
- Implement all of Phase 4, then Phase 5.
- Usage/access-log stored in a per-request `api_request_log` table, aggregated on read.
- Include the Webhooks management UI in addition to Clients + Usage + Access Log + API Docs.

Guiding rule from the user: **after finishing each feature/phase, update the docs and the
navigation** so planned vs done is visible in the console and sidebar.

---

## Findings (current state)

- **API side of Phase 4 is done**: `/developers/clients` CRUD + `:id/rotate`
  (`apps/api/src/modules/api-clients/*`), per-client rate limiting, OpenAPI at `/api/docs`,
  signed webhooks (`apps/api/src/modules/integrations/*`).
- **No web UI exists** for any developer surface. In `apps/web/src/lib/console.ts` all `api`
  items are `planned` with no `href` (`:127-163`), and `API Access Log` is planned (`:369`).
- **Usage is not persisted.** `access-log.interceptor.ts` writes stdout only;
  `api_clients.last_used_at` (updated in `api-client-authenticator.service.ts:73`) is the only
  per-request persistence. A real usage/access-log view needs new persistence.
- **Wiring already present**: `api-client` is a registry resource
  (`database/seeds/registry-catalog.ts:105`, `packages/shared-types/src/rbac/rbac.ts:74`),
  the `view` action exists, and `PermissionKey = `${Resource}.${Action}`` so
  `useCan('api-client.view')` type-checks.
- **Nav invariants** (`console.spec.ts`, `navigation.spec.ts`) are structural: built items
  need globally unique paths/labels, planned items must have no `href`, section count stays
  10. Adding built items is safe if those hold.
- **Repo seams** to mirror: `apps/web/src/features/organization/*` (types/api/mock/index/
  screen/spec) and `apps/web/src/features/iam/*` (`useIamLoad`, `getIam().listPermissions()`
  for the `resource.action` vocabulary, `useCan`).
- `apiRequest` (`apps/web/src/lib/api/http-client.ts:144`) unwraps the `{success,data}`
  envelope; DELETE uses `apiRequestV1<never>(..., { method: 'DELETE' })` (see `org-api.ts`).

---

## Increment 4a — API Clients web surface

New feature `apps/web/src/features/developers/`:
- `developer-types.ts` — `DeveloperApiClient`, `DeveloperApiClientWithSecret`,
  `CreateApiClientInput`, `UpdateApiClientInput`, `DeveloperRepository`.
- `developer-api.ts` — `apiDeveloperRepository` against `/developers/clients` (list/get/
  create/patch/rotate/delete) via `apiRequestV1`.
- `developer-mock.ts` — mutable in-memory store (mirrors the API read model; secret shown
  once on create/rotate; rotate invalidates the old secret; delete removes).
- `index.ts` — `getDevelopers()` seam, `NEXT_PUBLIC_HRIS_DEVELOPERS_DATA_SOURCE` (default
  `api`).
- `scope-picker.tsx` — checkbox list grouped by resource, options from
  `getIam().listPermissions()` (key = `${row.resource}.${row.action}`; do not use the mock's
  colon `key`). Searchable.
- `clients-screen.tsx` — `PageHeader`; table (Name, Client ID, Scopes count, Status badge,
  Last used, Actions). Create/edit dialog (name, description, scopes). Rotate dialog showing
  the one-time secret. Delete confirm. Gates: `api-client.create/update/delete` via `useCan`;
  reads require `api-client.view`.
- `developer-repository.spec.ts` — contract tests (default→api, mock switch, create/rotate/
  delete behaviours, secret-once).

Route `apps/web/src/app/(app)/setup/api/clients/page.tsx` → `<ClientsScreen />`,
`metadata.title = 'API Clients'`.

`console.ts`: **API Clients** → `status: 'built'`, `href: '/setup/api/clients'`,
`permission: 'api-client.view'`. Add tests assertions if needed; run web specs.

Docs: add a bullet to `implementation-roadmap.md` / `implementation-status.md`.

Verify: `npm run typecheck -w @hris/web`, `npm run lint -w @hris/web`, web vitest.

---

## Increment 4b — Usage + access-log persistence

Migration `database/migrations/<ts>_api_request_log/migration.sql`:
- `api_request_log`: id, company_id, api_client_id (FK api_clients ON DELETE CASCADE),
  method, path, status_code int, duration_ms int, occurred_at, correlation_id.
- Indexes `(company_id, occurred_at desc)` and `(api_client_id, occurred_at desc)`.
- RLS ENABLE + FORCE + tenant policy on `company_id`.
- Add `ApiRequestLog` model to `database/schema.prisma`; run `prisma generate`.

Write path:
- Set `request.apiClientId` for machine principals (in `AuthGuard` /
  `ApiClientAuthenticator` path).
- New `ApiRequestLogService.record(...)` in `apps/api/src/modules/logs/` (or a small
  `api-usage` module). An interceptor records **machine requests only**, awaited for test
  determinism; path only (no bodies/query — same PII stance as the access log).
- Retention/purge documented as a Phase 6b follow-up.

Endpoints (new `ApiUsageController`, gated `@RequirePermission('api-client', 'view')`):
- `GET /developers/usage` — per client: `requestCount`, `errorCount` (status ≥ 400),
  `avgDurationMs`, window `from`/`to`.
- `GET /developers/requests` — cursor-paginated log rows, optional `clientId`.
Both tenant-scoped via `withTenantContext`.

Web: `features/developers/usage-screen.tsx`, `access-log-screen.tsx`; routes
`/setup/api/usage`, `/setup/api/access-log`. `console.ts`: **API Usage** and **API Access
Log** → `built` with hrefs + `permission: 'api-client.view'`.

Tests: extend/new `apps/api/test/api-clients.e2e-spec.ts` (keyed request records a row;
usage/requests return scoped data; a second tenant sees nothing). Web contract spec for the
new repository methods.

Docs: `docs/API.md` (new endpoints + persisted access log), `docs/SECURITY.md` (machine
request retention/PII note), status/roadmap.

Verify: build:packages, API e2e, web specs.

---

## Increment 4c — API Docs page + Webhooks management UI

- `/setup/api/docs` — page linking the served OpenAPI (`NEXT_PUBLIC_API_PLATFORM`/docs).
  `console.ts`: **API Documentation** → built.
- Web integrations feature mirroring the API (`integrations` CRUD + `:id/test`,
  `:id/deliveries`, `:id/subscriptions`, `:id/secret`): `apps/web/src/features/integrations/*`
  + routes `/setup/integrations` and `/setup/integrations/[id]` (details, subscriptions
  editor, delivery log, rotate secret, test). `console.ts`: **Webhooks** (api section) and
  **Integrations** (integrations section) → built, `permission: 'integration.view'`.
- Tests + docs.

---

## Increment 4d — Close Phase 4 (docs + navigation)

- `docs/architecture/implementation-status.md`: Phase 4 → COMPLETE, refresh test counts,
  move "Selected next phase" to Phase 5.
- `docs/architecture/implementation-roadmap.md`: Phase 4 delivered bullets; pending empty.
- `docs/PHASE_STATUS.md`: top note → Phases 0–4 complete.
- `docs/API.md`: finalize developer + webhook endpoints.
- Run full `npm run verify` + API e2e + DB tests.

---

## Phase 5 — Workflow & integration breadth

- Engine: conditional/parallel routing, multi-level approval steps, escalation/SLA timers,
  task assignment (`apps/api/src/modules/workflows/*`, new migration).
- Web: workflow definitions + execution history (flip `workflow` console section);
  scheduled jobs (BullMQ repeatable) → **Scheduled Jobs** built; adapter breadth,
  idempotency, outbox.
- Docs + navigation after each sub-step.

---

## Definition of done (every increment)

1. Feature implemented with the repository-seam pattern (mock + api) and a contract spec.
2. `console.ts` items flipped/added with `href` + `permission`; `navigation.ts` derives
   automatically. `console.spec.ts` + `navigation.spec.ts` pass.
3. Docs updated (`implementation-status.md`, `implementation-roadmap.md`, `PHASE_STATUS.md`,
   `API.md`, `SECURITY.md` as relevant).
4. `npm run verify` (and API e2e / DB tests where applicable) green.

## Verification commands

- Web: `npm run typecheck -w @hris/web`, `npm run lint -w @hris/web`, `npx vitest run` (web).
- API e2e: `npm run test:e2e` (`apps/api/test/jest-e2e.config.mjs --runInBand`).
- DB: `npx jest --config database/jest.config.mjs --runInBand`.
- Full: `npm run verify`.

## Open items / risks

- Awaited DB write per machine request adds latency; acceptable at this scale, revisit if
  traffic grows (could batch/flush). If not awaited, e2e must poll for the row.
- `api_request_log` retention/purge is deferred to Phase 6b; document it.
- `API Credentials` and `API Scopes` console items stay `planned` (credentials are covered by
  the clients screen's rotate; scopes are the permission vocabulary) unless the user wants
  dedicated screens.
