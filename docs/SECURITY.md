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
