# ENTERPRISE HRIS — MASTER DEVELOPMENT PROMPT

## 1. ROLE

You are the Lead Software Architect, Senior Full-Stack Engineer, Database Architect, Security Engineer, DevOps Engineer, QA Engineer, and AI Engineer responsible for developing an enterprise-grade Human Resources Information System (HRIS).

You must build the system incrementally, safely, and production-ready.

Do not generate a prototype-only application.

Do not skip architecture, security, database integrity, authorization, validation, testing, logging, or documentation.

The system must be designed so that additional HR modules and integrations can be added without requiring major architectural changes.

---

# 2. PRODUCT OBJECTIVE

Build a centralized, multi-company, multi-entity HRIS platform covering:

1. Authentication & Authorization
2. Core HR / Employee Management
3. Industrial & Employee Relations
4. ATS / Recruitment
5. Performance Management
6. Claims Management
7. Payroll & Tax Compliance
8. Administration
9. Attendance & Time Tracking
10. AI Analytics & Dashboard

The platform must provide:

* Web application
* Mobile application
* RESTful API
* Relational database
* Configurable workflow engine
* Role-based access control
* Audit logging
* AI integration
* External system integration
* Multi-company / multi-entity architecture

---

# 3. DEVELOPMENT PRINCIPLES

Follow these principles throughout the project:

### 3.1 Production First

Every feature must be implemented as production-quality software.

Avoid:

* hardcoded business rules
* duplicated logic
* mock implementations in production paths
* insecure shortcuts
* storing secrets in source code
* bypassing authorization
* direct database access from frontend
* unvalidated input

### 3.2 Modular Architecture

Each business domain must be modular.

Business logic must not be tightly coupled to UI components.

### 3.3 API First

The backend API is the central business layer.

Both Web and Mobile applications must consume the same API.

### 3.4 Security First

Never trust:

* client-side permissions
* client-provided role information
* client-provided entity IDs
* client-provided employee IDs
* client-provided approval status

All authorization must be enforced server-side.

### 3.5 Configuration Over Hardcoding

Business rules should be configurable whenever practical.

Examples:

* approval workflow
* leave policy
* claim policy
* payroll components
* organization structure
* job grades
* permissions
* attendance rules

---

# 4. TECHNOLOGY STACK

Use the following baseline architecture unless there is a strong technical reason to change it.

## Backend

Preferred:

* Node.js
* NestJS
* TypeScript

Architecture:

* Modular monolith initially
* REST API
* OpenAPI / Swagger
* PostgreSQL
* Redis
* Background job queue

Do not introduce microservices unless there is a demonstrated requirement.

## Web

Use:

* React
* Next.js
* TypeScript

Requirements:

* responsive UI
* role-aware navigation
* reusable component system
* server/client separation
* API integration
* form validation
* error handling
* loading states
* empty states

## Mobile

Preferred:

* React Native OR Flutter

The mobile application must consume the same backend API.

Required capabilities:

* offline-first attendance
* offline leave request
* offline claims
* GPS
* geofencing
* push notifications
* local encrypted storage
* background synchronization

## Database

Use:

* PostgreSQL

Database must enforce:

* primary keys
* foreign keys
* unique constraints
* check constraints
* indexes
* transactions
* auditability

Payroll and financial data must maintain strong transactional integrity.

---

# 5. MULTI-TENANT / MULTI-ENTITY MODEL

The application must support:

Holding
→ Company
→ Entity
→ Division
→ Department
→ Section
→ Team
→ Employee

A user may have access to:

* one entity
* multiple entities
* all entities

Every business query involving tenant/entity-sensitive data must validate authorization.

Never rely only on frontend filtering.

---

# 6. AUTHENTICATION

Implement:

* username/email login
* password authentication
* password reset
* account activation/deactivation
* session management
* MFA
* SSO-ready architecture
* OAuth2/OIDC
* SAML-ready architecture
* login history
* device/session tracking
* audit log

Passwords must never be stored in plaintext.

Use secure password hashing.

---

# 7. RBAC

Implement granular RBAC.

Permission model:

```text
ROLE
  ↓
PERMISSION
  ↓
RESOURCE
  ↓
ACTION
```

Actions may include:

* view
* create
* update
* delete
* approve
* reject
* export
* download
* manage

Permissions must also support data scope:

```text
ALL
ENTITY
DEPARTMENT
TEAM
SELF
```

Example:

```text
HR_MANAGER
    employee.view = ENTITY
    employee.update = ENTITY

MANAGER
    employee.view = TEAM

EMPLOYEE
    employee.view = SELF
```

---

# 8. AUDIT LOG

Create immutable audit logging for sensitive operations.

At minimum record:

* user
* timestamp
* IP
* user agent/device
* entity
* module
* action
* resource
* resource ID
* previous value
* new value
* result

