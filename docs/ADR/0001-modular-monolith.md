# ADR 0001: Modular monolith, not microservices

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

The platform has 17 functional modules spanning identity, organisation, workflow,
payroll, claims, analytics and AI. The question is whether to deploy those as
independently deployable services or as one deployable unit with internal module
boundaries.

The data model is strongly relational and highly cross-cutting. A payslip draws
from a contract, a contract from an employee, an employee from an org unit, an org
unit from an entity, an entity from a company, and all of it from the caller's data
scope. Tenant isolation is enforced per request across every one of those joins.

## Decision

Deploy as a **modular monolith**: one API process, one database, strict internal
module boundaries. Modules communicate in-process. Anything long-running or
non-deterministic goes through a durable queue.

## Rationale

**Transactionality.** Payroll spans many tables and must be all-or-nothing.
Distributed transactions across services would mean either two-phase commit, which
PostgreSQL supports but which is a poor fit for a high-volume system, or eventual
consistency in a domain where a partially applied payslip is worse than an
outage.

**Authorisation is cross-cutting.** Data scope has to be applied consistently
across modules. In one process that is a single guard, a single interceptor and a
single repository convention. Across services it is a shared library plus
consistent enforcement in every service, and one omission is a cross-tenant leak.

**The concurrency problem is untested.** Splitting into services is easy to regret
and expensive to undo. Most modules here will not have independent scaling needs:
payroll is bursty but small, and attendance capture is high-volume but already
handled by the queue.

**Operational cost is a real constraint.** Seventeen services means seventeen
deployments, seventeen sets of dashboards and a distributed tracing requirement,
for a system that needs to be correct rather than clever.

## Consequences

**Accepted costs**

- One deployment scales and releases all modules together. A defect in a low-risk
  module can block a payroll release.
- A memory leak or CPU spike in one module can affect the whole process.
- One language and one framework for everything.

**Mitigations**

- Modules are strictly separated by directory, with dependencies flowing inward.
  A module may not import another module's internals; cross-module access goes
  through that module's public interface.
- Queue anything slow or bursty, so the request path stays small.
- The API is stateless and horizontally scalable, so a hot module is mitigated by
  more instances until it can be extracted.
- A module may be extracted later at a genuine seam — the queue already provides
  one — without rewriting the others.

## Revisit when

Any single module needs independent scaling that would otherwise require scaling
the whole system, or a team boundary makes independent ownership of a module
mandatory. At that point extract one module, not the architecture.
