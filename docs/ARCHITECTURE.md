# ENTERPRISE HRIS

# SYSTEM ARCHITECTURE

**Version:** 1.0.0
**Status:** Development Architecture
**Document:** ARCHITECTURE.md

---

# 1. ARCHITECTURAL PRINCIPLE

The HRIS shall initially use a:

> **Modular Monolith + API-First + Domain-Oriented Architecture**

The system must be modular internally while remaining operationally simple.

Microservices must NOT be introduced merely for architectural fashion.

A module may later be extracted into an independent service if scale, operational requirements, or organizational boundaries justify it.

---

# 2. HIGH-LEVEL ARCHITECTURE

```text
                         ┌──────────────────────┐
                         │   Executive / BI     │
                         └──────────┬───────────┘
                                    │
┌───────────────┐        ┌──────────▼───────────┐
│   Web App     │───────▶│      API Layer       │
└───────────────┘        └──────────┬───────────┘
                                    │
┌───────────────┐        ┌──────────▼───────────┐
│  Mobile App   │───────▶│   Application Layer  │
└───────────────┘        └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │     Domain Layer     │
                         │                      │
                         │ Auth                  │
                         │ Core HR               │
                         │ IR/ER                 │
                         │ ATS                   │
                         │ PMS                   │
                         │ Claims                │
                         │ Payroll               │
                         │ Admin                 │
                         │ Attendance            │
                         │ Analytics             │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
             ┌──────▼─────┐  ┌──────▼─────┐  ┌─────▼─────┐
             │ PostgreSQL │  │   Redis     │  │ Object    │
             │            │  │             │  │ Storage   │
             └────────────┘  └─────────────┘  └───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │ Integration / AI     │
                         └──────────────────────┘
```

---

# 3. REPOSITORY ARCHITECTURE

```text
apps/
├── api/
├── web/
└── mobile/

packages/
├── shared-types/
├── config/
└── eslint-config/

database/
├── schema.prisma
├── prisma.config.ts
├── migrations/
├── seeds/
├── fixtures/
├── scripts/
├── src/
└── tests/

docs/
├── MASTER_PRD.md
├── ARCHITECTURE.md
├── IMPLEMENTATION_PLAN.md
├── PHASE_STATUS.md
├── DATABASE.md
├── API.md
├── SECURITY.md
├── DEPLOYMENT.md
├── AI_SPEC.md
└── ADR/
```

There is deliberately no `packages/ui`. It was deleted in ADR 0008: it had one
consumer, the web tier, and React Native cannot consume web components at all, so
"shared" described an indirection rather than a sharing. Web presentation lives in
`apps/web/src/components`, and the web tier's own architecture is section 27.

`packages/validation` was never created. Validation is a class-validator pipeline
inside the API (`apps/api/src/common/pipes`), because validation that runs in a
separate process is validation that can be bypassed.

---

# 4. BACKEND ARCHITECTURE

Backend should use domain modules.

Example:

```text
apps/api/src/
│
├── main.ts
├── app.module.ts
│
├── common/
│   ├── guards/
│   ├── interceptors/
│   ├── filters/
│   ├── decorators/
│   ├── middleware/
│   ├── logging/
│   └── errors/
│
├── infrastructure/
│   ├── database/
│   ├── cache/
│   ├── storage/
│   ├── mail/
│   ├── queue/
│   └── integrations/
│
└── modules/
    ├── auth/
    ├── iam/
    ├── organization/
    ├── employee/
    ├── attendance/
    ├── leave/
    ├── claims/
    ├── recruitment/
    ├── performance/
    ├── payroll/
    ├── industrial-relations/
    ├── administration/
    ├── notification/
    ├── workflow/
    ├── analytics/
    └── ai/
```

Each domain should follow:

```text
module/
├── controller/
├── application/
├── domain/
├── infrastructure/
├── dto/
├── entities/
├── repositories/
└── tests/
```

Do not force unnecessary layers into trivial code.

---

# 5. DOMAIN BOUNDARIES

## IAM

Responsible for:

* Users
* Roles
* Permissions
* Authentication
* Authorization

## Organization

Responsible for:

* Company
* Entity
* Division
* Department
* Team
* Location
* Position
* Job Grade

