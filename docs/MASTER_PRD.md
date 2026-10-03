# ENTERPRISE HRIS

# MASTER PRODUCT REQUIREMENT DOCUMENT

**Version:** 1.0.0
**Status:** Development Master Specification
**Document:** MASTER_PRD.md

---

# 1. DOCUMENT PURPOSE

This document is the authoritative product requirement specification for the Enterprise HRIS platform.

This document is intended to be consumed by:

* Human stakeholders
* Product owners
* Software architects
* Backend developers
* Frontend developers
* Mobile developers
* Database engineers
* QA engineers
* Security engineers
* DevOps engineers
* AI coding agents, including OpenCode

The implementation MUST follow this document unless an approved Architecture Decision Record (ADR) explicitly changes a requirement.

---

# 2. PRODUCT VISION

Build an enterprise-grade Human Resources Information System that centralizes employee data, HR operations, workforce management, recruitment, performance, claims, payroll, administration, industrial relations, attendance, analytics, and AI-assisted HR decision support.

The system must be:

* Secure
* Modular
* Multi-company
* Multi-entity
* API-first
* Mobile-enabled
* Workflow-driven
* Auditable
* Configurable
* Scalable
* Production-ready

The system is NOT a collection of disconnected CRUD screens.

It must operate as one integrated HR platform.

---

# 3. PRIMARY OBJECTIVES

The platform must:

1. Centralize employee master data.
2. Digitize HR processes.
3. Reduce manual HR administration.
4. Provide Employee Self Service (ESS).
5. Provide Manager Self Service (MSS).
6. Automate approval workflows.
7. Support multi-company and multi-entity organizations.
8. Provide secure payroll processing.
9. Integrate attendance and workforce data.
10. Provide recruitment and talent management.
11. Provide HR analytics.
12. Provide AI-assisted insights.
13. Provide mobile access for employees and field workers.
14. Maintain complete auditability.
15. Support future integrations.

---

# 4. TARGET USERS

## 4.1 Employee

Can access:

* Profile
* Attendance
* Leave
* Claims
* Payslip
* Performance
* Documents
* Notifications

## 4.2 Manager

Can access:

* Team
* Team attendance
* Team leave
* Team claims
* Team performance
* Approval tasks

## 4.3 HR Officer

Can manage:

* Employees
* Organization
* Employee lifecycle
* Documents
* HR administration

## 4.4 HR Manager

Can access broader HR analytics and configuration.

## 4.5 Recruiter

Can manage:

* Requisitions
* Candidates
* Interviews
* Offers
* Recruitment pipeline

## 4.6 Payroll Officer

Can manage:

* Payroll
* Salary
* Allowance
* Deduction
* Statutory calculations
* Payslips

## 4.7 IR/ER Officer

Can manage:

* Grievances
* Disciplinary cases
* Employee relations
* Union/CBA records

## 4.8 Finance

Can access authorized:

* Claims
* Payroll
* Financial reports

## 4.9 System Administrator

Can manage:

* Users
* Roles
* Permissions
* Entities
* System configuration
* Integrations

## 4.10 Executive

Can access:

* Executive dashboards
* Workforce analytics
* HR KPIs

---

# 5. SYSTEM MODULES

The system contains the following domains:

| ID  | Module                          |
| --- | ------------------------------- |
| M00 | Authentication & Base System    |
| M01 | Core HR / Employee Management   |
| M02 | Industrial & Employee Relations |
| M03 | ATS / Recruitment               |
| M04 | Performance Management          |
| M05 | Claims Management               |
| M06 | Payroll & Tax Compliance        |
| M07 | Administration                  |
| M08 | Attendance & Time Tracking      |
| M09 | AI Analytics & Dashboard        |

---

# 6. M00 — AUTHENTICATION & BASE SYSTEM

## Requirements

The system MUST support:

* Login
* Logout
* Password reset
* MFA
* SSO-ready architecture
* OAuth2/OIDC
* SAML-ready architecture
* Session management
* Device/session management
* User activation/deactivation
* Login history
* Audit logging
* Role management
* Permission management
* Multi-entity switching

---

# 7. M01 — CORE HR

Core HR is the authoritative source of employee information.

## Employee Master

The system MUST support:

