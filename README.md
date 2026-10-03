# Enterprise HRIS

A multi-company Human Resources Information System: one platform serving several
companies, each with its own entity hierarchy, data isolation, currencies, leave
policies and approval workflows.

This repository is currently at **Phase 0** — the architectural foundation. The
applications boot, the shared contracts are typed, the toolchain is enforced in
CI, and the local stack runs in Docker. No business module is implemented yet;
see [docs/PHASE_STATUS.md](docs/PHASE_STATUS.md).

## Architecture at a glance

A modular monolith with an API-first design. The API is the only place business
rules live; the web and mobile applications are clients of it and hold no
authoritative state.

```
                       ┌──────────────┐
   Browser ───────────▶│  Next.js web │──┐
                       └──────────────┘  │  REST + OpenAPI
                                         ├──▶┌─────────────────────┐
                       ┌──────────────┐  │   │   NestJS API        │
   Mobile  ───────────▶│ Expo / RN    │──┘   │  (modular monolith) │
                       └──────────────┘      └──────────┬──────────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          │                         │
                                   ┌──────▼──────┐          ┌───────▼───────┐
                                   │ PostgreSQL  │          │ Redis + queue │
                                   └─────────────┘          └───────────────┘
```

| Concern          | Choice                                    | Rationale                                                                                       |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API              | NestJS, TypeScript, REST, OpenAPI         | Structured modules, first-class guards and pipes, strong DI for shared cross-cutting concerns    |
| Web              | Next.js, React, TypeScript                | Server rendering for the first paint; a strict Content-Security-Policy is enforceable via middleware |
| Mobile           | Expo, React Native, TypeScript            | One codebase for iOS and Android with offline capture and background sync                          |
| Data             | PostgreSQL 17                             | Transactional integrity, row-level security, mature reporting for payroll and compliance           |
| Cache / queue    | Redis                                     | Sessions, rate limiting, caching, and a durable job queue for notifications and heavy exports       |
| Data access      | Prisma (from phase 1)                     | Type-safe queries derived from one schema, reviewable migrations                                  |
| Repository       | npm workspaces, single lockfile           | One dependency graph, one install, atomic version bumps across packages                           |

The API is deployed as one unit. Modules communicate in-process; anything
asynchronous goes through the queue. Microservices are not on the roadmap: the
operational cost is not justified until a module has a demonstrable independent
scaling or deployment requirement.

## Prerequisites

- Node.js 22.14.0 (`.nvmrc`; `nvm use`)
- npm 11 or newer
- Docker with the Compose plugin
- PostgreSQL client tools, if you want to inspect the database directly

## Quick start

```bash
# 1. Configure the environment (the template ships development-only defaults)
cp .env.example .env

# 2. Install every workspace from the single lockfile
npm ci

# 3a. Run only the infrastructure
npm run infra:up

# 3b. Or run the full stack in Docker
npm run stack:up
```

With the Docker stack running:

| Service    | URL                            | Notes                                     |
| ---------- | ------------------------------ | ----------------------------------------- |
| Web        | http://localhost:3000          | `/` overview, `/status` live API probe    |
| API        | http://localhost:3001          | `/health`, `/health/live`, `/health/ready` |
| API docs   | http://localhost:3001/api/docs | Disabled in production                    |
| PostgreSQL | `localhost:5435`               | Container port 5432                       |
| Redis      | `localhost:6381`               | Container port 6379 is unused             |

To run the applications directly on the host instead of in Docker:

```bash
npm run infra:up   # PostgreSQL and Redis only
npm run dev        # API on :3001, web on :3000
```

Verify a change before committing:

```bash
npm run verify     # format check, lint, typecheck, unit tests, production builds
npm run test:e2e   # API end-to-end tests
```

## Repository layout

```
apps/
  api/        NestJS modular monolith
  web/        Next.js application
  mobile/     Expo / React Native application
packages/
  config/       Application identity, API paths, regional defaults
  eslint-config/ Shared lint rules
  shared-types/ Contracts shared by the API, web and mobile clients
  ui/           Design tokens and shared components
database/     Migrations, seeds and fixtures (owned by Prisma from phase 1)
docker/       Dockerfiles and PostgreSQL bootstrap
docs/         Architecture, product and operational documentation
```

`@hris/shared-types` is the contract between the API and its clients: branded
identifiers that cannot be interchanged accidentally, the response envelope,
error codes, pagination, RBAC vocabulary, and the employee lifecycle state
machine. A change there is a change to the public surface of the platform.

## Documentation

| Document                                            | Contents                                                        |
| --------------------------------------------------- | --------------------------------------------------------------- |
| [MASTER_PRD.md](docs/MASTER_PRD.md)                 | Product requirements and module catalogue                        |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)             | System architecture, data model, security model                 |
| [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phase plan and acceptance criteria                            |
| [PHASE_STATUS.md](docs/PHASE_STATUS.md)             | What is done, and what is explicitly not                         |
| [DATABASE.md](docs/DATABASE.md)                     | Schema conventions, migrations, isolation, backup and recovery   |
| [API.md](docs/API.md)                               | Versioning, response contract, errors, pagination, correlation  |
| [SECURITY.md](docs/SECURITY.md)                     | Threat model, controls in place, controls still to come         |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)                 | Images, environment, release, rollback                          |
| [AI_SPEC.md](docs/AI_SPEC.md)                       | Provider-agnostic AI layer and its data boundaries               |
| [ADR/](docs/ADR/)                                   | Architecture decision records                                    |

## Security

Read [SECURITY.md](docs/SECURITY.md) before contributing. The rules that are
absolute in this repository:

- **The server is the trust boundary.** Never trust a client-supplied role, tenant
  id, entity id, employee id, price or approval. Every one of those is re-derived
  or re-checked against stored state on the server.
- **No secrets in the repository.** `.env` is ignored; `.env.example` documents
  variables with development-only values. Production secrets come from a secret
  manager.
- **Dependency install scripts are explicitly triaged** in the root `allowScripts`
  field. Adding a dependency that needs an install script is a security decision.
- **Audit trails are append-only.** Covered in [DATABASE.md](docs/DATABASE.md).

## Current limitations

Phase 0 deliberately leaves these undone. They are listed so nothing here is
mistaken for a finished feature:

- No authentication or authorisation. There is no login, no session and no RBAC
  enforcement yet; both arrive in phase 2.
- No database schema, no migrations and no ORM. PostgreSQL runs with extensions
  configured and an empty schema.
- No business modules, no employee data, no payroll calculation.
- `/health/ready` reports process health only. It does not yet check the database
  or the queue; that lands with the first connection in phase 1.
