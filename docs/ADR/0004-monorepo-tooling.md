# ADR 0004: npm workspaces with per-application test runners

- **Status**: Accepted
- **Date**: 2026-10-03

## Context

Four kinds of code coexist: a NestJS API, a Next.js application, an Expo
application, and shared packages. The repository needs one install, one lockfile and
one `npm run verify` command, while each application uses tooling suited to its
framework.

The tooling in question: NestJS is built and tested with the Nest CLI and Jest.
Next.js and Expo both have first-class Vite integrations and are better served by
Vitest, which is dramatically faster and needs no Babel transform.

## Decision

Use **npm workspaces** with a single root lockfile, and let each application choose
its own test runner:

| Target               | Runner    | Reason                                          |
| -------------------- | --------- | ----------------------------------------------- |
| `apps/api`           | Jest      | Nest CLI integrates with Jest; decorators and DI need its transformer |
| `packages/*`         | Jest      | Matches the API so the workspace shares config   |
| `apps/web`           | Vitest    | Native Vite pipeline, far faster, no Babel       |
| `apps/mobile`        | Vitest    | Same reasoning; component rendering is added later with `jest-expo` or `@testing-library/react-native` |

The root exposes uniform verbs — `lint`, `typecheck`, `test`, `build` — that fan out
across workspaces with `--if-present`.

## Rationale

**One dependency graph.** A single lockfile means one `npm ci` in CI, no version
skew between applications, and atomic version bumps for a contract change that
affects three consumers.

**Fighting the framework's tooling costs more than it saves.** Forcing Vitest on
the API means reimplementing decorator metadata handling and DI-aware transforms.
Forcing Jest on web means Babel configuration and slow runs. Each application gets
its native path; the *interface* stays uniform even though the implementations
differ.

**Uniform verbs keep CI honest.** CI runs `npm run verify` and does not need to know
which runner a package uses.

## Consequences

**Accepted costs**

- Two test runners in one repository, so contributors must know which to use per
  package.
- Shared packages use Jest. Web and mobile components use Vitest with a real DOM
  environment via Testing Library, which is the better fit for components that
  respond to interaction; the original cost recorded here, rendering `@hris/ui` under
  `react-dom/server`, disappeared when ADR 0008 deleted that package.
- Test commands are not perfectly symmetric across workspaces.

**Mitigations**

- The runner for each package is recorded in its own `package.json` and in
  [ADR 0003](0003-shared-contracts.md), so the rule is discoverable from the code.
- `npm run verify` at the root is the only command contributors and CI need.
- The API's end-to-end tests are a separate script, `npm run test:e2e`, because they
  boot the application and are slower than unit tests.

## Alternatives considered

- **A monorepo orchestrator such as Nx or Turborepo**: better caching and affected
  project detection, at the cost of another tool, its configuration format and its
  own learning curve. Revisit if CI time becomes a real cost — the workspace layout
  here is compatible with adopting one.
- **A single runner everywhere (Jest)**: uniform, but materially slower for the two
  client applications and requires more framework-specific configuration.
- **Separate repositories per application**: independent pipelines, but the shared
  contract package then needs real versioning, and an atomic change across the API
  and both clients becomes impossible.
