# Implementation status

## Summary

Phases **0–5 are delivered**. Phase **6 — AI services** increment 1 is delivered
(gateway, knowledge base, audit); the console AI registry layer was delivered under
Platform item 4 below. Phase **7 — Core HR / Employee Master Data** is delivered.
Phase **6b Enterprise hardening** is partial.

## Phases

### Phase 0–4 — delivered (see earlier revisions)

The platform ships: authentication, MFA/SSO/passkeys, user & role administration with
permissions, organization units, employee records with custom fields and soft-delete,
generic records CRUD, audit trail (hash-chained), notification platform, settings, the
files subsystem (RustFS) and the integration registry.

### Phase 5 — Workflow, integration breadth & automation (DELIVERED)

Delivered: workflow engine core (versioned definitions, permission-checked transitions,
approval routing, transition history); `database/migrations/20261013120000_workflow_engine`,
`apps/api/src/modules/workflows/*`, `apps/api/test/workflows.e2e-spec.ts`.

Step-driven routing, task assignment, conditional/parallel steps and escalation/SLA
timers: materializes a task per candidate approver, arms a delayed SLA job per step, and
the worker (`apps/worker/src/workflow-processor.ts`) escalates overdue tasks.
`database/migrations/20261017090000_workflow_tasks`,
`apps/api/test/workflow-tasks.e2e-spec.ts`.

Integration registry + adapter interface, including EMAIL, WEBHOOK, STORAGE and ANALYTICS
adapters; signed webhook delivery with per-endpoint subscriptions and retries.
`database/migrations/20261013130000_integrations`,
`apps/api/src/modules/integrations/*`.

Outbox: every domain event is persisted to `outbox_events` before fan-out, with delivery
tracking and retry. `database/migrations/20261019090000_outbox`,
`apps/api/src/modules/events/*`. Event Registry web surface at `/setup/events`.

Business rules: event trigger + condition DSL + actions (`NOTIFY`,
`START_WORKFLOW`, `EMIT_WEBHOOK`). `database/migrations/20261020090000_business_rules`,
`apps/api/src/modules/business-rules/*`, `/setup/business-rules`.

Scheduled actions: cron trigger + in-process runner with cross-tenant enumeration.
`database/migrations/20261021090000_scheduled_actions`,
`apps/api/src/modules/scheduled-jobs/*`, `/setup/scheduled-actions`.

Idempotency keys: request-level deduplication for mutating endpoints carrying
`Idempotency-Key`. `database/migrations/20261022090000_idempotency_keys`,
`apps/api/src/modules/idempotency/*`.

Object storage over RustFS: full files module (upload composition, authorisation,
metadata, retention, purge). `database/migrations/20261018090000_files`,
`apps/api/src/modules/files/*`, `apps/web/src/features/files/*`, `/setup/files`.

Web console: top-level `/approvals` (My Approvals), plus `/setup/workflows`,
`/setup/workflows/instances`, `/setup/files`, `/setup/events`, `/setup/business-rules`,
`/setup/scheduled-actions`; workflow section items flipped to `built`.

Acceptance: `npm run verify` exits 0.

### Platform console roadmap — Platform items 1–5 (DELIVERED)

The Setup administration console roadmap (`apps/web/src/lib/console.ts`, 10 sections
with fixed item counts) is complete through platform item 5: every section and item is
wired to a real page backed by real API data. Of 70 console items, 69 are `built`;
the single remaining `planned` item is **OAuth Applications**, which requires an OAuth2
authorization server (authorize/token/consent endpoints plus auth-guard integration)
and is deliberately deferred as a separate feature instead of an empty registry.

- P1: Access reviews and service accounts (Access Reviews & Audit sections),
  `database/migrations/20261030090000_access_reviews` (earlier), pages at
  `/setup/access-reviews` and `/setup/service-accounts`.
