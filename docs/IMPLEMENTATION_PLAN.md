# ENTERPRISE HRIS

# IMPLEMENTATION PLAN

**Version:** 1.0.0
**Status:** Development Execution Plan
**Document:** IMPLEMENTATION_PLAN.md

---

# 1. PURPOSE

This document defines the implementation sequence for the HRIS project.

OpenCode MUST NOT attempt to implement the entire HRIS in a single operation.

Development must proceed phase-by-phase.

Each phase must produce a working and testable system.

---

# 2. DEVELOPMENT RULE

The implementation sequence is:

```text
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
REVIEW
 ↓
FIX
 ↓
DOCUMENT
 ↓
MARK COMPLETE
```

Never mark a phase complete merely because the application compiles.

---

# 3. PHASE OVERVIEW

| Phase | Area                      | Priority |
| ----- | ------------------------- | -------- |
| 0     | Repository & Architecture | Critical |
| 1     | Platform Foundation       | Critical |
| 2     | IAM & RBAC                | Critical |
| 3     | Organization              | Critical |
| 4     | Core HR                   | Critical |
| 5     | Workflow & Notification   | Critical |
| 6     | Leave & Attendance        | High     |
| 7     | Claims                    | High     |
| 8     | Administration            | High     |
| 9     | ATS                       | High     |
| 10    | PMS                       | High     |
| 11    | Payroll                   | Critical |
| 12    | IR/ER                     | Medium   |
| 13    | Mobile                    | High     |
| 14    | Analytics                 | High     |
| 15    | AI                        | High     |
| 16    | Integration               | High     |
| 17    | Security Hardening        | Critical |
| 18    | Performance & Production  | Critical |

---

# 4. PHASE 0 — REPOSITORY & ARCHITECTURE

## Objective

Create the project foundation.

## Tasks

* Initialize repository
* Create monorepo
* Configure package manager
* Create apps
* Create packages
* Create docs
* Create environment templates
* Configure linting
* Configure formatting
* Configure TypeScript
* Configure testing
* Configure Docker
* Configure CI foundation

## Acceptance Criteria

* Repository builds
* Applications start
* Tests execute
* Lint executes
* Environment configuration documented
* Docker development environment works

---

# 5. PHASE 1 — PLATFORM FOUNDATION

## Backend

Implement:

* NestJS application
* Configuration module
* Logging
* Exception handling
* API versioning
* Validation
* Swagger
* Health checks
* Database connection
* Redis connection
* Queue infrastructure

## Database

Create:

* migration framework
* base migration
* seed framework

## Acceptance Criteria

```text
GET /health
GET /health/live
GET /health/ready
```

must function.

---

# 6. PHASE 2 — IAM & RBAC

## Implement

### User

* Create
* Update
* Activate
* Deactivate

### Authentication

* Login
* Logout
* Password hashing
* Password reset
* Session
* MFA foundation

### RBAC

* Role
* Permission
* Role permission
* User role
* Data scope

### Audit

* Login audit
* User audit
* Permission audit

## Acceptance Criteria

A user cannot access resources outside assigned permissions.

Tests MUST verify authorization boundaries.

---

# 7. PHASE 3 — ORGANIZATION

Implement:

* Company
* Entity
* Division
* Department
* Section
* Team
* Location
* Position
* Job
* Job grade
* Cost center

## Requirements

Organization hierarchy must be navigable.

User permissions must be assignable by organizational scope.

---

# 8. PHASE 4 — CORE HR

Implement:

* Employee
* Employment
* Employee lifecycle
* Employee history
* Manager relationship
* Documents
* ESS
* MSS

## Lifecycle

```text
PRE-EMPLOYMENT
→ ONBOARDING
→ ACTIVE
→ TRANSFER
→ PROMOTION
→ SUSPENSION
→ RESIGNATION
→ TERMINATION
→ OFFBOARDING
```

## Acceptance Criteria

Employee history must remain auditable.

---

# 9. PHASE 5 — WORKFLOW & NOTIFICATION

Implement reusable:

* Workflow definition
* Workflow version
* Workflow instance
* Workflow task
* Approval
* Rejection
* Delegation
* Escalation
* SLA

Notification:

* In-app
* Email
* Push foundation

First workflow implementations:

1. Leave
2. Claims
3. Employee changes

---

# 10. PHASE 6 — LEAVE & ATTENDANCE

## Leave

Implement:

* Leave types
* Leave policies
* Leave balances
* Leave requests
* Approval
* Calendar

## Attendance

Implement:

* Check-in
* Check-out
* Attendance record
* Shift
* Schedule
* Overtime
* Correction
* Approval

## Mobile API

Prepare:

* GPS
* Geofence
* offline sync

---

# 11. PHASE 7 — CLAIMS

Implement:

* Claim categories
* Claim policies
* Claim
* Receipt
* Receipt metadata
* Approval
* Payment status

Then add:

* OCR abstraction
* duplicate detection
* anomaly detection

AI must initially be behind feature flags.

---

# 12. PHASE 8 — ADMINISTRATION

Implement:

## Assets

* Asset master
* Assignment
* Transfer
* Return
* History

## Onboarding

* Checklist
* Tasks
* Assignment
* Completion

## Offboarding

* Clearance
* Asset return
* Account deactivation

## Visitors

* Visitor
* Invitation
* QR
* Check-in/out

## Documents

* Template
* Document generation
* Versioning
* Access control

---

# 13. PHASE 9 — ATS

Implement in sequence:

1. Job
2. Requisition
3. Approval
4. Vacancy
5. Candidate
6. Application
7. Resume
8. Screening
9. Interview
10. Assessment
11. Offer
12. Hiring
13. Onboarding handoff

AI resume analysis comes AFTER the standard recruitment workflow works.

---

# 14. PHASE 10 — PERFORMANCE MANAGEMENT

Implement:

1. Performance cycle
2. Goal
3. KPI
4. Goal cascading
5. Review
6. Self assessment
7. Manager assessment
8. 360 feedback
9. Calibration
10. Final rating
11. IDP

Performance data must maintain historical versions.

---

# 15. PHASE 11 — PAYROLL

Payroll must be implemented only after:

* Core HR
* Attendance
* Leave
* Claims

are sufficiently stable.

## Sequence

```text
Salary Master
 ↓
Payroll Period
 ↓
Payroll Components
 ↓
Attendance Inputs
 ↓
Leave Inputs
 ↓
Overtime
 ↓
Allowance
 ↓
Deduction
 ↓
Tax
 ↓
Statutory
 ↓
Calculation
 ↓
Validation
 ↓
Approval
 ↓
Lock
 ↓
Payslip
```

---

# 16. PAYROLL SAFETY GATES

Before payroll calculation is considered production-ready:

* transaction tests
* calculation tests
* rounding tests
* historical tests
* authorization tests
* audit tests
* lock tests
* adjustment tests

No payroll release without passing all safety gates.

---

# 17. PHASE 12 — IR/ER

Implement:

* Case
* Grievance
* Complaint
* Investigation
* Evidence
* Case documents
* Warning
* Show cause
* Decision
* Case timeline
* Union
* CBA

Access must be restricted.

Create security tests specifically for unauthorized case access.

---

# 18. PHASE 13 — MOBILE

Implement mobile in this order:

### Step 1

Authentication.

### Step 2

Profile.

### Step 3

Notifications.

### Step 4

Leave.

### Step 5

Claims.

### Step 6

Attendance.

### Step 7

Offline synchronization.

### Step 8

Payslip.

### Step 9

Performance.

---

# 19. OFFLINE IMPLEMENTATION

For each offline feature:

```text
LOCAL ACTION
 ↓
LOCAL DATABASE
 ↓
SYNC QUEUE
 ↓
NETWORK DETECTION
 ↓
API
 ↓
SERVER VALIDATION
 ↓
SYNC RESULT
```

Test:

* no internet
* intermittent internet
* duplicate submission
* retry
* conflict
* application restart
* device restart

---

# 20. PHASE 14 — ANALYTICS

Create:

## Executive Dashboard

* Headcount
* Turnover
* Attrition
* Absenteeism
* Payroll cost
* Recruitment
* Performance

## HR Dashboard

* Employee lifecycle
* Attendance
* Leave
* Claims
* Recruitment
* Performance
* IR/ER

## Manager Dashboard

* Team headcount
* Attendance
* Leave
* Performance
* Pending approvals

---

# 21. PHASE 15 — AI

AI implementation MUST happen after the underlying deterministic systems are working.

Order:

### AI-01

AI provider abstraction.

### AI-02

Prompt management.

### AI-03

Resume parsing.

### AI-04

Candidate matching.

### AI-05

Receipt OCR.

