# Current state — Enterprise Application Platform

Status: **Phase 0 discovery**. This document describes what exists in the repository
**today**, verified against source, not inferred from intent. It is the baseline any
change must preserve where the behaviour is correct.

The repository is labelled HRIS and ships an HRIS-flavoured web shell, but the
implemented **platform core is already largely domain-agnostic**. The HR-specific
surface today is thin: a mock employee directory, an `employee` lifecycle vocabulary,
and HR-oriented module/navigation labels. No payroll, leave, claims, attendance or
finance entities exist in the database.

## 1. Repository and tooling

- npm-workspaces monorepo (`package.json:11-15`): `packages/*`, `apps/*`, `database`.
- **No Turborepo** (`docs/ADR/0004-monorepo-tooling.md`); scripts are npm +
  `concurrently`. The Turborepo block in `AGENTS.md` is spurious and does not reflect
  the build.
- TypeScript strict everywhere (`tsconfig.base.json`), ESLint flat config in
  `@hris/eslint-config`, Prettier. Root `npm run verify` = format:check → lint →
  build:packages → typecheck → test → build:apps.
- Test runners: Jest (`apps/api`, `apps/worker`, `packages/*`, `database`), Vitest
  (`apps/web`, `apps/mobile`).
- CI (`.github/workflows/ci.yml`): `verify`, `e2e` (Postgres 17 + Redis 7), `docker`
  (full stack health + `/status` render assertion).

## 2. Applications

| App | Stack | Role |
| --- | --- | --- |
| `apps/api` | NestJS 11, Express, Prisma 7 adapter-pg, ioredis, BullMQ producer | All business APIs under `/api/v1`, health under `/health` |
| `apps/web` | Next.js 15 App Router, Tailwind v4, shadcn/ui (owned source) | Admin + product UI |
| `apps/worker` | Node, BullMQ `Worker`, Nodemailer | Async delivery (`hris.notifications`) |
| `apps/mobile` | Expo 57 scaffold | Liveness screen + offline-operation state machine only |

## 3. Database and tenancy

- `database/` workspace owns `schema.prisma` (24 models), migrations, seeds, the
  generated Prisma client, and the tenant-context helper.
- **Tenant root is `Company`.** Tenant-scoped tables carry `companyId`; reference
  data (`roles`, `permissions`, `role_permissions`, `countries`, `currencies`) does
  not.
- **RLS is real and fail-closed**: `app_current_company_id()` plus 4 policies per
  tenant table, `ENABLE` + `FORCE ROW LEVEL SECURITY`. The API connects as a
  `NOSUPERUSER NOBYPASSRLS` role (`database/scripts/grant-app-privileges.ts`).
- `withTenantContext(client, companyId, work)` sets `app.current_company_id`
  transaction-locally (`database/src/tenant-context.ts`). A query without context
  returns no rows.
- Soft-delete extension (`database/src/soft-delete-extension.ts`, 14 models) filters
  `deletedAt` on read operations.
- Append-only + hash-chained `audit_logs`; append-only `log_events`, enforced by
  triggers.
- 5 `SECURITY DEFINER` lookups exist for pre-session auth/SSO.

## 3a. Data model (24 models, grouped)

- **Reference**: `Country`, `Currency`, `Role`, `Permission`, `RolePermission`.
- **Tenancy/org**: `Company`, `Entity`, `OrganizationalUnit`.
- **Identity**: `User`, `UserRole`, `Session`.
- **Observability**: `AuditLog`, `LogEvent`.
- **Configuration**: `SystemSetting`.
- **Messaging/security**: `Notification`, `NotificationPreference`,
  `NotificationTemplate`, `MfaFactor`, `MfaRecoveryCode`, `IdentityProvider`,
  `SsoIdentity`, `Authenticator`, `ApprovalAuthority`, `ApprovalDelegation`.

Absent: any metadata/registry/resource-definition, API client, webhook, feature-flag,
workflow, integration, AI, or separate `tenant` table.

## 4. Authentication (exists, mature)

- Opaque session token in an httpOnly cookie; `sha256(token)` keyed in Redis with a
  durable `sessions.token_hash` row (ADR 0010). Argon2id passwords.
- Flows: login, logout, register/invite, forgot/reset password, verify email,
  change password, session list/revoke, CSRF guard for cookie state changes.
- Global guard order: `CsrfGuard` → `AuthenticationGuard` → `AuthorizationGuard`.
- MFA (TOTP + recovery codes), SSO (OIDC + SAML), passkeys (WebAuthn) all implemented
  with encrypted secrets and single-use Redis challenges.