- P2: Scheduled jobs, Failed jobs and Performance metrics (Operations),
  `/setup/operations/{failed-jobs,metrics}`, `GET /platform/performance`.
- P3: Integration operations — Connections, Email, Messaging Channels, Notification
  Templates, Notification Preferences, Delivery Logs, Integration Monitor — seven
  pages under `/setup/integrations*` and `/ai*`-adjacent surfaces, aggregate endpoints
  `GET /integrations/deliveries` and `GET /integrations/monitor` declared before
  `:id` routes.
- P4: AI services — Providers, Models, Prompts, Agents, Tools, Usage & Cost and AI
  Logs, seven pages under `/ai/*`, backed by `ai_models`, `ai_prompts`, `ai_agents`
  and `ai_tools`
  (`database/migrations/20261030090000_ai_registry`, RLS tenant isolation), the
  `agentKey` extension of `POST /ai/ask` (agent prompt/model/tools, knowledge-tool
  gate, per-model pricing), and `GET /ai/providers`, `GET /ai/calls`, `GET /ai/usage`
  (spend computed only where model pricing exists). The `ai.enabled` system setting
  (default `false`) now exists for every company; re-run `db:seed` to provision it.
- P5: API Credentials (`/setup/api/credentials`, secret rotation + reveal-once),
  API Scopes (`/setup/api/scopes`, `resource.action` catalogue from the resource
  registry), Custom Fields (`/setup/custom-fields`, full field lifecycle on registered
  resources), Localization (`/setup/localization`, settings group) and System Defaults
  (`/setup/system-defaults`, default-vs-current catalogue).

HR modules began with Phase 7 below; the core HR domains (leave, attendance, payroll,
recruitment, performance, offboarding) are now **DELIVERED** — see the per-domain
sections after Phase 7. Remaining HR surface (reimbursement, benefits, claims, overtime,
timesheets, analytics) is intentionally still `planned` in the navigation.

### Phase 6 — AI services (IN PROGRESS / INCREMENT 1)

Increment 1 delivered: AI gateway (disabled by default), knowledge base with semantic
search over published policy text, redaction, audit (`ai_calls`), provider-agnostic
OpenAI-compatible client, and the policy FAQ surface at `/ai/assistant`. Configuration:
`AI_ENABLED`, `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_TIMEOUT_MS`.

Remaining: persona-based self-service, resume/JD parsing, payroll/attendance anomaly
detection, attrition risk indicators, MCP access.

### Phase 6b — Enterprise hardening (PARTIAL)

Present: RLS tenant isolation, privilege-escalation guard, audit trail, credential cipher
with per-scope keys (`mfa`/`sso`/`webhook`), webhook signing, login and per-client rate
limiting, object storage over RustFS. Missing: multi-tenancy management UI/quotas, data
governance (classification, masking, retention), backup/restore hooks, security & performance
testing, deployment readiness, and broad rate-limit coverage.

### Phase 7 — Core HR / Employee Master Data (DELIVERED)

Employee master data: employment records that link a `User` identity to an organizational
unit and a position, plus the position master.

- `database/migrations/20261031090000_employee_master_data` — `positions` and `employees`
  tables, both RLS-scoped, both soft-deleted via `deletedAt` and registered in
  `SOFT_DELETED_MODELS`.
- Schema fix found when the real data path went live: `Employee.employeeNumber`
  was missing its `@map("employee_number")` (and mistyped as `@db.Citext`
  against the migration's `TEXT` column), so every direct employee query
  through the Prisma client failed. The mapping now matches the database; the
  demo seed exercise is what surfaces it, since no earlier test executed real
  SQL against `employees`.
- Route-order fix on the same path: `EmployeeController`'s `:id` routes were
  registered before the literal subresource routes (`positions`) and before
  `EmployeeRecords`/`Employment` modules' literal routes (`contacts`, `family`,
  `contracts`, `movements`) on the same `employees` prefix — Express matches in
  registration order, so `GET /employees/contacts` was consumed as "id =
  contacts" and 500'd. The `:id` routes now live at the end of the controller
  and `EmployeeRecords`/`Employment` modules register before `EmployeeModule`
  in `app.module.ts`. The web also tolerates a `null`/absent department and job
  title in responses (an employee may exist without placement), rendering them
  blank instead of failing the parse.
