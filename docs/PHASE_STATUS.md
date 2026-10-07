# Phase status

Phase 1 is in progress: the database layer, the application role, the tenant-scoped
client and the dependency-aware readiness probe are in place and verified. Phase 2
(identity and access) has not started.

This document exists so that nothing delivered so far is mistaken for a finished
feature. The platform foundation is deliberately not a product feature.

## Summary

| Phase | Module                                            | Status      |
| ----- | ------------------------------------------------- | ----------- |
| 0     | Foundation, architecture, tooling, infrastructure | **Complete** |
| 1     | Database, Prisma schema, migrations, seeds, Redis, application shell | In progress |
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
| Web UI system                                                        | Complete    | shadcn/ui + Tailwind v4, components owned in `apps/web/src/components/ui` (ADR 0008) |
| API application builds, boots and serves               | Complete    | 67 unit tests, 10 e2e tests, health probes verified             |
| Web application builds and renders                     | Complete    | 17 tests, dynamic pages, CSP verified against a live response    |
| Mobile application scaffold builds                     | Complete    | Expo 57, `npx expo config` resolves, 46 unit tests              |
| Docker development environment                         | Complete    | PostgreSQL 17, Redis 7 and RustFS healthy; extensions, timeouts, auth and bucket provisioning verified |
| Application images build and run                       | Complete    | Both images build; full stack healthy; web reaches the API       |
| CI pipeline                                            | Complete    | `.github/workflows/ci.yml`: verify, e2e, docker stack health    |
| Documentation                                           | Complete    | README, DATABASE, API, SECURITY, DEPLOYMENT, AI_SPEC, 9 ADRs    |
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
- **No object storage integration.** RustFS runs, is provisioned and is verified, but
  no application code reads or writes to it. There is no S3 client, no signed-URL
  issuing, no malware scanning and no API configuration block for storage — that lands
  with file management in phase 8. The infrastructure is present so the phase does not
  have to introduce it.

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
| Skip link had no CSS rule                                                | `layout.tsx` rendered `<a class="skip-link">` but no stylesheet defined it, so keyboard users got a visible inline link at the top of every page instead of a hidden-until-focused control | Replaced with Tailwind `sr-only focus:not-sr-only` utilities in the layout               |
| RustFS could not write its own log directory                             | `RUSTFS_OBS_LOG_DIRECTORY=/var/log/rustfs/` (from the upstream `docker run` example) made the container exit 1: the process runs as uid 10001 and cannot create that directory | Log to stdout instead, which also makes `npm run stack:logs` work                       |

## Verified behaviour

Confirmed against running containers, not inferred from configuration:

- PostgreSQL 17 reachable on `localhost:5435`; `pgcrypto`, `citext` and `unaccent`
  present; `statement_timeout` and `idle_in_transaction_session_timeout` applied.
- Redis rejects unauthenticated commands with `NOAUTH` and answers with the
  configured password.
- Object storage answers `200` on `/health/ready`, the `hris-documents` bucket exists
  with versioning enabled, and re-running the bootstrap is a no-op. Both storage ports
  are bound to `127.0.0.1` and refuse connections on the host's external interface.
- Both application images build; all four long-running containers report healthy and
  the one-shot storage bootstrap exits 0.
- `GET /` and `GET /status` return 200 with security headers, a per-request CSP
  nonce, and no inline script lacking that nonce.
- `GET /status` renders "All checks passing", which requires the web server to reach
  the API over the private network — the same assertion CI makes.
- API: 67 unit tests, 10 e2e tests. Packages: 53 and 11 tests. Web: 17. Mobile: 46.
  `npm run verify` runs 194 unit tests in total. The previous count of 203 included 9
  tests for `@hris/ui`, which has been deleted (ADR 0008).

## Phase 1 acceptance criteria

| Criterion                                              | Status      | Evidence                                                        |
| ------------------------------------------------------ | ----------- | --------------------------------------------------------------- |
| `@hris/database` workspace with Prisma 7 and a driver adapter | Complete | `prisma@7.10.0`, `@prisma/adapter-pg`, colocated `prisma.config.ts` |
| Platform schema: tenancy, identity, audit, reference data | Complete | 12 models across `companies`, `entities`, `organizational_units`, `users`, `user_roles`, `sessions`, `audit_logs` plus `countries`, `currencies`, `roles`, `permissions`, `role_permissions` |
| Migrations applied and repeatable                        | Complete | `db:deploy` succeeds on a fresh volume and is idempotent        |
| Tenant isolation enforced in the database                | Complete | RLS enabled **and** forced on all 7 tenant tables, 14 policies, verified with the application role |
| The API cannot bypass RLS                                | Complete | API connects as `hris_app` (`NOSUPERUSER NOBYPASSRLS`); the owner role is a superuser and is rejected |
| Fail closed when the tenant is unknown                   | Complete | A query with no tenant context returns zero rows, asserted as a test |
| Reference data seeded and idempotent                     | Complete | `db:seed` run three times; row counts unchanged, asserted as a test |
| Schema and shared contracts cannot drift                 | Complete | Test compares `Action`, `DataScope` and the soft-delete list against `schema.prisma` |
| Audit history cannot be edited                           | Complete | Append-only trigger rejects `UPDATE`, `DELETE` and `TRUNCATE`, including for the owner role |
| Readiness covers the real dependencies                   | Complete | `/health/ready` reports PostgreSQL, Redis and the queue; returns 503 when one is down while `/health/live` stays 200 |
| Redis and the job queue available to the API            | Complete | `RedisModule` and `QueueModule`; no queues registered until a module needs one |
| CI runs the database tests                               | Complete | `e2e` job starts PostgreSQL and Redis, migrates, seeds, grants, then runs integration and e2e tests |
| Docker stack healthy with real dependencies              | Complete | `docker` job migrates and grants before asserting `/health/ready` |