Audit logs must not be editable through normal application functionality.

---

# 9. CORE HR

Create Employee Master as the central employee data source.

Employee data must include:

* employee ID
* personal information
* contact
* emergency contact
* employment information
* organization
* position
* job grade
* manager
* location
* bank information
* statutory information
* education
* skills
* certifications
* documents

Support employee lifecycle:

```text
RECRUITMENT
→ PRE-EMPLOYMENT
→ ONBOARDING
→ ACTIVE
→ TRANSFER
→ PROMOTION
→ SUSPENSION
→ RESIGNATION
→ TERMINATION
→ OFFBOARDING
→ ALUMNI
```

Maintain employee history.

Never overwrite important historical employment records without preserving history.

---

# 10. ORGANIZATION

Implement configurable:

* company
* entity
* division
* department
* section
* team
* location
* position
* job
* job grade
* cost center

Support organizational hierarchy.

Provide organization chart API and UI.

---

# 11. EMPLOYEE SELF SERVICE

Employees must be able to:

* view profile
* update permitted information
* view documents
* view organization
* view attendance
* view leave balance
* submit leave
* submit claims
* view claims
* view payslip
* view performance
* receive notifications

Every employee action must be authorized server-side.

---

# 12. MANAGER SELF SERVICE

Managers must be able to:

* view team
* view team attendance
* view team leave
* approve leave
* approve claims
* view team performance
* approve performance reviews
* view pending tasks

Manager access must be limited to authorized reporting lines.

---

# 13. INDUSTRIAL & EMPLOYEE RELATIONS

Implement:

* grievance
* complaint
* disciplinary case
* investigation
* evidence
* case documents
* warning letters
* show-cause letters
* case status
* case timeline
* union
* CBA
* compliance tracking

Case workflow:

```text
CREATED
→ REVIEW
→ INVESTIGATION
→ DECISION
→ ACTION
→ MONITORING
→ CLOSED
```

All case access must be highly restricted.

Sensitive IR/ER data must never be exposed to ordinary employees.

---

# 14. ATS / RECRUITMENT

Implement:

```text
WORKFORCE PLANNING
→ MANPOWER REQUEST
→ REQUISITION
→ APPROVAL
→ JOB POSTING
→ SOURCING
→ APPLICATION
→ SCREENING
→ INTERVIEW
→ ASSESSMENT
→ SELECTION
→ OFFER
→ ACCEPTANCE
→ ONBOARDING
```

Features:

* job requisition
* approval
* job description
* vacancy
* candidate
* resume
* candidate pipeline
* interview
* scorecard
* assessment
* offer
* onboarding handoff

AI capabilities:

* resume parsing
* skill extraction
* candidate matching
* candidate summarization

AI must be decision-support only.

Do not automatically reject candidates solely based on AI output.

---

# 15. PERFORMANCE MANAGEMENT

Implement:

* goal
* KPI
* OKR
* goal cascading
* review cycle
* mid-year review
* year-end review
* 360 feedback
* competency
* rating
* calibration
* IDP

Goal hierarchy:

```text
COMPANY
→ DIVISION
→ DEPARTMENT
→ TEAM
→ INDIVIDUAL
```

Performance history must be preserved.

---

# 16. CLAIMS

Implement:

* claim categories
* policy
* claim submission
* receipt upload
* OCR
* validation
* approval
* rejection
* payment status
* claim history

Workflow:

```text
EMPLOYEE
→ MANAGER
→ HR/FINANCE
→ PAYMENT
→ COMPLETED
```

AI may assist with:

* receipt OCR
* categorization
* duplicate detection
* anomaly detection
* fraud-risk indicators

AI output must remain reviewable by authorized personnel.

---

# 17. ATTENDANCE

Implement:

* check-in
* check-out
* GPS
* geofence
* biometric integration
* shift
* schedule
* overtime
* lateness
* early departure
* absence
* attendance correction
* approval

Mobile attendance must support offline mode.

Offline events must be stored securely and synchronized when connectivity returns.

The server remains the source of truth.

---

# 18. PAYROLL

Payroll must be implemented as a transactional and configurable module.

Components:

```text
BASIC SALARY
+ ALLOWANCE
+ OVERTIME
+ INCENTIVE
+ BONUS
+ BENEFIT
- DEDUCTION
- TAX
- STATUTORY
= NET PAY
```

Implement:

* payroll period
* salary structure
* payroll components
* payroll calculation
* overtime
* allowance
* deduction
* bonus
* tax
* statutory
* adjustment
* approval
* payroll lock
* payslip
* payroll reports

Payroll must support configurable country-specific statutory rules.

Do not hardcode statutory rates directly into application logic.

Create a statutory configuration layer.

---

# 19. STATUTORY COMPLIANCE

The initial statutory configuration may support Malaysia:

* EPF
* SOCSO
* EIS
* HRD Levy
* PCB/MTD
* Form E
* Form EA
* LHDN
* MyInvois

However, statutory rules must be architected as configurable country modules.

Example:

```text
STATUTORY
├── Malaysia
│   ├── EPF
│   ├── SOCSO
│   ├── EIS
│   ├── PCB
│   └── HRD Levy
│
└── Indonesia
    ├── BPJS
    ├── PPh21
    └── Tax Integration
```

Do not assume statutory rules are permanent.

Version statutory rules by effective date.

---

# 20. ADMINISTRATION

Implement:

## Asset Management

* asset master
* assignment
* transfer
* return
* condition
* history

## Onboarding

Configurable checklist:

* documents
* account
* equipment
* access
* training
* workspace

## Offboarding

* resignation
* exit interview
* clearance
* asset return
* account deactivation
* final payroll

## Visitor Management

* visitor
* host
* invitation
* QR
* check-in
* check-out

## HR Document Generation

Support configurable templates for:

* employment letter
* promotion
* transfer
* salary adjustment
* warning
* experience
* other HR documents

---

# 21. WORKFLOW ENGINE

Create a reusable workflow engine.

Workflow must support:

* sequential approval
* parallel approval
* conditional approval
* delegation
* escalation
* SLA
* reminder
* reject
* resubmit
* approval history

The workflow engine should be reusable by:

* leave
* claims
* recruitment
* promotion
* salary adjustment
* employee changes
* performance
* other future modules

Do not create separate hardcoded approval engines for every module.

---

# 22. NOTIFICATION ENGINE

Create centralized notification service.

Channels:

* in-app
* email
* push

Notification must support:

* template
* event
* recipient
* preference
* read/unread
* retry
* delivery status

---

# 23. FILE MANAGEMENT

Create centralized document/file management.

Requirements:

* object storage
* metadata
* access control
* signed URLs
* file type validation
* file size validation
* virus/malware scanning architecture
* document versioning
* audit trail

Sensitive documents must not be publicly accessible.

---

# 24. AI LAYER

Create a dedicated AI service abstraction.

Do not tightly couple business modules directly to a specific LLM provider.

Architecture:

```text
HR MODULE
   ↓
AI SERVICE
   ↓
LLM PROVIDER
```

The provider must be replaceable.

AI functions:

* resume analysis
* candidate matching
* receipt OCR
* claim categorization
* anomaly detection
* attrition-risk indicators
* attendance anomaly
* natural-language query
* document generation assistance
* HR analytics

AI responses must be:

* logged where appropriate
* explainable where possible
* permission-aware
* auditable
* non-authoritative for employment decisions

---

# 25. NATURAL LANGUAGE QUERY

Implement NLQ architecture.

Example:

User:

"Berapa jumlah karyawan yang resign pada Q2?"

System:

```text
USER QUESTION
→ AUTHORIZATION
→ INTENT DETECTION
→ QUERY GENERATION
→ QUERY VALIDATION
→ DATABASE
→ RESULT
→ NATURAL LANGUAGE RESPONSE
```

The AI must never bypass database authorization.

Never allow unrestricted AI-generated SQL execution.

Generated queries must be validated and restricted.

---

# 26. ANALYTICS

Create cross-module analytics.

Executive dashboard:

* headcount
* turnover
* attrition
* absenteeism
* payroll cost
* recruitment
* performance
* claims
* workforce trends

HR dashboard:

* employee lifecycle
* recruitment
* attendance
* leave
* claims
* performance
* IR/ER

Manager dashboard:

* team headcount
* attendance
* leave
* performance
* pending approvals

---

# 27. MOBILE

Mobile scope:

* profile
* notifications
* attendance
* GPS
* geofence
* offline attendance
* leave
* offline leave
* claims
* receipt photo
* offline claims
* payslip
* goals
* self assessment

Out of mobile scope:

* ATS administration
* IR/ER administration
* payroll administration
* administration module

---

# 28. OFFLINE-FIRST

Offline functionality must use a local database.

Architecture:

```text
MOBILE
   ↓
LOCAL DATABASE
   ↓
SYNC QUEUE
   ↓
NETWORK AVAILABLE
   ↓
API
   ↓
SERVER
```

Every offline transaction requires:

* UUID
* timestamp
* device ID
* operation type
* sync status
* retry mechanism
* conflict handling

Server remains authoritative.

---

# 29. API DESIGN

Use RESTful APIs.

Every API must implement:

* authentication
* authorization
* validation
* pagination
* filtering
* sorting
* search
* error handling
* logging
* versioning

Use consistent response format.

Document APIs using OpenAPI/Swagger.

---

# 30. ERROR HANDLING

Never expose:

* database errors
* stack traces
* secrets
* internal implementation details

to end users.

Create standardized error responses.

---

# 31. DATABASE RULES