- `apps/api/src/modules/employees/` — `EmployeeController` (`GET/POST/PATCH/DELETE
  /employees`, `GET/POST/PATCH/DELETE /employees/positions`) and `EmployeeService` with
  data scoping (`employee:view` via `resolveScope`: `all`/`self`/`subtree`/`entity`),
  cursor pagination, audit trail, unique constraints on `employeeNumber` and position
  `code`.
- Permissions: `employee.view/create/update/delete`, `organization.view/create/update/delete`
  for positions. `employee` and `position` resources are declared in RBAC (`rbac.ts`).
- Shared types: `EmployeeSummary`, `PositionSummary`, `CreateEmployeeInput`,
  `UpdateEmployeeInput`, `CreatePositionInput`, `UpdatePositionInput`, `EmployeeQuery`,
  `PositionQuery` in `packages/shared-types/src/employee/lifecycle.ts`.
- Web: `/employees` directory page reads the **real API and database by default**
  (`HRIS_EMPLOYEE_DATA_SOURCE=mock` still serves the generated sample people for
  offline UI work). Server renders forward the `hris_session` cookie to the API
  (`apps/web/src/lib/api/server-session.ts`).
  - Create dialog: Department and Job title are selects fed by the real units
    (`GET /organization/units`) and positions (`GET /employees/positions`) the
    page fetched; the API mints (or matches by email) a backing `User` for the
    person, and a blank employee number allocates the company's next `EMP-nnnn`.
    Employment type and status are validated against the platform enums on both
    sides. An API rejection surfaces in the dialog instead of the error page.
  - Edit no longer clears the unit/position placement when the patch omits
    them (the controller previously coerced an absent key to `null`).
  - Import dialog stays read-and-count-local; Bulk CSV keeps that limitation.
  - The directory also has an **image list** presentation: a Table / Photo
    list switch above the list renders one avatar card per employee
    (`employee-card-grid.tsx`); the choice persists in localStorage and never
    touches the query. Add/Import/Export sit in the header row, above both
    presentations. A **KPI strip** (`employee-directory-kpis.tsx`) sits above
    the list: total, active, on leave and last-90-days joiners, computed from
    the loaded rows; the active/leave cards narrow the directory by status
    through its URL filter, matching the reference screen.

Core HR domains built on this foundation are delivered below.

### Leave Domain (DELIVERED)

Leave management: leave type catalogue, entitlement policies and leave requests with
an approval lifecycle.

- `database/migrations/20261101090000_leave_domain` — `leave_types`, `leave_policies`,
  `leave_requests` tables, all RLS-scoped and soft-deleted.
- `apps/api/src/modules/leave/` — `LeaveController`
  (`GET/POST/PATCH/DELETE /leave/types`, `/leave/policies`, `/leave/requests`) and
  `LeaveService` with data scoping (`leave:view` via `resolveScope`), cursor pagination,
  audit trail. Leave request status transitions (approve/reject) require `leave.approve`
  when acting on another employee's request.
- Permissions: `leave.view/create/update/delete`. `leave` resource declared in RBAC.
- Shared types: `LeaveTypeSummary`, `LeavePolicySummary`, `LeaveRequestSummary`,
  `Create/Update LeaveTypeInput`, `Create/Update LeavePolicyInput`,
  `CreateLeaveRequestInput`, `LeaveTypeQuery`, `LeavePolicyQuery`, `LeaveRequestQuery`
  in `packages/shared-types/src/employee/lifecycle.ts`.