## 5. Authorization (exists, with one material gap)

- `@RequirePermission(resource, action)` metadata + `AuthorizationGuard` enforces
  resource+action on every protected route. `manage` implies all actions.
- Principal (roles + effective permissions + data scope) is **re-derived from the DB
  on every request**; nothing is cached. This satisfies the master prompt's cache
  invalidation requirement by construction.
- Grants live in `role_permissions` (DB), but the **permission vocabulary**
  (`RESOURCES` 27, `ACTIONS` 9, `DATA_SCOPES` 6, `SYSTEM_ROLES` 11) is a hand-authored
  constant in `packages/shared-types/src/rbac/rbac.ts`, seeded into the DB and
  drift-checked by `database/tests/schema-contract.test.ts`.
- **Gap:** record-level `dataScope`/`scopeId` is stored and returned but **not
  enforced** in any query. Only resource+action is enforced. `OutOfScopeError`
  exists but is never thrown in `src/`.

## 6. Platform services present

- **Config**: typed `parseConfiguration()` validates env, aggregates errors, is the
  only reader of `process.env`; injected via `APP_CONFIG`.
- **Settings**: company-scoped typed JSON rows with defaults, masking of sensitive
  values, audit on write (25 default settings across 10 groups).
- **Notifications**: event registry (7 events, 14 templates/company), channel
  preferences, in-app rows + email enqueue to the worker; recipient-scoped reads.
- **Jobs**: BullMQ producer + queue monitor API (`queue:view` / `queue:manage`);
  worker consumes email jobs and writes per-tenant delivery log events.
- **Logs/audit**: `log_events` (6 categories) + hash-chained `audit_logs` with
  `chainVerified` on read.
- **Health**: liveness/readiness with custom Prisma, Redis and queue indicators;
  readiness 503 on dependency loss.
- **Approvals**: authority + delegation **configuration** only; notes that M07
  workflow enforcement is not present.

## 7. Web tier (exists, mature)

- 10-section Setup aspiration is **not** realised; current nav is module → group →
  item with `built`/`planned` status and a `href` only when built (enforced by types
  and `navigation.spec.ts`, so no planned link can 404).
- Current M00 ("System") groups: Identity, Access Management, Security,
  Communication, Configuration, Operations, Observability. Built screens include
  users, roles, permissions, settings, account/sessions, MFA+passkeys, SSO, approval
  authority, queues, notifications, logs/audit, login history, security audit,
  sign-in policy.
- Shared UX: `AppShell` (rail + sidebar + header + footer), cursor-paginated data
  table, permission-aware command palette, toast, error panel that never leaks
  backend messages, per-request nonce CSP.
- **Mock seam:** the employee directory defaults to a mock data source; the IAM
  surfaces default to the live API.

## 8. What must remain unchanged (unless an approved migration says otherwise)

1. The response envelope + error codes and their drift test (`docs/API.md`).
2. The CSRF → auth → authz guard order and fail-closed behaviour.
3. RLS tenant isolation, `withTenantContext`, and the app-role grant model.
4. The append-only + hash-chained audit log.
5. Opaque session tokens, masking of sensitive settings, encrypted MFA/SSO secrets.
6. The navigation "planned items never carry a href" invariant.
7. The shared-types ↔ Prisma drift tests.

## 9. Evaluation against the master prompt (honest gaps)

| Capability | State | Note |
| --- | --- | --- |
| Domain-agnostic core | Partial | Core services are generic; naming/labels are HRIS |
| Resource & metadata engine | Absent | No dynamic resources |
| App/module/resource registration | Absent | Static `imports` + compiled constants |
| Dynamic permission definitions | Partial | Grants in DB; vocabulary hardcoded |
| Record-level data scope enforcement | Absent | Stored only |
| API developer platform | Absent | No API clients/scopes/webhooks/usage |
| Workflow/business-rule engine | Absent | Approvals config only |
| Integration registry/adapters | Partial | Notifications/email only |
| AI service platform | Absent | Permission resource string + inert env only |
| Feature flags / config schemas | Partial | Settings exist; no flags or schemas |
| Extension registry | Absent | Compile-time module registry only |
| Tenant management | Partial | Company root + RLS; no lifecycle/quota UI |
| Generic CRUD engine | Absent | Hand-written modules only |
| Example domain app (Project/Task) | Partial | Employee mock only |
