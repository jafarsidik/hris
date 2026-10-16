# API

The API is the only place business rules are enforced. Web and mobile clients are
transport and presentation layers; they hold no authoritative state and no
trusted identifiers.

## URL structure

```
/health                      liveness and readiness, unversioned
/health/live                 process is up
/health/ready                process can serve traffic
/api/v1/...                  versioned business endpoints
/api/docs                    OpenAPI explorer (never enabled in production)
```

- **Business routes are versioned and prefixed.** Nest matches the global prefix
  and version before the controller, so `/api/v1/...` is the only shape a business
  endpoint may take. An unversioned business route does not exist.
- **Health routes are deliberately unversioned.** A load balancer, an orchestrator
  or an uptime monitor must not need to know which API version is deployed, and
  changing the API version must never break a probe that is already wired up.
- Versioning is URI-based. A breaking change produces `/api/v2/...` while v1 is
  served; v1 is removed only after usage has stopped and a deprecation window has
  elapsed.

## Response envelope

Every business endpoint returns the same shape:

```json
{ "success": true, "data": { "id": "…", "employeeCode": "HR-000123" } }
```

```json
{
  "success": false,
  "error": {
    "code": "OUT_OF_SCOPE",
    "message": "The requested record is outside your permitted data scope",
    "details": [],
    "correlationId": "3f2504e0-4f89-41d3-9a0c-0305e82c3301"
  }
}
```

`code` is a stable machine-readable identifier from `API_ERROR_CODES`. Clients
branch on it. `message` is written for a human and may be shown as-is; it is
sanitised by the API and never contains a stack trace, SQL fragment, internal
hostname or file path.

### Raw responses

A small number of endpoints return their payload directly, with no envelope:

- **Health probes.** A probe must not depend on the business envelope, and a
  monitoring client should not have to unwrap it to read a status.
- **File downloads and streams.** Enveloping a binary body is meaningless.
- **Server-sent events**, where the body is a stream of events.

Raw responses are opt-in per handler through `@RawResponse()`. The consequence is
that the client must use the matching non-enveloping call — routing a raw endpoint
through the enveloped helper reports a healthy service as unavailable, which is
the exact failure mode this note exists to prevent.

## Error codes

`API_ERROR_CODES` in `@hris/shared-types` is the canonical list, and this table is its
documentation rather than a second source. An earlier version of this table listed
eleven codes and spelled the 422 as `UNPROCESSABLE`, while the implementation emitted
`UNPROCESSABLE_ENTITY`; a client branching on the documented spelling would have
fallen through to `INTERNAL_ERROR`. When the two ever disagree again, the code wins and
this table is the thing that is wrong.

| Code                     | Status | Meaning                                                       |
| ------------------------ | ------ | ------------------------------------------------------------- |
| `VALIDATION_ERROR`       | 400    | Request failed validation; `details` lists the fields          |
| `UNAUTHENTICATED`        | 401    | No valid session. Sign in again                                |
| `INVALID_CREDENTIALS`    | 401    | Credentials rejected. Deliberately distinct from `UNAUTHENTICATED`, which means no session was presented at all |
| `MFA_REQUIRED`           | 401    | Credentials accepted but a second factor is required. The client re-prompts rather than treating it as a failed sign-in |
| `INVALID_MFA`            | 401    | The presented second factor (TOTP, recovery code or passkey) was rejected. The first factor remains valid, so the client stays on the second-factor step |
| `FORBIDDEN`              | 403    | Authenticated, but not permitted to perform this action        |
| `OUT_OF_SCOPE`           | 403    | The record exists but is outside the caller's data scope       |
| `NOT_FOUND`              | 404    | No such record, or none the caller may see                     |
| `CONFLICT`               | 409    | Uniqueness or concurrency conflict                             |
| `PRECONDITION_FAILED`    | 412    | A workflow precondition is not met                             |
| `PAYLOAD_TOO_LARGE`      | 413    | Upload or request body exceeded the limit                      |
| `UNSUPPORTED_MEDIA_TYPE` | 415    | Content type not accepted by the endpoint                      |
| `UNPROCESSABLE_ENTITY`   | 422    | Well-formed but semantically impossible                        |
| `RATE_LIMITED`           | 429    | Too many requests; `Retry-After` is set                        |
| `INTERNAL_ERROR`         | 500    | Unexpected server fault. Details are logged, never returned    |
| `NOT_IMPLEMENTED`        | 501    | Endpoint exists in the contract but not in this deployment     |
| `SERVICE_UNAVAILABLE`    | 503    | A dependency is unavailable                                    |

