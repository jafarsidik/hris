# Target architecture — Enterprise Application Platform

This is the architecture the platform evolves **toward**, expressed as a set of layers
and contracts. It reuses the existing modular monolith; it is not a rewrite. Each
section states what already exists, what is added, and the migration path.

Guiding constraints (from the master prompt):

- Domain-agnostic core; business entities belong to applications.
- Configuration- and metadata-driven; API-first; secure by default.
- Modular monolith by default, not microservices.
- Server-side authorization on every protected surface.
- Do not replace working components to adopt a pattern.

## 1. Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer D  Business Applications (HRIS, generic example, future apps)   │
│   register modules, resources, actions, events, workflows, reports    │
├──────────────────────────────────────────────────────────────────────┤
│ Layer C  Administration Console (Next.js /setup)                      │
│   metadata-driven CRUD over registry-backed resources, RBAC-aware nav │
├──────────────────────────────────────────────────────────────────────┤
│ Layer B  Shared Platform Services                                     │
│   identity · workflow · notifications · integrations · api platform   │
│   files · jobs · observability · data governance · ai                 │
├──────────────────────────────────────────────────────────────────────┤
│ Layer A  Platform Core                                                │
│   registry · configuration · authn · authz/policy · audit · events    │
│   api conventions · migrations · tenant context                       │
└──────────────────────────────────────────────────────────────────────┘
```

The API is one NestJS process; the worker is a second process sharing the queue
contract. Module boundaries are logical and enforced by dependency direction, not by
network calls.

## 2. Layer A — Platform Core

### 2.1 Registry service (new, foundational)

A DB-backed metadata registry is the backbone of the universal platform. It stores
**platform-wide reference data** (like `roles`/`permissions`, no `companyId`):

- `Application` — key, name, description, status, version.
- `AppModule` — key, application, name, status; maps to the web `ModuleId`.
- `ResourceDefinition` — key, module, display name, type, layout hints, API policy,
  audit policy, schema version.
- `ResourceField` — resource, key, data type, required, unique, searchable, filterable,
  listable, validation, reference target, default.
- `RegisteredAction` — resource (or `*`), action key, label, sensitive flag.

Resource types: `ENTITY`, `VIEW`, `EXTERNAL`, `CUSTOM`, `SYSTEM`.

**Migration path:** the registry is seeded from the current `MODULE_IDS`, `RESOURCES`
and `ACTIONS` so nothing changes on day one. Runtime registration then adds rows. The
hardcoded constants become the **bootstrap seed**, not the runtime source of truth;
`RESOURCES`/permission drift tests remain until the permission definitions move into
the registry.

### 2.2 Configuration service (extend existing settings)

- Keep `system_settings` (company scope) as-is.
- Add a **precedence model**: system default → application → module → company →
  user/tenant override. Store the new scopes as `system_settings` rows in dedicated
  groups first; introduce a `configuration_schema` registry later for typed
  validation.
- Add **feature flags** as a first-class setting type (`BOOLEAN` with a known key
  namespace `feature.*`), surfaced in the console and read through the existing
  `SettingsService`.

### 2.3 AuthN / AuthZ

- AuthN stays exactly as implemented (opaque sessions, MFA, SSO, passkeys).
- AuthZ evolves so **permission definitions come from the registry**:
  `Permission` rows are generated from `ResourceDefinition` × `RegisteredAction`.
  The existing `role_permissions` grant model is unchanged.
- **Record-level enforcement** becomes real: a scope resolver translates a grant's
  `dataScope` (+ `scopeId`) into a query constraint applied by the data-access layer.
  `SELF`/`COMPANY` are implementable immediately; `TEAM`/`DEPARTMENT`/`ENTITY` need
  the org hierarchy (exists) and a resolver. Default deny when a scope cannot be
  resolved.

### 2.4 Events and extension points

- Introduce an **event contract**: synchronous in-process domain events and
  asynchronous integration events.
- Persist integration events in an **outbox** table written inside the same tenant
  transaction, drained to BullMQ by the worker, so delivery is reliable.
- Extension points are registry rows plus fixed server-side hooks — never uploaded
  executable code.

## 3. Layer B — Shared Platform Services

| Service | Exists | Plan |
| --- | --- | --- |
| Identity | Yes | Keep; add service accounts/machine identities |
| Notifications | Yes | Keep; generalise provider boundary via integrations |
| Jobs/queue | Yes | Keep; add outbox drain + scheduled tasks + idempotency keys |
| Observability | Yes | Keep; add API access log surface + metrics |
| Workflow | No | New: definitions/versions, transitions, approvals, delegation, SLA |
| Integrations | Partial | New registry + adapter interface; email becomes the first adapter |
| API platform | No | New: API clients, scopes, credentials, rate limits, usage, webhooks |
| Files/storage | Infra only | New adapter over RustFS: upload/authz/metadata/retention |
| Data governance | No | New: classification, masking, retention, import/export |
| AI | No | New: provider/model/prompt/tool registries; permission-aware execution |

Workflow and AI are **optional**: their absence must not break core functionality.
This is already true today (no runtime dependency), and the design preserves it.

## 4. Layer C — Administration Console

- Reorganise `/setup` into the ten sections defined by the master prompt. Navigation
  is generated from registered capabilities + permissions, de-duplicated by resource
  key, and hides disabled optional services.
- Build **one metadata-driven CRUD surface** (table + form + detail) that renders a
  `ResourceDefinition`. Concrete admin screens (users, roles, API clients, …) become
  configurations of that surface where possible, with bespoke screens only where the
  domain logic demands it.
- The permission manager is a resource × action × scope matrix backed by the
  registry, not a hardcoded frontend matrix.

## 5. Layer D — Business applications

- The HRIS features become the **first application** registered in the registry.
- A small **generic example application** (`Project`, `Task`) demonstrates: module
  registration, resource + field registration, generic CRUD, a custom action with its
  own handler, and an event consumer — all without touching core source.

## 6. Data and tenancy

- Add registry/configuration/api/workflow/integration/AI metadata tables as
  **platform-wide** reference data (no RLS) where they are global, and as
  **tenant-scoped** tables (RLS) where they hold tenant secrets or tenant-specific
  configuration.
- Every tenant-scoped request already establishes trustworthy context via
  `withTenantContext`; new tables follow the same pattern.
- Multi-tenancy isolation strategy stays **shared schema + RLS** (`Company` = tenant),
  documented, not per-tenant databases.

## 7. API conventions and security model

- Keep the envelope, error codes, cursor pagination, correlation IDs and versioning.
- New developer-facing endpoints (API clients, webhooks, registry) use the same
  envelope and are gated by the same guard.
- Secret material is encrypted at rest (existing `CredentialCipherService`) and never
  returned by read APIs (masking pattern already used for settings).
- Default deny everywhere: unknown permission, unresolved scope, missing cached
  principal → refuse.

## 8. Non-goals (explicit)

- No microservices, no service mesh, no separate databases per tenant by default.
- No generic unrestricted query endpoint; generic CRUD is opt-in per resource.
- No arbitrary code upload or SQL execution from the console.
- No mandatory external AI or messaging provider.
