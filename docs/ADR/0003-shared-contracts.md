# ADR 0003: Shared contracts in a workspace package

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

The API, the web application and the mobile application all need the same
definitions: the response envelope, error codes, pagination, the employee lifecycle
state machine, the RBAC vocabulary and the set of valid identifiers.

Three ways to share them:

1. Duplicate the types in each application.
2. Publish them to a registry as a versioned package.
3. Keep them in a workspace package inside the monorepo.

## Decision

A single workspace package, `@hris/shared-types`, consumed by all three
applications. It publishes **types and constants only** — no framework code, no
runtime behaviour beyond validation primitives.

## Rationale

**Duplication drifts.** The failure mode is not a compile error. It is a client
that accepts `SYNCED` while the server can emit `SYNCED` but the client's state
machine has `SUCCESS`, so an offline record silently never reaches the server. The
shared package makes that a type error.

**A registry is the wrong weight.** Publishing adds versioning, changelog and
release-ordering problems to a monorepo that commits and deploys atomically. The
cost buys nothing here.

**Constants are the valuable half.** Types alone would let a client believe a string
is valid. Exporting `SYNC_STATES`, `OFFLINE_OPERATION_TYPES` and `API_ERROR_CODES`
as `as const` tuples means both sides validate against the same runtime list, and an
unknown value arriving over the wire is rejected rather than trusted.

**Branded identifiers prevent a specific bug class.** `EmployeeId`, `UserId` and
`DepartmentId` are all `string` at runtime and mutually unassignable at compile
time. Passing a department id where an employee id belongs does not compile.

## Consequences

**Accepted costs**

- A change to the package is a change to every consumer at once. Intentional, but it
  means contract changes need wider review than an application-local change.
- The package compiles to `dist` before consumers typecheck, so a stale build
  produces confusing "cannot find name" errors. `npm run build:packages` precedes
  every full verification for this reason.
- Test runners differ per application (Jest for the API and packages, Vitest for web
  and mobile), so the package must not depend on either.

**Rules that follow**

- No framework imports. The package must stay usable from NestJS, Next.js and React
  Native.
- No React or JSX. Presentation belongs in `@hris/ui`.
- Anything requiring a build step to consume stays out. If it needs compiling, it
  belongs in a different package.
- Runtime logic belongs in the consuming application unless it is genuinely shared;
  a function in this package becomes a dependency every client must load.

## Alternatives considered

- **Generated clients from the OpenAPI spec**: authoritative for HTTP shape, but it
  cannot express the employee lifecycle or sync state machines, which are the parts
  most likely to drift. It also introduces a code-generation step into the build.
  Considered as a complement once the API has real endpoints.
- **Duplication with a lint rule to keep copies in sync**: enforcement by convention
  rather than by the compiler.