The three authentication codes are separated because a client reacts differently to
each. `UNAUTHENTICATED` means "no session, send the user to sign in". `INVALID_CREDENTIALS`
means "the sign-in form was wrong, show the error on the form". `MFA_REQUIRED` means the
form was right and the flow must continue. Collapsing them produces a sign-in page that
either loops on a correct password or discards a valid session on a missing header.

`NOT_IMPLEMENTED` exists so a module that has not been built reports that fact
honestly. Returning `INTERNAL_ERROR` for a deliberately absent feature trains operators
to ignore 5xx, which is the opposite of what a monitoring surface is for.

`OUT_OF_SCOPE` is separated from `NOT_FOUND` deliberately. A record outside the
caller's scope and a record that does not exist produce different answers on
purpose: collapsing them into a single 404 hides authorization bugs during
development, and the audit trail needs to distinguish "denied" from "absent".

An unknown `code` arriving from a newer API is treated as `INTERNAL_ERROR` by the
clients. A client must never trust an unrecognised code from the wire.

## Pagination

List endpoints are cursor-based, never offset-based. Offset pagination skips and
repeats rows when data is inserted between requests, which makes a payroll export
silently wrong.

```json
{
  "success": true,
  "data": {
    "items": [],
    "pageInfo": { "hasNextPage": false, "endCursor": null }
  }
}
```

Filters and sort order are part of the cursor. A caller that changes either starts
a new sequence rather than continuing a corrupt one. Page sizes are capped
server-side; a client cannot request an unbounded page.

## Correlation IDs

Every request carries `X-Correlation-Id`. The API generates one when the inbound
value is absent or fails validation (max 64 characters, restricted to
`[A-Za-z0-9_-]`), and returns it on the response and in every error body.

This is how a user reports "it failed at 09:14" and an engineer finds every log
line for that single request across the API, the queue and the web tier.

Inbound correlation IDs are never trusted verbatim: an attacker-supplied value
reaches the logs, so it is length-bounded and character-restricted before use.

## Access logging

The access log records method, path, status, duration and correlation ID.

It does **not** record request or response bodies, query strings, or
authorization headers. An HRIS log that captured bodies would contain salary,
medical leave reasons and national identity numbers, and would turn a routine log
retention policy into a personal-data retention obligation.

## Authentication

Not implemented; scheduled for phase 2. The decision is recorded in
[ADR/0006](ADR/0006-session-tokens.md):

- Access and refresh tokens are `httpOnly`, `Secure`, `SameSite=Strict` cookies.
  They are never placed in `localStorage` or `sessionStorage`, because any
  successful script injection then becomes full session theft.
- The access token is short-lived (15 minutes by default) and the refresh token is
  rotated on every use, with reuse detection invalidating the whole family.
- Sessions are revocable server-side. A stateless token alone cannot be revoked
  before it expires, which is unacceptable for payroll access.
- Browser-originated state-changing requests require CSRF protection.

## Authorisation

Two independent checks, both server-side:

1. **Permission** — may this principal perform this action on this resource type?
2. **Data scope** — which records may they perform it on: own, self and reports,
   their department subtree, their entity, or the whole company?

A request never supplies its own scope. Any client-supplied entity, company,
department or employee identifier is treated as a hint and re-validated against
stored state before use.

### API keys

A machine client authenticates with a key presented as `Authorization: Bearer
hris_ak_<clientId>.<secret>` or in the `X-Api-Key` header. The key is resolved through a
cross-tenant lookup by its public `clientId`, then the secret is compared as a SHA-256
hash in constant time. The resulting principal carries exactly the scopes the client was
granted (each a `resource.action`), at company breadth, and nothing else. Keys are
managed under `/api/v1/developers/clients` gated on `api-client:*`; rotation, disabling
and deletion take effect on the next request. The secret is returned only when a client
is created or rotated — it is never readable again.

### API usage and request log

Two read-only developer surfaces, both gated on `api-client:view`, expose how the
machine clients are being used. They cover only requests that authenticated with a key:
browser traffic is not attributed to a client and is recorded by the ordinary access
log instead.