- Web: `/leave/requests` page with `LeaveRequestsScreen` — server-fetched first page,
  client-side status filtering, mock + API repository support
  (`HRIS_LEAVE_DATA_SOURCE`).
- Navigation: `/leave/requests` under `M05_CLAIMS > Leave` (flipped to `built`).
  `/leave/types` and `/leave/policies` configuration screens were added in the
  HR-core finalization increment below.

## HR Core Domains (ALL DELIVERED)

All five remaining core HR domains are delivered in one finalization increment.
They follow the same shape as Leave: RLS-scoped additive migrations, soft-delete
registration, `@hris/api` modules with `RequirePermission` + `resolveScope`
scoping + audit via `LogService` + cursor pagination, shared types in
`packages/shared-types/src/employee/*`, and server-fetched web screens.

### Attendance & Time (DELIVERED)

- `database/migrations/20261102090000_attendance_domain` — `attendance_records`
  (unique per employee+day) and `shift_patterns` (unique code per company),
  RLS-scoped and soft-deleted.
- `apps/api/src/modules/attendance/` — records CRUD and shift-pattern CRUD under
  `attendance:view/create/update/delete`; record reads narrow by the employee's
  organizational unit (`all`/`self`/`subtree`/`entity`); audit + cursor pagination.
- Web: `/attendance/records` (daily records with status filter and totals) and
  `/attendance/shifts` (shift pattern catalogue).
- Navigation: `M08_ATTENDANCE > Attendance` and `M08_SHIFT > Shift Patterns` built.

### Payroll (DELIVERED)

- `database/migrations/20261103090000_payroll_domain` — `payroll_periods`,
  `salary_structures` (effective-dated per position), `payroll_runs`
  (unique per period+employee) and `payroll_components`, RLS-scoped, soft-deleted.
- `apps/api/src/modules/payroll/` — period lifecycle
  (DRAFT → OPEN → PROCESSING → APPROVED → PAID → CLOSED), salary structures,
  run calculation from the active salary structure plus earnings components, and
  run advancement (DRAFT → APPROVED → PAID; run-level `PAID` keeps the period in
  `APPROVED` until the period itself is advanced). Mutations require company-wide
  scope; `payroll:view` reads are unit-scoped.
- Web: `/payroll/periods` (period calendar) and `/payroll/runs` (runs, periods and
  active salary structures).
- Navigation: `Payroll Period`, `Payroll Run` built.

### Recruitment (DELIVERED)

- `database/migrations/20261104090000_recruitment_domain` — `job_requisitions`
  (unique code per company), `job_candidates` (unique email per company) and
  `job_applications` (unique per requisition+candidate), RLS-scoped, soft-deleted.
- `apps/api/src/modules/recruitment/` — requisition lifecycle
  (DRAFT → OPEN → FILLED → CLOSED) and the application pipeline
  (APPLIED → SCREENING → INTERVIEW → OFFER → HIRED/REJECTED); applications may
  only be added to `OPEN` requisitions.
- Web: `/recruitment/pipeline` — requisitions and candidate pipeline with stage
  totals.
- Navigation: `Job Requisitions` built.

### Performance (DELIVERED)

- `database/migrations/20261105090000_performance_domain` — `performance_cycles`
  (unique code per company), `performance_goals` and `performance_reviews`
  (unique per cycle+employee), RLS-scoped, soft-deleted.
- `apps/api/src/modules/performance/` — cycle lifecycle
  (PLANNED → ACTIVE → REVIEW → CLOSED), goals with weight and progress
  (auto-`ACHIEVED` at 100%), and reviews submitted against a cycle in `REVIEW`.
  Goal reads/writes are unit-scoped; cycle management and reviews require
  `all` or `subtree` scope.
- Web: `/performance` — cycles, goals with progress and submitted reviews.
- Navigation: `Performance Cycles` built.