## Employee

Responsible for:

* Employee
* Employment
* Employee lifecycle
* Employee documents
* Employee history

## Attendance

Responsible for:

* Attendance
* Shift
* Schedule
* Overtime
* Time rules

## Leave

Responsible for:

* Leave type
* Leave policy
* Leave balance
* Leave request
* Leave approval

## Claims

Responsible for:

* Claim
* Claim policy
* Receipt
* Claim approval

## Recruitment

Responsible for:

* Requisition
* Vacancy
* Candidate
* Application
* Interview
* Offer

## Performance

Responsible for:

* Goals
* KPI
* Review
* Feedback
* Calibration
* IDP

## Payroll

Responsible for:

* Salary
* Payroll period
* Payroll calculation
* Payroll components
* Payslip
* Statutory

## IR/ER

Responsible for:

* Grievance
* Disciplinary cases
* Investigation
* Union
* CBA

## Administration

Responsible for:

* Assets
* Onboarding
* Offboarding
* Visitors
* HR documents

## Workflow

Responsible for:

* Approval routing
* Workflow instances
* Tasks
* Delegation
* Escalation

## Notification

Responsible for:

* Email
* Push
* In-app notifications

## AI

Responsible for:

* AI provider abstraction
* AI tasks
* Prompt management
* AI audit
* AI result management

---

# 6. DEPENDENCY RULES

Allowed dependency direction:

```text
Presentation
      ↓
Application
      ↓
Domain
      ↓
Infrastructure
```

Domain logic MUST NOT depend directly on:

* HTTP
* Controllers
* UI
* LLM providers
* Database implementation

Infrastructure implements interfaces defined by application/domain layers where appropriate.

---

# 7. DATABASE ARCHITECTURE

Primary database:

> PostgreSQL

Database principles:

* relational integrity
* foreign keys
* indexes
* constraints
* transactions
* migrations
* auditability

Use UUIDs for distributed-safe identifiers where appropriate.

Use timestamps consistently in UTC at storage level.

---

# 8. TENANCY MODEL

Every entity-sensitive record must be associated with the correct organizational scope.

Preferred pattern:

```text
company_id
entity_id
```

Where required.

Do not blindly add tenant columns to every table if they can be derived safely through relational ownership.

Authorization must always validate effective scope.

---

# 9. RBAC ARCHITECTURE

Permission:

```text
resource.action
```

Examples:

```text
employee.view
employee.create
employee.update
employee.delete

payroll.view
payroll.process
payroll.approve

claim.submit
claim.approve
claim.reject
```

Data scope:

```text
SELF
TEAM
DEPARTMENT
ENTITY
COMPANY
GLOBAL
```

The authorization layer must resolve:

```text
USER
→ ROLE
→ PERMISSION
→ SCOPE
→ RESOURCE
→ ACTION
```

---

# 10. API ARCHITECTURE

REST API prefix:

```text
/api/v1
```

Examples:

```text
GET    /api/v1/employees
POST   /api/v1/employees
GET    /api/v1/employees/:id
PATCH  /api/v1/employees/:id

POST   /api/v1/leave-requests
POST   /api/v1/claims
POST   /api/v1/attendance/check-in
GET    /api/v1/payroll/payslips
```

API must support:

* pagination
* filtering
* sorting
* search
* validation
* authentication
* authorization
* standardized errors

---

# 11. API RESPONSE FORMAT

Use consistent response structure.

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": []
  }
}
```

Do not expose internal exceptions.

---

# 12. WORKFLOW ARCHITECTURE

Workflow is a reusable platform capability.

```text
Workflow Definition
        ↓
Workflow Instance
        ↓
Workflow Task
        ↓
Approval Action
        ↓
Next Task
        ↓
Completion
```

Workflow definitions must support:

* versioning
* conditions
* approvers
* escalation
* delegation
* SLA
* notification

Business modules invoke workflow rather than implementing approval logic independently.

---

# 13. EVENT ARCHITECTURE

Use domain/application events where appropriate.

Examples:

```text
EmployeeCreated
EmployeeUpdated
EmployeeTerminated

LeaveSubmitted
LeaveApproved
LeaveRejected

ClaimSubmitted
ClaimApproved