### Web application shell

| Criterion                                            | Status      | Evidence                                                                     |
| ---------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| Navigation covers every module in the shared contract | Complete   | `MODULE_MENUS` is keyed by `ModuleId`, so a module added to the contract is a compile error rather than a missing rail entry |
| Only built screens are reachable                      | Complete   | `ROUTES` is derived from built items whose `href` is required by the type; planned items render as text, so no link can 404 |
| The sidebar is scoped to one module at a time         | Complete   | The rail selects a module; the tree shows only that module's groups. Selection follows the route, so it cannot disagree with the page |
| The current page is always visible in navigation      | Complete   | The group holding the current route starts open; the module is marked `aria-current` and the selection `aria-pressed` |
| Roadmaps are honest, not decorative                   | Complete   | Nine of eleven modules are marked "not built yet" by outline and by words, in the tree and in the mobile menu |
| Landmarks are unambiguous                             | Complete   | Three `nav` elements — module rail, module menus, breadcrumb — and exactly one `main` |
| Keyboard and screen reader paths exist                | Complete   | Rail buttons are labelled and focusable; a planned item is a `span`, so it cannot be tabbed to and its text stays in the tree |
| Employee directory reads real data                    | Partial    | Deterministic 43-row mock with keyset pagination, filterable and sortable. The API endpoint does not exist yet, so `HRIS_EMPLOYEE_DATA_SOURCE` defaults to `mock` |
| Dense tables behave like dense tables                 | Complete   | The table container is the scroll context, so the header stays put across 43 rows; the row count and paging control sit above the table instead of below it |
| Navigation controls are the controls they claim to be | Complete   | Buttons render as buttons and links as links. Two pre-existing `Button render={<Link/>}` usages stamped `role="button"` onto navigable anchors and are now styled links |
| The module rail is actually on screen                | Complete   | The desktop sidebar is `position: fixed; left: 0` and painted over the rail; `sidebar-container` now shifts by `--module-rail-width`, verified with a hit test (`elementFromPoint` lands inside the rail). The rail is desktop-only; below `md` modules are switched from the sheet, so there is one `Modules` landmark at every width |
| Create and edit an employee                          | Complete   | One dialog shell for both modes, server-action validated against the same lists the directory is generated from; a successful save merges the record into the on-screen rows, labels itself sample data, and lands in the mock store (resets on restart) |
| Full employee form                                   | Complete   | `useActionState` server action with per-field errors, radio-group status, department/type selects, date input, a disabled submit while pending — no new dependencies |
| Quick view of a record                               | Complete   | Row menu ("View profile") opens a right-hand sheet with identity, status, contact and employment summary; "Edit" from the sheet opens the same form the list uses |
| Bulk actions                                         | Complete   | Header checkbox selects all visible rows; the selected-count toolbar exports CSV, clear the selection, and holds disabled placeholder actions |
| Column visibility                                    | Complete   | "Columns" popover toggles the optional department/job-title/hire-date columns per reader |
| Command palette (⌘K) and header search               | Complete   | `⌘K` / `Ctrl+K` (and the header button) open a dialog that filters built pages, quick actions and planned menu items with keyboard navigation; Enter navigates |
| Notifications                                        | Complete   | Header bell opens a dropdown that states plainly there are no notifications yet, rather than faking an inbox |
| Dashboard / command center                           | Complete   | `/` serves headcount KPIs, recent hires, headcount-by-department SVG (library-free), module build progress and quick actions, computed from the same mock repository the directory reads |
| Toast feedback                                       | Complete   | Dependency-free toast provider mounted in the root layout; save confirmation is announced `aria-live` |

### Not yet delivered in phase 1

- **No business queries.** The schema, tenant context and soft-delete filter exist and
  are tested, but no module reads or writes business data yet.
- **The employee directory reads a mock.** The repository interface, the API implementation
  and the server-rendered page are real, and the API implementation is written against the
  shared contracts. But there is no employee endpoint, so the page renders 43 generated
  rows from `HRIS_EMPLOYEE_DATA_SOURCE=mock`. It says so on screen; switching to `api`
  before the endpoint exists fails loudly rather than rendering nothing. Create and edit
  write to an in-memory overlay that resets on restart, so a run's edits prove the form
  and the flow, not persistence.
- **No authentication.** `sessions` is a table and nothing populates it. Login lands in
  phase 2.
- **No role grants beyond `SYSTEM_ADMIN`.** The other ten system roles are seeded
  without permissions, because their permissions depend on modules M01-M09 that do not
  exist. Inventing the matrix now would encode guesses as requirements.
- **No PgBouncer.** Deliberately deferred; see "Connection pooling" in
  [DATABASE.md](DATABASE.md).
- **No worker process.** Only the producer side of the queue is wired.

## Phase 1 entry criteria

Phase 1 may begin when:

- [x] Phase 0 acceptance criteria are met
- [x] The stack runs locally and in CI with a verified web-to-API path
- [x] `npm run verify` and `npm run test:e2e` are clean
- [x] ADR 0002 (Prisma) is reviewed against the first real schema
- [x] The readiness probe covers the database, so a broken connection removes the
      instance from rotation

The session-storage question raised in [ADR 0006](ADR/0006-session-tokens.md) is settled
in [ADR 0010](ADR/0010-opaque-session-tokens.md): opaque tokens in Redis with a durable
`sessions` record, which ADR 0006 named as the preferred design once Redis existed.
Phase 2 builds authentication on that.