### Employee Data sub-records (DELIVERED — Wave 1, moved into the employee profile)

Seven employee-owned personal sub-record tables, all RLS-scoped, soft-deleted
(`SOFT_DELETED_MODELS`) and additive:

- `database/migrations/20261107090000_employee_records` — `employee_contacts`
  (emergency contacts), `employee_family` (dependents flagged via `isDependent`),
  `employee_education`, `employee_experience`, `employee_skills`,
  `employee_certifications` and `employee_documents`.
- `apps/api/src/modules/employee-records/` — full CRUD for all seven resources
  under `/employees/{contacts,family,education,experience,skills,certifications,documents}`
  plus `GET /employees/dependents` (family filtered to `isDependent`). Reads
  narrow by the owning employee's organizational unit via `resolveScope`
  (`employee:view`: `all`/`self`/`subtree`/`entity`); mutations require
  company-wide scope and are audited. Cursor pagination on `createdAt+id`.
- Shared types: `packages/shared-types/src/employee/records.ts` — summaries,
  create/update inputs and `EmployeeRecordQuery`.
- UI placement (enterprise-standard restructure): per-employee records are **not
  navigation items** — they live as `RecordSection` tables inside the employee
  profile tabs (`/employees/[id]`):
  - **Employment** tab — Employment Information (contracts) and Movement
    History tables.
  - **Personal Data** tab — Family, Dependents, Education, Experience, Skills,
    Certifications, Employee Documents, Emergency Contacts.
  Every section is a **real API read**: profile sections call the
  employee-records endpoints (`/employees/{contacts,family,education,experience,
  skills,certifications,documents}`) and the employment endpoints
  (`/employees/{contracts,movements}`) with the forwarded session cookie
  (`features/employee-detail/profile-sections.ts`), so the rows come from the
  database. An empty result renders "No records yet" — no fallback rows are
  fabricated. The demo seed (`database/seeds/demo-workforce.ts`) provides a full
  company population — entity, division/department tree, positions, 36
  users+employees plus per-employee record rows, contracts and movements — so a
  freshly seeded database has real rows to browse and open profiles against.
  The former 11 standalone routes (`/employees/{family,dependents,education,…}`,
  including the Wave 2 `employment`, `contracts`, `history` pages) were removed
  from the app router and the navbar; the navbar only keeps workforce-level
  activity screens. `apps/web/src/features/employee-records/` keeps the mock
  record stores for the mock data source of its list screens.

### Organization (DELIVERED — Wave 3)

- `database/migrations/20261109090000_work_locations` — `work_locations`
  (unique code per company), RLS-scoped, soft-deleted.
- `apps/api/src/modules/organization/location.service.ts` +
  `location.controller.ts` — work-location CRUD under
  `organization:view/create/update/delete` (`GET/POST/PATCH/DELETE
  /organization/locations`), unique-code guard, company-wide write gate, audit.
  Departments read the existing units endpoints and positions the Phase 7
  position endpoints, so no extra tables were needed for them.
- Shared types: `packages/shared-types/src/employee/locations.ts`.
- Web (`mock` data source, feature `apps/web/src/features/organization/`):
  `/organization` (Organization Structure) and `/org-chart` (expandable
  unit tree via native `<details>`), `/departments` (units list),
  `/employees/positions` (position master), `/locations` (work locations)
  and `/jobs` (job families + levels catalogue from constants).
- Navigation: 6 `M01_ORGANIZATION` items flipped `planned → built`
  (Organization Structure, Departments, Positions, Jobs, Locations, Org
  Chart). The setup-module twins (`M07_COMPANY` Departments/Locations,
  `M07_JOB` Positions) stay `planned` — the navigation spec requires
  globally unique built hrefs, so one catalogue route cannot serve both
  modules' sidebar entries until they diverge.

### Offboarding (DELIVERED)