PayrollProcessed
PayrollApproved

CandidateHired
```

Events may trigger:

* notifications
* audit records
* integrations
* analytics
* background jobs

Events must not bypass transactional consistency.

---

# 14. BACKGROUND JOBS

Use background workers for:

* email
* push notification
* document generation
* OCR
* AI processing
* report generation
* payroll-heavy processing
* external integrations
* scheduled analytics

Long-running work MUST NOT block HTTP requests.

---

# 15. FILE STORAGE

Use object storage for:

* employee documents
* resumes
* receipts
* payslips
* HR letters
* case evidence

Files must not be stored directly in PostgreSQL unless there is a justified
exception.

Access should use short-lived signed URLs.

## 15.1 Provider

Object storage is RustFS, reached over its S3-compatible API.

The choice is driven by licensing. RustFS is Apache-2.0. MinIO, the previous
default for self-hosted S3, is AGPL-3.0, which is a poor fit for a proprietary
commercial product, and its community edition is archived and no longer
receives security releases. For a system holding payslips and case evidence,
an object store with no upstream security patches is not an acceptable
long-term position.

RustFS is younger than MinIO was. That risk is contained by never depending on
the provider itself:

* all access goes through the S3 API, never a RustFS-specific interface
* configuration uses neutral variable names (`STORAGE_ENDPOINT`,
  `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`)
* moving to MinIO, Ceph or AWS S3 is a change of endpoint, not of code

Before any production deployment, the S3 compatibility matrix must be checked
against the specific operations the file-management phase depends on. Object
Lock, which provides the write-once retention that payslip and evidence
immutability require, is documented upstream as still maturing, so it must be
verified rather than assumed. Versioning is enabled on the development bucket
so an accidental overwrite is recoverable in the meantime.

---

# 16. AI ARCHITECTURE

AI must be abstracted:

```text
Business Module
       ↓
AI Application Service
       ↓
AI Provider Interface
       ↓
Provider Adapter
       ↓
LLM / OCR / ML Provider
```

Business modules must not directly call OpenAI/other LLM APIs.

This allows provider replacement.

---

# 17. AI SECURITY

AI requests must respect:

* user permissions
* entity permissions
* data scope
* sensitive data restrictions

Do not send unnecessary employee PII to external AI providers.

AI-generated SQL must NEVER have unrestricted database access.

Use an allowlisted query model or controlled query service.

---

# 18. MOBILE ARCHITECTURE

Mobile:

```text
UI
 ↓
Application State
 ↓
Local Repository
 ↓
Sync Engine
 ↓
API
```

Offline-capable modules:

* Attendance
* Leave
* Claims

Offline records require:

* local ID
* server ID
* operation type
* timestamp
* sync state
* retry count
* conflict state

---

# 19. OFFLINE SYNC

Sync states:

```text
PENDING
SYNCING
SYNCED
FAILED
CONFLICT
```

Server remains authoritative.

Conflict resolution must be explicit.

Never silently overwrite user data.

---

# 20. SECURITY ARCHITECTURE

Security layers:

```text
Internet
   ↓
TLS
   ↓
Reverse Proxy
   ↓
API
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Domain Logic
   ↓
