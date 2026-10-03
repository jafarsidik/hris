# ADR 0002: Prisma as the data access layer

- **Status**: Accepted
- **Date**: 2026-10-03
- **Applies from**: Phase 1. No schema or migration exists yet.

## Context

The application needs a schema, migrations, and a query layer for a data model with
roughly 100 tables. The requirements that drive the choice:

- Multi-tenant queries with a data-scope filter applied on every read.
- Transactional payroll processing.
- Migrations that are reviewable, ordered and never edited after being applied.
- Type safety end to end, so a renamed column is a compile error.

## Decision

Use **Prisma** as the ORM and migration engine. Raw SQL remains available for
reporting, bulk operations and anything Prisma expresses poorly — but the
migration history is owned by Prisma alone.

## Rationale

**One schema is the contract.** Types are generated from the schema and shared with
clients through `@hris/shared-types`, so a contract change surfaces at compile time
across the API, web and mobile.

**Type-safe queries.** A tenant-scope filter that is easy to forget is a data leak.
Compile-time checking catches that class of mistake, which for this domain matters
more than query expressiveness.

**Migration review.** Prisma migrations are plain SQL files in version control, so
a reviewer sees exactly what will run — including lock behaviour on a table with
live payroll data. An abstraction that hides migrations hides the risk.

**Familiar to the whole team.** Lower cognitive cost than a heavier query builder,
and it is the pragmatic choice rather than an ideological one.

## Consequences

**Accepted costs**

- Prisma's query engine adds runtime overhead relative to hand-written SQL. This is
  acceptable at this scale; the escape hatch is `$queryRaw` in read-heavy paths.
- Complex reporting queries and `INSERT ... ON CONFLICT` style upserts are more
  verbose than in raw SQL.
- Connection management is Prisma's, which constrains how a pooler such as
  PgBouncer in transaction mode can be introduced later.

**Mitigations**

- Raw SQL is available and used deliberately where it is clearer, always reviewed.
- Migrations follow the expand/contract sequence in [DATABASE.md](../DATABASE.md),
  so a large table is never rewritten in a single deploy.
- Row-level security and the data-scope convention are enforced at the application
  layer regardless of the ORM; RLS is defence in depth, not a substitute.

## Alternatives considered

- **TypeORM**: decorator-driven, weaker migration review story, and the data-scope
  pattern is easier to bypass.
- **Knex**: a query builder, not an ORM. No schema ownership, so migrations stay
  hand-written.
- **Drizzle**: closest to SQL, excellent types, but a smaller ecosystem and fewer
  documented migration patterns for a system where migration safety is the priority.
- **Raw SQL only**: full control and no abstraction risk, at the cost of no
  compile-time link between schema and code. Given that tenant isolation depends on
  consistently applied filters, that trade was rejected.