- `GET /api/v1/developers/usage` — a per-client rollup for a window. Optional `from`
  and `to` (ISO-8601, inclusive) bound the window; `clientId` narrows to one client. The
  response carries one row per client (`requestCount`, `errorCount`, `avgDurationMs`;
  errors counted as status `>= 400`), plus `totalRequests` and `totalErrors`. The whole
  window is aggregated server-side, so the totals are complete rather than a page of
  them.
- `GET /api/v1/developers/requests` — the individual recorded requests, newest first,
  cursor-paginated under the shared contract. Accepts the same `from`/`to`/`clientId`
  filters plus `cursor`/`limit`. Each entry records the method, path, status code,
  duration and correlation id. **Only the path is stored, never the query string or
  request body**, so query-borne secrets are not persisted.

The log is append-only and pruned by deleting the client: rows reference
`api_clients` with `ON DELETE CASCADE`, and the table is under the same tenant row-level
security policy as every other tenant table.

### Generic resources

A registry resource with `supportsCrud` is served by a single generic surface,
`/api/v1/records/:resource[/:id]` (`GET`, `POST`, `PATCH`, `DELETE`). Because the
resource is named in the path, these routes cannot carry a static
`@RequirePermission`; the controller resolves capability and scope from the
caller's live permissions on every request. The request body is validated against
the resource's registered `resource_fields` — unknown keys are rejected. The
optional reserved key `unitId` places a record in the organizational hierarchy;
`ownerUserId` and `organizationalUnitId` are stored as real columns so `SELF`,
`TEAM`/`DEPARTMENT` and `ENTITY` grants remain row-level predicates.

#### Custom actions

A resource may register custom actions beyond the standard CRUD verbs; they are
dispatched through `POST /api/v1/records/:resource/:id/actions/:action`. The action
registry is keyed by `resource` + `action` and each definition names the permission it
requires (for example the example application's `task.complete` reuses the standard
`task.update` grant). The handler may return a `patch` (validated against the registered
fields and merged into the record), a `result` envelope, and `events`, which the platform
emits on an in-process domain-event bus after the write commits. An unregistered action
returns `404`; a caller lacking the action's permission gets `403`.

#### Example application

The seeded "Projects" application demonstrates the extension mechanism: the `project` and
`task` resources are registered entirely through metadata (with the standard actions plus a
custom `complete` on `task`), so they are served by the generic CRUD surface above, and
completing a task emits `task.completed`.

### Workflows

Authoring a configurable state machine uses `/api/v1/workflows` gated on `workflow:*`:

- `GET /workflows`, `GET /workflows/:id` — definitions with their version list.
- `POST /workflows` — create a definition (a draft v1 is created automatically).
- `PATCH` / `DELETE /workflows/:id`.
- `POST /api/v1/workflows/:id/versions` — clone the latest version into a new draft.
- `PUT /api/v1/workflows/:id/versions/:version` — replace a draft's `states` and
  `transitions` (validated: unique keys, exactly one initial state, known endpoints).
- `POST /api/v1/workflows/:id/versions/:version/publish` — validate, activate, and
  archive the previous active version.

Runtime is served under `/api/v1/workflow-instances`. Starting an instance requires
`workflow:create`, listing/getting requires `workflow:view`, and cancelling requires
`workflow:manage`. Executing a transition (`POST /:id/transitions`) is authorised per
transition by the engine: it must satisfy the transition's `requiredPermission`
(defaulting to `workflow:approve`) and, when the transition declares `requiresApproval`,
the actor must be an effective approver under the `ApprovalAuthority` rules or an active
delegation. Every transition is appended to the instance history.

### Integrations

The integration registry (`/api/v1/integrations`, gated on `integration:*`) stores one
non-secret record per configured adapter instance for a tenant:

- `GET /integrations`, `GET /integrations/:id` — list and read configured integrations.
- `POST /integrations` — create one (`key`, `name`, `kind`, `provider`, optional
  `config`, `isEnabled`, and for a webhook an `events` list). The `kind` must have a
  registered adapter; `EMAIL` and `WEBHOOK` ship today, so other kinds are rejected until an
  adapter ships.
- `PATCH` / `DELETE /integrations/:id` — update or soft-delete.
- `POST /integrations/:id/test` — run the adapter's connection test (`integration:manage`),
  record the outcome and update the integration's `status`/`lastCheckedAt`/`lastMessage`.
- `GET /integrations/:id/deliveries` — the append-only operation ledger (connection
  tests and outbound deliveries), newest first, capped at 100 rows.