Database
```

Mandatory:

* secure headers
* CORS policy
* CSRF protection where applicable
* rate limiting
* request validation
* authentication throttling
* secure cookies/tokens
* secret management
* audit logs

---

# 21. PAYROLL SECURITY

Payroll requires additional controls.

Sensitive operations should require:

* authorization
* transaction
* audit
* approval
* period lock

Once payroll is finalized, changes should require controlled adjustment procedures.

Never directly edit finalized payroll records without audit trail.

---

# 22. OBSERVABILITY

Implement:

* structured logging
* application metrics
* health checks
* error tracking
* request tracing where appropriate
* background job monitoring

Health endpoints:

```text
/health
/health/live
/health/ready
```

---

# 23. DEPLOYMENT

Environments:

```text
development
staging
production
```

Production configuration must never be committed to Git.

Use environment variables and/or secret management.

---

# 24. SCALABILITY

Initial system should support:

* 10,000+ employees
* 1,000+ concurrent users

Scale application instances horizontally where possible.

PostgreSQL is the system of record.

Redis is for:

* cache
* sessions where applicable
* queues
* rate limiting

Redis must not become the source of truth for business data.

---

# 25. ARCHITECTURAL RULES FOR OPENCODE

OpenCode MUST:

1. Read MASTER_PRD.md before implementing features.
2. Read ARCHITECTURE.md before changing architecture.
3. Read IMPLEMENTATION_PLAN.md before selecting tasks.
4. Inspect existing code before creating new files.
5. Reuse existing abstractions.
6. Avoid duplicate services.
7. Create database migrations.
8. Add tests.
9. Preserve backward compatibility where possible.
10. Document architectural changes.
11. Create ADRs for significant architectural decisions.
12. Never introduce dependencies without justification.
13. Never bypass authorization.
14. Never hardcode secrets.
15. Never mark incomplete functionality as complete.

---

# 26. ARCHITECTURE CHANGE POLICY

If implementation requires a significant architectural change:

STOP.

Create an ADR:

```text
docs/ADR/ADR-XXX-description.md
```

The ADR must contain:

* Context
* Problem
* Options
* Decision
* Consequences
* Migration considerations

Only then continue implementation.

---

# 27. WEB TIER ARCHITECTURE

This section is numbered 27 rather than sitting next to section 18 on purpose.
Source files cite section numbers in comments (`api.types.ts` cites section 11,
`regions.ts` cites section 21, `rbac.ts` cites section 9), so inserting a section
in the middle would silently invalidate six citations in compiled code. Appending
keeps every existing reference true. A future renumbering must update the citations
in the same commit.

## Shape

```text
apps/web
├── src/app/            routes; the only place URLs appear
├── src/components/
│   ├── layout/         app shell, navigation
│   └── ui/             design-system primitives, owned source (ADR 0008)
├── src/lib/
│   ├── api/            server-config, client-config, http-client
│   └── data/           data access, one module per domain area
└── src/middleware.ts   per-request nonce CSP
```

## Rules

**Server Components by default.** A page fetches on the server and renders HTML. A
`'use client'` boundary is added only where interaction demands it. The reason is
correctness rather than preference: `@hris/database` imports `server-only`, so the
tenant context and the Prisma client cannot be pulled into a browser bundle even by
accident.

**Two configuration modules, never one.** `lib/api/server-config.ts` imports
`server-only`, so importing it from a client component is a build error rather than a
silent `undefined`. `lib/api/client-config.ts` reads `NEXT_PUBLIC_*` for the browser.
Merging them reintroduces the exact bug that produced the `ECONNREFUSED` failure
recorded in `PHASE_STATUS.md`.

**All fetches go through `http-client.ts`.** It maps every failure onto
`ApiRequestError` with a code from `API_ERROR_CODES` and a message that is safe to
render. Centralising this is what guarantees a raw backend message can never reach a
user, and it is why a page branches on `error.code` rather than on `error.message`.

**Cookies are already in place.** Every request sets `credentials: 'include'`, so the
cookie-based session decided in ADR 0010 needs no further plumbing when phase 2
arrives.

**List endpoints are cursor-paginated.** The UI shows "load more" driven by
`pageInfo.hasNextPage` and passes `pageInfo.endCursor` back unchanged. It never
computes an offset or a page number; `@hris/shared-types` deliberately offers no
helper that could, because offset pagination on an employee directory is how a
payroll export ends up quietly missing people.

**Every route is `force-dynamic`.** Two reasons, both in `layout.tsx`: the CSP nonce
cannot attach to a prerendered page's inline scripts, and one session's HTML must
never be served from a shared cache to another.

**Navigation is presentational.** `app-shell.tsx` filters nothing by role yet, and
when it does the API still re-authorises every request. A client-side check is a
usability feature, never a security control.

**Design tokens are the whole design system.** `globals.css` holds every colour,
radius and metric; components reference Tailwind utilities bound to those tokens.
There is no JavaScript theme object, because a second copy of the palette is a drift
risk by construction.

**Machine-readable state lives in `data-testid`, not in prose.** CI asserts on
`data-testid` values so copy can be reworded freely. An earlier version grepped the
sentence "All checks passing", which made an English string a wire contract.