* Employee ID
* Full name
* Preferred name
* Personal information
* Contact information
* Emergency contact
* Identification
* Address
* Employment type
* Employment status
* Join date
* Confirmation date
* Position
* Job
* Job grade
* Department
* Division
* Entity
* Company
* Cost center
* Location
* Manager
* Bank information
* Tax information
* Statutory information
* Education
* Skills
* Certifications
* Documents

## Employee Lifecycle

```text
RECRUITMENT
    ↓
PRE-EMPLOYMENT
    ↓
ONBOARDING
    ↓
ACTIVE
    ↓
TRANSFER / PROMOTION
    ↓
SUSPENSION
    ↓
RESIGNATION / TERMINATION
    ↓
OFFBOARDING
    ↓
ALUMNI
```

Historical employment records MUST be preserved.

---

# 8. M02 — INDUSTRIAL & EMPLOYEE RELATIONS

The system MUST support:

* Grievance
* Complaint
* Disciplinary case
* Investigation
* Evidence
* Case documents
* Warning letters
* Show-cause letters
* Case timeline
* Case status
* Union
* Collective Bargaining Agreement
* Compliance tracking

Sensitive IR/ER information MUST have restricted access.

---

# 9. M03 — ATS / RECRUITMENT

Recruitment lifecycle:

```text
WORKFORCE PLANNING
    ↓
MANPOWER REQUEST
    ↓
JOB REQUISITION
    ↓
APPROVAL
    ↓
JOB POSTING
    ↓
SOURCING
    ↓
APPLICATION
    ↓
SCREENING
    ↓
INTERVIEW
    ↓
ASSESSMENT
    ↓
SELECTION
    ↓
OFFER
    ↓
ACCEPTANCE
    ↓
ONBOARDING
```

Features:

* Workforce planning
* Requisition
* Approval
* Job description
* Vacancy
* Candidate
* Resume
* Candidate pipeline
* Interview
* Scorecard
* Assessment
* Offer
* Onboarding handoff

AI may assist with:

* Resume parsing
* Skill extraction
* Candidate matching
* Candidate summarization

AI MUST NOT be the sole basis for employment decisions.

---

# 10. M04 — PERFORMANCE MANAGEMENT

Features:

* Goal setting
* KPI
* OKR
* Goal cascading
* Mid-year review
* Year-end review
* 360 feedback
* Competency
* Rating
* Calibration
* Performance history
* Individual Development Plan

Goal hierarchy:

```text
COMPANY
    ↓
DIVISION
    ↓
DEPARTMENT
    ↓
TEAM
    ↓
INDIVIDUAL
```

---

# 11. M05 — CLAIMS MANAGEMENT

Features:

* Claim categories
* Claim policies
* Claim submission
* Receipt upload
* Receipt OCR
* Policy validation
* Approval
* Rejection
* Payment status
* Claim history

Workflow:

```text
EMPLOYEE
    ↓
MANAGER
    ↓
HR / FINANCE
    ↓
PAYMENT
    ↓
COMPLETED
```

AI may support:

* OCR
* Categorization
* Duplicate detection
* Anomaly detection
* Fraud-risk indicators

AI results must remain reviewable.

---

# 12. M06 — PAYROLL & TAX

Payroll must be transactional and auditable.

Basic calculation model:

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

Features:

* Payroll period
* Salary structure
* Payroll components
* Salary adjustment
* Overtime
* Allowance
* Deduction
* Bonus
* Incentive
* Tax
* Statutory
* Payroll calculation
* Payroll validation
* Payroll approval
* Payroll lock
* Payslip
* Payroll reports
* Payment file

Statutory rules MUST be configuration-driven.

Initial target may include Malaysia:

* EPF
* SOCSO
* EIS
* HRD Levy
* PCB/MTD
* Form E
* Form EA
* LHDN
* MyInvois

The architecture MUST permit additional countries.

---

# 13. M07 — ADMINISTRATION

## Asset Management

* Asset master
* Assignment
* Transfer
* Return
* Condition
* History

## Onboarding

Configurable checklist:

* Employee documents
* Accounts
* Equipment
* Access
* Workspace
* Training

## Offboarding

* Resignation
* Exit interview
* Clearance
* Asset return
* Account deactivation
* Final payroll

## Visitor Management

* Visitor registration
* Host
* Invitation
* QR
* Check-in
* Check-out

## Document Generation

Support configurable templates for:

* Employment letters
* Promotion letters
* Transfer letters
* Salary adjustment letters
* Warning letters
* Experience letters

---

