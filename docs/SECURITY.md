# Security

## Priority

Where requirements conflict, the order is:

1. **Security** — confidentiality, integrity, availability.
2. **Data integrity** — payroll and attendance must be correct and auditable.
3. **Correctness** — features behave as specified.
4. **Performance** — fast enough.
5. **Maintainability**, **cost**, **developer velocity**.

Performance never justifies a weaker permission check. Maintainability never
justifies an unauditable change to a payroll figure.

## What the platform holds

This is the reason the controls below are strict rather than conventional:

- National identity numbers, tax identifiers, bank account details
- Salaries, payslips, compensation history, bonus and commission data
- Medical leave reasons, disability and accommodation records
- Attendance and geolocation history
- Performance reviews, disciplinary records, grievance files
- Union membership and collective bargaining agreements
- Immigration status and work permit expiry

A breach is a reportable privacy incident in most jurisdictions, and employee
monitoring data is among the most heavily regulated categories. Payroll fraud is
an insider risk that external controls do not address.

## Trust boundaries

```
  Untrusted                    │  Trusted
  ─────────────────────────────┼───────────────────────────────────
  Browser, mobile app          │  API process
  Request bodies, headers,     │  Database, Redis, queue
  query strings, uploads       │  Secrets from the secret manager
  ─────────────────────────────┼───────────────────────────────────
                               │  Background workers
                               │  Run with the same authorisation
                               │  rules as the request path
```

Everything left of the first line is attacker-controlled. The API treats it that
way without exception.

### Rules that are absolute

- **Never trust a client-supplied role.** Roles come from the database on every
  request. A role in a request body, a header or a JWT the client can edit is
  ignored.
- **Never trust a client-supplied tenant identifier.** Company, entity, division,
  department and team ids are resolved from the session and re-validated against
  the record being accessed.
- **Never trust client-supplied identifiers of any kind.** Employee, user and
  document ids are all looked up server-side. Guessing an id must not be
  sufficient to read a record.
- **Authorisation is not optional and not middleware-only.** Guards check the
  action; the data scope check happens where the query is built. A repository
  method that can be called without a scope does not exist.
- **Background jobs run the same checks.** A queued job re-resolves permissions
  when it runs. Permissions can change between enqueue and execution, and a job
  that captured "may approve" at enqueue time will eventually act on stale
  authority.

## Controls implemented in phase 0

### Transport and headers

Applied to every API response:

| Header                       | Value                                          |
| ---------------------------- | ---------------------------------------------- |
| `X-Content-Type-Options`     | `nosniff`                                      |
| `X-Frame-Options`            | `DENY`                                         |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`              |
| `X-DNS-Prefetch-Control`     | `off`                                          |
| `Cross-Origin-Opener-Policy` | `same-origin`                                  |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(self)`  |
| `Strict-Transport-Security`  | Set at the proxy; see [DEPLOYMENT.md](DEPLOYMENT.md) |

`Helmet` applies these defaults in the API, and the web application sets its own
in `next.config.ts`. HSTS is applied by the reverse proxy, because only the proxy
knows the public hostname and TLS configuration.

### Content Security Policy

The web application uses a **per-request nonce**, generated in middleware, so
`script-src` does not need `'unsafe-inline'`:

```
script-src 'self' 'nonce-<per-request>' 'strict-dynamic'
```

Every page is therefore rendered dynamically. A statically prerendered page is
served from a prebuilt HTML file that the middleware cannot touch, so its inline
scripts would carry no nonce and every one of them would be blocked. This is also
the correct model for an authenticated application: a cached static artefact must
never be served to a second user.

`connect-src` names the API origin explicitly. It is computed with `new URL(...).origin`
rather than by string-concatenating a base URL, because CSP source lists take
origins and not paths — `http://api:3001/api/v1` does not mean what it looks like,
and a malformed value falls back to a fixed origin rather than widening to `*`.

`'unsafe-inline'` remains in `style-src` only. Next.js emits inline styles for
critical CSS, which cannot be nonced reliably.

