# Phase status

Phase 0 is complete. Nothing beyond it has been started, and this document exists so
that nothing delivered so far is mistaken for a finished feature.

## Summary

| Phase | Module                                            | Status      |
| ----- | ------------------------------------------------- | ----------- |
| 0     | Foundation, architecture, tooling, infrastructure | **Complete** |
| 1     | Database, Prisma schema, migrations, seeds, Redis | Not started |
| 2     | Identity and access: SSO, SCIM, RBAC, audit log   | Not started |
| 3     | Multi-company, entities, departments, cost centres | Not started |
| 4     | Core HR: contracts, lifecycle, compliance         | Not started |
| 5     | Payroll engine                                    | Not started |
| 6     | Attendance, timesheets, geofencing, schedules     | Not started |
| 7     | Leave, holidays, claims, expenses, letters        | Not started |
| 8     | Administration, workflow engine, file management  | Not started |
| 9     | Applicant tracking                               | Not started |
| 10    | Performance, compensation, training               | Not started |
| 11    | Payroll processing, payslips, statutory reporting | Not started |
| 12    | Employee relations                               | Not started |
| 13    | Mobile application                               | Not started |
| 14    | Analytics, compliance, data subject requests     | Not started |
| 15    | AI layer foundation                              | Not started |
| 16    | Predictive insights                              | Not started |
| 17    | Workflow orchestration                           | Not started |

The full scope of each phase is in
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); the product requirements are in
[MASTER_PRD.md](MASTER_PRD.md).

## Phase 0 acceptance criteria

| Criterion                                              | Status      | Evidence                                                        |
| ------------------------------------------------------ | ----------- | --------------------------------------------------------------- |
| Repository initialised with a single dependency graph  | Complete    | npm workspaces, one `package-lock.json`, `.nvmrc`               |
| TypeScript strict across every package                 | Complete    | Shared `tsconfig.base.json`, `npm run typecheck` clean          |
| Lint rules enforced and passing                        | Complete    | `@hris/eslint-config`, `npm run lint` clean                      |
| Shared contracts package with tests                    | Complete    | 53 tests: envelope, errors, RBAC, lifecycle, branded ids         |
| Application configuration package with tests           | Complete    | 11 tests: app identity, API paths, regional defaults             |
| Shared UI package with tests                           | Complete    | 9 tests: tokens and components                                   |
| API application builds, boots and serves               | Complete    | 67 unit tests, 10 e2e tests, health probes verified             |
| Web application builds and renders                     | Complete    | 17 tests, dynamic pages, CSP verified against a live response    |
| Mobile application scaffold builds                     | Complete    | Expo 57, `npx expo config` resolves, 46 unit tests              |
| Docker development environment                         | Complete    | PostgreSQL 17 and Redis 7 healthy, extensions and timeouts verified |
| Application images build and run                       | Complete    | Both images build; full stack healthy; web reaches the API       |
| CI pipeline                                            | Complete    | `.github/workflows/ci.yml`: verify, e2e, docker stack health    |
| Documentation                                           | Complete    | README, DATABASE, API, SECURITY, DEPLOYMENT, AI_SPEC, 7 ADRs    |
| Environment documented with no secrets                 | Complete    | `.env.example`, `.gitignore`, explicit `allowScripts` triage     |

## What phase 0 deliberately does not deliver

- **No authentication or authorisation.** No login, no session, no RBAC enforcement,
  no data-scope filtering. The vocabulary exists in `@hris/shared-types`; the
  enforcement does not. Anything that looks like access control today is not.
- **No database schema.** PostgreSQL runs with `pgcrypto`, `citext` and `unaccent`
  installed, and per-database timeouts set. There are no application tables, no
  Prisma dependency and no migrations.
- **No Redis integration.** Redis runs and requires authentication. Nothing reads or
  writes to it yet.
- **No business modules.** No employees, no payroll, no leave, no claims, no
  attendance.
- **Readiness is shallow.** `/health/ready` reports process health only. It does not
  verify the database or the queue, so a container stays in rotation while its
  database connection is broken. Phase 1 replaces it.
- **No queue or worker.** Notification dispatch, document processing and scheduled
  jobs arrive with the modules that need them.

## Defects found and fixed during phase 0

Recorded because each was a genuine correctness or security issue, not a cosmetic
one, and each is now covered by a test or a verification step.

| Defect                                                                 | Consequence                                                                              | Fix                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `API_HOST=localhost`                                                   | Node resolved it to `::1`, so the API listened on the IPv6 loopback only. IPv4 clients and the container health check got `ECONNREFUSED` while startup logged success | `localhost` is now rejected at configuration validation; `0.0.0.0` maps to a dual-stack bind |
| Next standalone bound to `$HOSTNAME`                                   | Docker sets `HOSTNAME` to the container ID, so the web server listened only on its own address. The published port worked; every in-container health check failed | `HOSTNAME=0.0.0.0` set explicitly in the image and in Compose                     |
| Health probes fetched through the enveloped client                    | A healthy API was reported as `Unavailable` on the status page                                | Added `platformApiRequest` for `@RawResponse()` endpoints, with a regression test   |
| Web server-side calls used browser URLs                               | Inside the container, `localhost:3001` is the web container itself, so probes always failed | Split `client-config` (build-time, browser) from `server-config` (runtime, server) |
| `connect-src` given a path (`/api/v1`)                                | CSP source lists match origins, so the entry restricted nothing                             | Derived with `new URL(...).origin`, failing closed on a malformed value             |
| `script-src 'unsafe-inline'` with statically prerendered pages        | Nine inline scripts carried no nonce and would have been blocked; the header looked protective while providing little | Per-request nonce in middleware, and all routes forced dynamic                     |
| RLS described as a cluster-wide setting                                | Documentation implied protection that `ALTER DATABASE ... SET row_security` does not provide | Corrected: RLS is enabled per table, with the inactive-policy failure mode documented |
| Dockerfiles ran `printf ... > apps/web/package.json` with no directory | Image build failed for the `prod-deps` stage                                                | `mkdir -p` before writing workspace stubs                                          |

## Verified behaviour

Confirmed against running containers, not inferred from configuration:

- PostgreSQL 17 reachable on `localhost:5435`; `pgcrypto`, `citext` and `unaccent`
  present; `statement_timeout` and `idle_in_transaction_session_timeout` applied.
- Redis rejects unauthenticated commands with `NOAUTH` and answers with the
  configured password.
- Both application images build; all four containers report healthy.
- `GET /` and `GET /status` return 200 with security headers, a per-request CSP
  nonce, and no inline script lacking that nonce.
- `GET /status` renders "All checks passing", which requires the web server to reach
  the API over the private network — the same assertion CI makes.
- API: 67 unit tests, 10 e2e tests. Packages: 53, 11 and 9 tests. Web: 17. Mobile: 46.

## Phase 1 entry criteria

Phase 1 may begin when:

- [x] Phase 0 acceptance criteria are met
- [x] The stack runs locally and in CI with a verified web-to-API path
- [x] `npm run verify` and `npm run test:e2e` are clean
- [ ] ADR 0002 (Prisma) is reviewed against the first real schema
- [ ] The readiness probe covers the database, so a broken connection removes the
      instance from rotation

The last item is the first task of phase 1. Phase 1 should also settle the session
storage question raised in [ADR 0006](ADR/0006-session-tokens.md) before phase 2
builds authentication on it.