- `GET /integrations/:id/subscriptions`, `PUT /integrations/:id/subscriptions`
  (`integration:update`) — read and replace a webhook's event-type subscriptions; `*`
  subscribes to every event.
- `POST /integrations/:id/secret` (`integration:manage`) — mint a new webhook signing
  secret, returned exactly once.

`config` is validated to reject credential-like keys, so secrets stay in encrypted
System Settings. The email adapter resolves the tenant's SMTP relay from the `email.smtpHost`
and `email.smtpPort` settings (or an explicit `host`/`port` override in `config`) and
probes it over TCP; a webhook requires an absolute `config.url`. Secrets are never read
from the integration record.

### Organizations

The organizational structure is served under `/api/v1/organization`, gated on
`organization:*`:

- `GET /organization/entities`, `GET /organization/entities/:id` — legal entities.
- `POST /organization/entities` (`organization:create`) — create one (`code`, `name`,
  `countryCode`, `currencyCode`).
- `PATCH /organization/entities/:id` (`organization:update`), `DELETE` (`organization:delete`).
  An entity that still has units cannot be deleted (`409`).
- `GET /organization/units`, `GET /organization/units/:id` — the unit tree, filterable by
  `entityId`, `parentId`, `type` and `search`.
- `POST /organization/units` (`organization:create`) — create one (`code`, `name`, `type`,
  optional `entityId`, `parentId`). Placement is validated against the caller's scope; a
  cycle (a unit parented under its own descendant) is rejected (`400`).
- `PATCH /organization/units/:id` (`organization:update`), `DELETE` (`organization:delete`).
  A unit with children or assigned users cannot be deleted (`409`).

Every read is narrowed by the caller's data scope, so a delegated administrator sees only
their subtree. Users are placed on a unit through `organizationalUnitId` on
`POST`/`PATCH /users`, resolved and re-validated server-side rather than trusted from the
body. The same scope resolver narrows `GET /logs` and `GET /logs/audit`: `GLOBAL`/`COMPANY`
callers see the whole tenant, `SELF` sees only their own actor rows, and any narrower org
scope default-denies because the log carries no organizational dimension.

## OpenAPI

Generated from decorators and served at `/api/docs` (explorer) and `/api/docs-json`
(the raw document). **Disabled by default in production** because the explorer
enumerates the entire authenticated attack surface. Staging keeps it enabled for
consumers.

`buildOpenApiDocument` (`apps/api/src/openapi.ts`) is the single definition used by both
the explorer and any consumer export. The document declares two credential schemes: a
human session (`access-token`, an opaque bearer token also accepted from the
`hris_session` cookie) and a developer API key (`api-key`, sent as `X-API-Key` or as
`Authorization: Bearer hris_ak_...`). The public health probes are `@ApiExcludeEndpoint()`
and intentionally absent.

The console's **API Documentation** page (`/setup/api/docs`, gated on `api-client.view`)
links to the served explorer and the raw document rather than restating the spec; if the
explorer is disabled on an environment the page says so instead of appearing broken.

Spec drift is a real risk when documentation is generated and then diverges. Two
measures keep it honest: the spec is generated from the code that serves the requests,
so it cannot describe an endpoint that does not exist; and
`apps/api/test/openapi.e2e-spec.ts` re-reads the served document to assert the routes and
security schemes consumers depend on are still present, so a refactor that silently
drops one fails the suite.

## Client contract

`@hris/shared-types` exports the envelope, error codes, pagination types and
branded identifiers used on both sides.

Identifiers are branded, so mixing them up is a compile error rather than a
production incident:

```ts
declare const employeeIdBrand: unique symbol;
export type EmployeeId = string & { readonly [employeeIdBrand]: 'EmployeeId' };
```

`EmployeeId`, `UserId` and `DepartmentId` are all `string` at runtime and
mutually unassignable at compile time. Passing a department id where an employee
id is expected does not compile.

## Adding an endpoint

1. Define the DTO with `class-validator` decorators; the global `ValidationPipe`
   strips unknown properties and rejects anything undeclared.
2. Wrap it in an interceptor only if it genuinely needs one.
3. Add a `@Public()` decorator if it must be reachable without a session. Health
   probes and sign-in are the only intended candidates.
4. Throwing a typed `AppError` subclass is enough to produce the standard error
   envelope; the global exception filter handles the mapping.
5. Test the endpoint through `configureApp()` so the test exercises the same
   middleware, filters and pipes as production.
6. Document any new error code in this file and in `shared-types` together.