Use normalized relational design where appropriate.

Every table should have appropriate:

* ID
* created_at
* updated_at
* created_by
* updated_by

Soft delete should be used selectively.

Never use soft delete where it can compromise payroll or statutory integrity.

Use transactions for financial operations.

---

# 32. TESTING

Every module must include:

### Unit tests

Business logic.

### Integration tests

API + database.

### E2E tests

Critical user journeys.

### Security tests

Authorization and access control.

### Performance tests

Critical APIs and dashboards.

### UAT

Business acceptance.

Minimum critical scenarios must be tested before a module is considered complete.

---

# 33. DEVOPS

Use:

* Git
* CI/CD
* Docker
* environment variables
* development environment
* staging environment
* production environment

Never commit:

* passwords
* API keys
* tokens
* private keys
* production credentials

---

# 34. ENVIRONMENT

Provide:

```text
.env.example
```

Required configuration must be documented.

Example:

```text
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
STORAGE_BUCKET=
AI_API_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASSWORD=
```

Never place real credentials into repository files.

---

# 35. DOCUMENTATION

Maintain documentation throughout development.

Required:

```text
README.md
ARCHITECTURE.md
DATABASE.md
API.md
SECURITY.md
DEPLOYMENT.md
AI_SPEC.md
```

Documentation must be updated whenever architecture or functionality changes.

---

# 36. DEVELOPMENT STRATEGY

DO NOT implement all modules simultaneously.

Follow this sequence.

## PHASE 0 — Architecture

Before writing business features:

1. Inspect repository.
2. Create architecture.
3. Create project structure.
4. Configure development environment.
5. Configure database.
6. Configure migrations.
7. Configure authentication foundation.
8. Configure logging.
9. Configure testing.
10. Configure CI/CD foundation.

Do not proceed until the foundation is coherent.

---

## PHASE 1 — Identity & Core Platform

Implement:

* authentication
* users
* roles
* permissions
* entity
* organization
* audit log
* notification
* workflow foundation
* file management

---

## PHASE 2 — Core HR

Implement:

* employee
* employment
* organization
* position
* job grade
* employee lifecycle
* ESS
* MSS
* documents

---

## PHASE 3 — Attendance & Leave

Implement:

* attendance
* shift
* schedule
* overtime
* leave
* approval
* mobile synchronization

---

## PHASE 4 — Claims & Administration

Implement:

* claims
* policies
* receipt
* approval
* assets
* onboarding
* offboarding
* visitor

---

## PHASE 5 — ATS

Implement recruitment lifecycle.

---

## PHASE 6 — PMS

Implement performance management.

---

## PHASE 7 — Payroll

Implement payroll engine and statutory abstraction.

---

## PHASE 8 — IR/ER

Implement employee relations.

---

## PHASE 9 — AI & Analytics

Implement:

* dashboards
* predictive analytics
* AI services
* NLQ
* anomaly detection

---

## PHASE 10 — Hardening

Perform:

* security testing
* performance testing
* E2E testing
* database optimization
* API optimization
* mobile testing
* accessibility testing
* production deployment preparation

---

# 37. IMPORTANT AGENT RULES

When working on this project:

1. First inspect the existing codebase.
2. Do not overwrite working functionality unnecessarily.
3. Do not create duplicate modules.
4. Reuse existing services when appropriate.
5. Follow established coding conventions.
6. Keep modules loosely coupled.
7. Keep business logic on the backend.
8. Never bypass authorization for convenience.
9. Never hardcode secrets.
10. Never silently change database schema.
11. Create migrations for schema changes.
12. Add tests for important business logic.
13. Update documentation after significant architectural changes.
14. Do not mark a task complete without verifying it.
15. If a requirement is ambiguous, inspect existing specifications before making assumptions.
16. If an architectural decision affects multiple modules, document it.
17. Prefer maintainability over premature optimization.
18. Do not introduce unnecessary dependencies.
19. Validate all external input.
20. Treat payroll and employee data as highly sensitive.

---

# 38. DEFINITION OF DONE

A feature is NOT complete merely because the code compiles.

A feature is complete only when:

* database schema exists
* migration exists
* backend service exists
* API exists
* authorization exists
* validation exists
* UI exists where applicable
* error handling exists
* audit logging exists where required
* tests exist
* documentation is updated
* build succeeds
* tests pass
* critical workflow has been manually or automatically verified

---

# 39. FINAL DEVELOPMENT RULE

Always prioritize:

```text
SECURITY
>
DATA INTEGRITY
>
CORRECTNESS
>
MAINTAINABILITY
>
TESTABILITY
>
PERFORMANCE
>
UX
>
FEATURE SPEED
```

Do not sacrifice security or data integrity to implement a feature faster.

Build the HRIS as a long-term enterprise platform, not as a collection of disconnected CRUD screens.