### CORS

The allowed origin list is explicit and never `*`. Credentialed requests and a
wildcard origin are mutually exclusive anyway, and a wildcard would disable the
protection entirely.

### Validation

A global `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and
`transform`. Undeclared properties are stripped, and a request that tries to send
one is rejected rather than quietly ignored — silent stripping hides client bugs
until they become data-integrity bugs.

### Error handling

A global exception filter maps every failure to the standard envelope. Internal
messages, stack traces, SQL fragments, file paths and upstream hostnames are
logged and never returned. Unknown error codes arriving from a newer API are
treated as `INTERNAL_ERROR` by clients rather than trusted.

### Logging

- Structured JSON, one object per line.
- Correlation IDs on every request, propagated to responses, errors and background
  jobs.
- **No request or response bodies, no query strings, no authorization headers.**
  An HRIS log containing bodies would hold salary and medical data, converting
  routine log retention into a personal-data retention obligation.
- Inbound correlation IDs are length-bounded and character-restricted before use,
  because attacker-controlled text reaches the logs.

### Secrets

- `.env` is git-ignored. `.env.example` carries development-only placeholders.
- Production secrets come from a secret manager and are injected as environment
  variables. No secret is baked into an image.
- Validation fails fast at boot. A missing or malformed variable stops the process
  with a full list of problems rather than surfacing later as a null dereference.
- Passwords are never logged, including at debug level.

### Dependency supply chain

npm 11 blocks dependency install scripts by default. The root `allowScripts` field
records an explicit decision for every package that needs one:

- `esbuild` is allowed: its postinstall links the platform binary.
- `@scarf/scarf` is denied: it is a download-analytics agent and has no business
  running during an install.

Approving an install script is a security decision, not a build fix. It should come
with a reason in the pull request.

### Container hardening

- Non-root user (`hris`) in both application images.
- `no-new-privileges` on every service.
- Read-only host filesystem for the application containers, with only the Next.js
  image cache writable.
- `tini` as PID 1 so `SIGTERM` reaches the application and Nest's shutdown hooks
  drain in-flight requests instead of dropping them.
- Pinned major versions for infrastructure images; digest pinning is added at
  release.

## System menu security (M00)

The System menu owns the account-security surfaces. They are implemented, not
scheduled, and each is covered by end-to-end tests in `apps/api/test`.

| Capability | Where | Notes |
| ---------- | ----- | ----- |
| Multi-factor authentication | `apps/api/src/modules/mfa` | TOTP (RFC 6238) verified by an internal, dependency-free helper. The shared secret is AES-256-GCM encrypted with `AUTH_MFA_ENCRYPTION_KEY` before it touches the database; recovery codes are stored as hashes and burned on use. The sign-in challenge is single-use in Redis and expires after five minutes. |
| Single sign-on | `apps/api/src/modules/sso` | OIDC (authorization code + PKCE, state and nonce) and SAML 2.0 (SP-initiated, signed assertion expected). Client secrets are encrypted with `SSO_ENCRYPTION_KEY`. Provider discovery and lookup run before a session exists, so they use `SECURITY DEFINER` functions (`app_sso_find_provider`, `app_sso_find_providers_for_email`) that are RLS-safe and execute-only for the app role. Identities link by subject first, then by verified email to an ACTIVE user in the same company; anything else fails closed. |
| Passkeys (WebAuthn) | `apps/api/src/modules/passkeys` | Registration and assertion are verified by `@simplewebauthn/server`. The signature counter is persisted on each assertion to detect cloned authenticators; challenges are single-use in Redis. Disabled unless `WEBAUTHN_ENABLED=true`. |
| Approval authority | `apps/api/src/modules/approvals` | Stores and validates who may approve what, up to a monetary limit, and temporary delegations. **Enforcement is out of scope here**: routing real approvals through these rules belongs to the M07 workflow engine. |
| Background jobs | `apps/api/src/modules/queue` | Observing queues is `queue:view`; retrying, removing and pausing is `queue:manage`. The two are separate grants because inspecting a backlog and discarding failed jobs are different levels of trust. |

Relevant environment variables: `AUTH_MFA_ENCRYPTION_KEY`, `SSO_ENCRYPTION_KEY`,
`WEBAUTHN_ENABLED`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`,
`API_PUBLIC_URL` and `WEB_APP_URL`. See `.env.example`.