# 14. M08 — ATTENDANCE & TIME

Features:

* Check-in
* Check-out
* GPS
* Geofencing
* Biometric integration
* Shift
* Schedule
* Break
* Overtime
* Late attendance
* Early departure
* Absence
* Attendance correction
* Approval

Mobile attendance MUST support offline-first operation.

---

# 15. M09 — AI ANALYTICS

AI capabilities:

* Recruitment intelligence
* Resume analysis
* Candidate matching
* Attrition-risk indicators
* Claims anomaly detection
* Receipt OCR
* Attendance anomaly detection
* Absenteeism prediction
* Predictive analytics
* Natural Language Query
* Document generation assistance

AI is decision-support only.

AI MUST NOT bypass:

* RBAC
* Data permissions
* Entity restrictions
* Audit requirements

---

# 16. MOBILE APPLICATION

Platforms:

* iOS
* Android

Mobile scope:

* Profile
* Notifications
* Attendance
* GPS
* Geofence
* Offline attendance
* Leave
* Offline leave
* Claims
* Receipt photo
* Offline claims
* Payslip
* Goals
* Self-assessment

Web-only:

* ATS administration
* IR/ER administration
* Payroll administration
* Administration module

---

# 17. WORKFLOW ENGINE

Workflow MUST be reusable.

Supported:

* Sequential approval
* Parallel approval
* Conditional approval
* Delegation
* Escalation
* SLA
* Reminder
* Rejection
* Resubmission
* Approval history

Workflow MUST be configurable rather than duplicated per module.

---

# 18. NOTIFICATION

Channels:

* In-app
* Email
* Push notification

Notifications require:

* Template
* Event
* Recipient
* Preference
* Delivery status
* Retry
* Read/unread status

---

# 19. MULTI-COMPANY / MULTI-ENTITY

Hierarchy:

```text
HOLDING
  ├── COMPANY
  │    ├── ENTITY
  │    │    ├── DIVISION
  │    │    │    ├── DEPARTMENT
  │    │    │    └── TEAM
  │    │    └── EMPLOYEE
```

Access scope:

* Self
* Team
* Department
* Entity
* Company
* Global

Every request MUST validate scope server-side.

---

# 20. INTEGRATIONS

Architecture must support:

* ERP
* Accounting
* Banking
* Job boards
* Career portals
* Calendar
* Video conferencing
* E-signature
* Biometric hardware
* BI platforms
* Government/statutory systems

API integration must support:

* REST
* Webhooks
* Authentication
* Retry
* Logging
* Versioning

---

# 21. SECURITY

Mandatory:

* TLS
* Encryption at rest
* MFA
* RBAC
* Audit log
* Secure password hashing
* Session security
* API authorization
* Input validation
* File validation
* Rate limiting
* Security headers
* Secret management

Sensitive data includes:

* Salary
* Bank account
* Tax information
* Identification
* Employee relations cases
* Payroll

Sensitive data MUST be protected at every layer.

---

# 22. NON-FUNCTIONAL REQUIREMENTS

Initial baseline:

* 10,000+ employees
* 1,000+ concurrent users
* 99.9% target availability
* API response target ≤ 2 seconds for standard operations
* Dashboard target ≤ 5 seconds
* RPO ≤ 1 hour
* RTO ≤ 4 hours

These values are initial engineering targets and may be refined after load testing.

---

# 23. AUDITABILITY

Sensitive operations MUST generate audit events.

Examples:

* Employee data changes
* Salary changes
* Payroll processing
* Payroll approval
* Permission changes
* Claim approval
* Document access
* Export of sensitive data
* Login
* Authentication failure

---

# 24. DEFINITION OF DONE

A feature is complete only when:

* Requirement implemented
* Database implemented
* Migration created
* API implemented
* Authorization implemented
* Validation implemented
* UI implemented where applicable
* Error handling implemented
* Audit implemented where required
* Tests created
* Tests pass
* Documentation updated
* Build succeeds
* Critical workflow verified

---

# 25. SOURCE OF TRUTH

Requirement authority:

```text
MASTER_PRD.md
        ↓
ARCHITECTURE.md
        ↓
MODULE SPECIFICATION
        ↓
IMPLEMENTATION_PLAN.md
        ↓
SOURCE CODE
        ↓
TESTS
```

If implementation conflicts with documentation, stop and resolve the conflict before continuing.

Do not silently reinterpret requirements.