- `database/migrations/20261106090000_offboarding_domain` — `offboarding_cases`
  (one open case per employee) and `offboarding_checklist_items`, RLS-scoped,
  soft-deleted.
- `apps/api/src/modules/offboarding/` — case creation seeds a default 5-item
  clearance checklist; case lifecycle
  (INITIATED → IN_CLEARANCE → CLEARED → COMPLETED) with completion blocked while
  checklist items are open; the first completed item moves a fresh case into
  clearance. Mutations require company-wide scope.
- Web: `/offboarding` — exit cases with checklist progress.
- Navigation: `Offboarding` under `M01_CORE_HR > Employee Lifecycle` built.

### Employment & Movement (DELIVERED — Wave 2)

Two employment tables, RLS-scoped and soft-deleted:

- `database/migrations/20261108090000_employment_movement` —
  `employment_contracts` (unique contract number per company, partial-unique on
  live rows; type PERMANENT/FIXED_TERM/PROBATION/INTERNSHIP, status
  ACTIVE/EXPIRED/TERMINATED) and `employee_movements` (type
  TRANSFER/PROMOTION/CHANGE; from/to unit and position names snapshotted so
  history survives renames).
- `apps/api/src/modules/employment/` — contracts CRUD (number clash guarded)
  and movements CRUD under `employee:*` permissions with the same unit-scoped
  read scoping and company-wide write gate. Creating a movement with a target
  unit or position also moves the employee onto it, resolved by name inside the
  same transaction.
- Shared types: `packages/shared-types/src/employee/employment.ts`.
- UI placement: per-employee contracts and movement history render in the
  profile's **Employment** tab (`/employees/[id]`). The navbar keeps the
  activity/queue surface only:
  `M01_CORE_HR > Employee Lifecycle > Employee Movement`
  (`/employees/movements`) — one working view combining the movement history
  (transfers, promotions, organizational changes) and the probation
  confirmation queue. The former standalone Probation, Transfers and Promotions
  screens were folded into it and their `M01_EMPLOYMENT` navbar group removed,
  since Employee Movement already represents that activity. All mock data
  source.
- Profile layout: `/employees/[id]` follows the two-column reference screen —
  an identity card (avatar circle, status badges, contact facts, actions)
  beside a tab card. Tabs are plain underlined buttons (Overview, Employment,
  Personal Data, Attendance, Payroll, Account) in
  `features/employee-detail/profile-tabs.tsx`. Record sections read the API;
  only the Attendance, Payroll and Account panels still render deterministic
  samples from `profile-extras.ts` until those modules ship — payroll amounts
  stay masked behind a "Show amounts" toggle by default.

### HR-core navigation state

Every core HR domain now has at least one `built` item per module. The navbar
follows the enterprise convention: items that describe a *single person*
(personal records, contracts, movement history) never appear — they are tabs of
the employee profile at `/employees/[id]` — while the navbar keeps only
workforce-level activity screens (Employee Movement, which also carries the
probation queue, on top of the domain list screens already built). The
navigation spec enforces unique hrefs per module and currently passes.

## Selected next phase

The core HR domains, Leave, the Employee Data sub-records (Wave 1, now lived
in the employee profile), Employment/Movement (Wave 2) and Organization
(Wave 3) are complete. The remaining wave plan continues: **Wave 4 —
Claims/Reimbursement/Benefits**, **Wave 5 — Working Time** (overtime,
timesheets, work schedules). After the waves, the next
eligible phases are **Phase 6 — AI services** increment 2 (persona-based
self-service, resume/JD parsing, payroll/attendance anomaly detection,
attrition risk indicators, MCP access) or **Phase 6b — Enterprise hardening**
completion (multi-tenancy management UI, data governance, backup/restore,
deployment readiness).

## Notes

- Working tree is uncommitted beyond the last commit; no commit was made for this
  increment.
Added platform tenant control plane: company lifecycle/plan/quota, cross-tenant listing, web /platform/tenants.