## Record-level data scope (Phase 3)

A capability grant is not access on its own: the widest `dataScope` the caller holds
for a `resource.action` is turned into a query constraint by
`apps/api/src/common/auth/data-scope.ts` before the data layer runs.

- `GLOBAL` and `COMPANY` mean "every row the tenant context exposes"; the company
  boundary is enforced by row-level security and `withTenantContext`, not by an extra
  predicate.
- `SELF` narrows reads to the caller's own row.
- `TEAM`/`DEPARTMENT` narrow to the organizational subtree rooted at the unit the caller
  is placed in (`User.organizationalUnitId`); `ENTITY` narrows to that unit's legal
  entity. A grant carrying a `scopeId` anchors the scope at that unit instead. A
  recursive walk (`findOrgUnitSubtree`/`findOrgUnitEntity`, depth-bounded) resolves the
  subtree, so the constraint is a real query predicate, not a post-filter.
- An org scope with no unit to resolve (no caller placement and no `scopeId`)
  **default-denies**, so a scope the platform cannot resolve never silently widens access.
- The check raises `OUT_OF_SCOPE` (403) when a scope cannot be resolved; a row outside a
  resolved scope is simply not returned (404 on a single read, absent from a list).

Enforcement is applied today to `user.view` (`AccessService.listUsers`/`getUser`) and to
the generic `records` layer for every registry-declared, `supportsCrud` resource, and is
covered by `apps/api/test/data-scope.e2e-spec.ts` (SELF, COMPANY, TEAM, DEPARTMENT,
ENTITY, unresolved default-deny, and cross-tenant). Other bespoke resources adopt the
resolver as their read paths are hardened.

Custom record actions are authorised the same way: the generic action route resolves the
handler's declared `resource.action` from the caller's live permissions (and rejects a
handler whose declared resource does not match the record's resource) before the handler
runs, so registering an action never widens access. See
`apps/api/test/example-app.e2e-spec.ts` for the denial and conflict paths.

Authority cannot be manufactured. `canGrant` in the same module backs an escalation
guard in `AccessService`: creating a role, replacing a role's grants, or assigning a
role to a user is refused unless the actor already holds every granted
`resource.action` at a scope at least as wide. A delegated administrator with
`role.manage`/`user.manage` at COMPANY cannot mint a GLOBAL grant, grant a capability
they lack, or hand out `SYSTEM_ADMIN`. Covered by
`apps/api/test/privilege-escalation.e2e-spec.ts`.

- A key is bounded by a fixed-window rate limit keyed on the client id
  (`API_RATE_LIMIT_PER_MINUTE`, default 600), enforced in the authentication guard so a
  machine principal cannot exhaust tenant capacity. A spent window returns
  `429 RATE_LIMITED` with `Retry-After`. The same `RateLimiter` backs the per-IP sign-in
  throttle.

## Machine credentials (Phase 4)

Developer API clients are the platform's first non-human principals.

- The secret is 256 bits of randomness, shown once at creation/rotation and stored only
  as a SHA-256 hash (`api_clients.secret_hash`). A leaked hash is not usable as a
  credential.
- The key carries no authority of its own: its scopes are validated at creation against
  the `resource.action` vocabulary *and* against what the creator may grant (`canGrant`),
  so a client cannot be minted with capability its creator lacks. At request time each
  scope is re-parsed, so an unknown scope fails closed.
- Authentication is a cross-tenant `SECURITY DEFINER` lookup by the public `clientId`
  (`app_api_find_client`), executed before any tenant context exists, followed by a
  constant-time hash comparison. Rotation, disabling and deletion revoke on the next
  request because the row is read every time.
- The client principal is synthetic (`roles: [API_CLIENT]`) and its permissions are the
  granted scopes at `COMPANY` breadth; it has no user placement, so org-scoped resources
  are out of reach until narrower machine scopes are modelled.

Covered by `apps/api/test/api-clients.e2e-spec.ts`.

## Workflow transition authorisation (Phase 5)

The workflow engine is a place where authority could easily be laundered, so every
transition is a fresh authorisation decision rather than a property of the instance:

- The transition's `requiredPermission` (a real `resource.action`, defaulting to
  `workflow.approve`) is checked against the caller's live permissions on each request,
  so revoking a grant stops in-flight transitions immediately.