### AI-06

Claims anomaly detection.

### AI-07

Attendance anomaly detection.

### AI-08

Attrition-risk indicators.

### AI-09

Natural Language Query.

### AI-10

Predictive analytics.

---

# 22. AI SAFETY GATE

AI must never:

* bypass permissions
* expose unauthorized employee information
* make automatic employment decisions
* directly modify payroll
* directly approve claims
* directly terminate employees
* execute unrestricted SQL

AI output must be treated as advisory unless explicitly approved through a deterministic workflow.

---

# 23. PHASE 16 — INTEGRATION

Create integration framework first.

Then implement integrations independently.

Potential integrations:

* ERP
* Accounting
* Banking
* Job boards
* Career portal
* Calendar
* Video conferencing
* E-signature
* Biometric
* Government/statutory
* BI

Every integration must have:

* credentials/configuration
* adapter
* request logging
* error handling
* retry
* timeout
* health status

---

# 24. PHASE 17 — SECURITY HARDENING

Perform:

* Authentication testing
* Authorization testing
* RBAC testing
* IDOR testing
* Injection testing
* File upload testing
* Rate limit testing
* Session testing
* API security testing
* Sensitive data exposure testing
* Audit testing

Critical findings MUST be resolved before production.

---

# 25. PHASE 18 — PERFORMANCE & PRODUCTION

Perform:

* Load testing
* Stress testing
* Database optimization
* Index review
* API optimization
* Queue optimization
* Cache review
* Mobile performance
* Dashboard performance

Production readiness:

* monitoring
* alerting
* backups
* disaster recovery
* deployment automation
* rollback procedure
* incident documentation

---

# 26. FEATURE IMPLEMENTATION TEMPLATE

Every feature implemented by OpenCode must follow:

```text
1. Read requirement
2. Inspect existing implementation
3. Identify dependencies
4. Design database changes
5. Create migration
6. Implement domain logic
7. Implement application service
8. Implement API
9. Implement authorization
10. Implement validation
11. Implement UI
12. Add tests
13. Run tests
14. Run lint
15. Run build
16. Review security
17. Update documentation
18. Mark task complete
```

---

# 27. TASK STATUS

Use:

```text
[ ] NOT STARTED
[-] IN PROGRESS
[~] BLOCKED
[x] COMPLETE
```

Do not mark a task `[x]` until its Definition of Done is satisfied.

---

# 28. PHASE COMPLETION GATE

A phase can only be completed when:

* Functional requirements implemented
* Database migrations completed
* API tested
* Authorization tested
* Unit tests pass
* Integration tests pass
* E2E tests for critical flows pass
* Lint passes
* Build passes
* Documentation updated
* Security review completed where applicable

---

# 29. OPENCODE EXECUTION RULE

When OpenCode starts a new task:

1. Read `docs/MASTER_PRD.md`.
2. Read `docs/ARCHITECTURE.md`.
3. Read this file.
4. Identify the current phase.
5. Inspect repository.
6. Inspect existing related modules.
7. Create an implementation plan.
8. Implement only the requested scope.
9. Test.
10. Review.
11. Document.
12. Report exactly what changed.

Do not jump to future phases unless explicitly instructed.

---

# 30. NEVER DO THIS

OpenCode MUST NOT:

* rewrite the entire project unnecessarily
* delete working features without approval
* replace frameworks without an ADR
* introduce microservices without an ADR
* modify production configuration blindly
* bypass RBAC
* hardcode credentials
* hardcode statutory values without configuration
* create duplicate business logic
* create fake integrations and label them production-ready
* mark incomplete features as complete
* suppress failing tests merely to obtain a green build

---

# 31. FIRST TASK

The first implementation task is:

> PHASE 0 — Repository & Architecture Foundation

Before implementing business functionality, OpenCode must inspect the repository and establish the technical foundation.

The agent MUST NOT begin with Payroll, ATS, AI, or other advanced modules.

The first milestone is a clean, secure, testable application foundation.

---

# 32. FIRST MILESTONE

The first milestone is considered complete when:

```text
Repository
   ↓
Monorepo
   ↓
API
   ↓
Web
   ↓
Mobile foundation
   ↓
PostgreSQL
   ↓
Redis
   ↓
Docker
   ↓
Testing
   ↓
Linting
   ↓
CI foundation
   ↓
Health checks
```

all function correctly.

Only after this milestone may Phase 1 begin.
