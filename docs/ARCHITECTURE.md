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
├── validation/
├── ui/
├── config/
└── eslint-config/

database/
├── migrations/
├── seeds/
└── fixtures/

docs/
├── MASTER_PRD.md
├── ARCHITECTURE.md
├── IMPLEMENTATION_PLAN.md
├── DATABASE.md
├── API.md
├── SECURITY.md
└── AI_SPEC.md
```

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

Files must not be stored directly in PostgreSQL unless there is a justified exception.

Access should use short-lived signed URLs.

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