- A transition that declares `requiresApproval` additionally requires an effective
  `ApprovalAuthority` rule for the resource (matched to the actor directly or through a
  role), or an active `ApprovalDelegation` to the actor from someone who holds one. The
  effective window (`effectiveFrom`/`effectiveTo`) is evaluated at request time.
- Publishing a version only defines *which* permission a transition needs; it grants no
  authority, because a caller can only ever name a permission and must still hold it to
  execute the transition.
- Every applied transition is appended to `workflow_transition_events` and audited;
  failed attempts are rejected before any write.

Covered by `apps/api/test/workflows.e2e-spec.ts`.

## Integration credentials (Phase 5)

The integration registry is configured by administrators, which makes it an attractive
place to smuggle a credential into a lower-protected store, so the constraints are
enforced in code rather than by convention:

- An integration's `config` is validated recursively and any key that looks like a
  credential (`password`, `secret`, `token`, `apiKey`, `privateKey`, ...) is rejected
  with a validation error, so secrets cannot be persisted in cleartext on the record.
- Adapters read the secrets they need from encrypted System Settings; the email adapter
  resolves `email.smtpHost`/`email.smtpPort` (or a non-secret host/port override) and
  never reads a credential from the integration. Connection tests therefore run without
  ever returning a secret.
- The connection test is gated on `integration.manage` because it performs a server-side
  network request that could otherwise be used to probe internal hosts.
- Every configuration change and connection test writes a hash-chained audit row, and the
  append-only `integration_deliveries` ledger records each operation's outcome.

Covered by `apps/api/test/integrations.e2e-spec.ts`.

## Controls scheduled for later phases

Stated explicitly so that nothing in this repository is mistaken for a finished
security posture:

| Control                                              | Phase |
| ---------------------------------------------------- | ----- |
| Authentication, sessions, refresh rotation, revocation | 2     |
| RBAC roles, permissions and data-scope enforcement   | 2     |
| Immutable audit log with hash chaining                | 2     |
| Field-level encryption for sensitive attributes      | 4     |
| Object storage with signed URLs and malware scanning | 8     |
| Attachment scanning and content-type verification    | 8     |
| Payroll approval workflow with segregation of duties | 11    |
| SAML/OIDC SSO and SCIM provisioning                  | 2     |
| Rate limiting per principal and per IP               | 2     |
| Encryption at rest for sensitive columns             | 4     |
| Data subject access and erasure workflows            | 14    |

## Reporting a vulnerability

Report privately to the security contact rather than opening a public issue.
Include reproduction steps and the affected component. Do not include real
personal data; synthetic records are sufficient and preferred.

Acknowledgement is expected within two business days. Disclosure is coordinated
with the reporter, and affected parties are notified as required by law.

## Rules for contributors

- Do not weaken a control to make a test pass. Fix the test or the design.
- Do not add a dependency to solve a problem ten lines can solve. Every
  dependency is permanent supply-chain surface in a system holding payroll data.
- Never log, alert on, or export sensitive personal data to an external service.
  This includes AI providers; see [AI_SPEC.md](AI_SPEC.md).
- Any change touching authorisation, money or audit must come with a test that
  fails without the change.
