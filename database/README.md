# @hris/database

Prisma schema, migrations, seeds and the tenant-scoped client factory.

## Layout

| Path                | Contents                                                        |
| ------------------- | --------------------------------------------------------------- |
| `schema.prisma`     | The full platform schema. Source of truth for the data model.   |
| `prisma.config.ts`  | Prisma 7 CLI configuration (schema, migrations, seed).          |
| `migrations/`       | Applied migrations, in order. Never edited once applied.         |
| `seeds/`            | Reference data. Idempotent, and run as the migration owner.     |
| `scripts/`          | Maintenance commands that are not migrations.                   |
| `src/`              | The client factory, tenant context and soft-delete filter.      |
| `tests/`            | `*.test.ts` runs hermetically; `*.integration.ts` needs a database. |

`src/generated/` is produced by `prisma generate` and is not committed.

## Commands

```bash
npm run db:generate -w @hris/database        # regenerate the client
npm run db:migrate   -w @hris/database       # create and apply a migration (dev)
npm run db:deploy    -w @hris/database       # apply migrations (CI, production)
npm run db:status    -w @hris/database       # has anything drifted?
npm run db:seed      -w @hris/database       # reference data, idempotent
npm run db:grant     -w @hris/database       # provision the application role
npm run db:reset     -w @hris/database       # drop, re-migrate and re-seed (local only)
npm run test:integration -w @hris/database   # RLS, audit and seed tests
```

`db:reset` is a development convenience and destroys all local data.

Order on a new environment is `db:deploy` → `db:seed` → `db:grant`. See
[../docs/DATABASE.md](../docs/DATABASE.md) for why.

## What does not belong here

- **Table definitions.** The cluster bootstrap in `docker/postgres/init` prepares
  extensions and timeouts and creates no tables. Application schema belongs in
  migrations, because a bootstrap script cannot be replayed, diffed or rolled back.
- **Hand-written DDL.** If it is not produced by a migration, it will drift from the
  schema the application expects.
- **Real personal data.** Seeds and fixtures are committed to version control. A
  payslip or a disciplinary record in this repository is a data breach.
- **Role grants in SQL.** Grants depend on environment-supplied role names and belong
  in `scripts/grant-app-privileges.ts`.

Conventions for identifiers, money, timestamps, soft deletion and tenant isolation are
in [../docs/DATABASE.md](../docs/DATABASE.md). They apply from the first migration
onward, so they are never retrofitted onto a populated table.

## Recreating a local database

Cluster-level settings from `docker/postgres/init` apply only on first
initialisation. To re-run them, the volume has to go:

```bash
npm run stack:down
docker volume rm hris_postgres-data
npm run stack:up
```

This deletes all data. Never run it outside local development.

Note that `db:reset` does **not** re-run the bootstrap script; it only replays
migrations. Dropping the schema also drops every grant, which is why `db:grant` has to
be re-run afterwards:

```bash
npm run db:reset -w @hris/database
npm run db:grant -w @hris/database
```

## Using the client

Every query runs inside a tenant context. A query without one returns nothing, because
the row-level security policies fail closed.

```ts
import { createPrismaClient, withTenantContext } from '@hris/database';

const client = createPrismaClient();

const users = await withTenantContext(client, companyId, (tx) =>
  tx.user.findMany({ where: { status: 'ACTIVE' } }),
);
```

Two details are easy to get wrong:

- **Pass `companyId` explicitly even though the context is set.** The session setting
  makes rows *visible*; it does not populate columns. A create without `companyId` fails
  on the not-null constraint.
- **`findUnique` cannot be filtered.** Prisma rejects `deletedAt: null` in a unique
  input, so the soft-delete extension post-checks the row instead: `findUnique` returns
  `null` and `findUniqueOrThrow` raises `P2025`.

Creating a company is different, because a company cannot be its own tenant context
before it exists:

```ts
const companyId = randomUUID();

await withCompanyProvisioning(client, companyId, (tx) =>
  tx.company.create({ data: { id: companyId, code: 'ACME', name: 'Acme' } }),
);
```

## Changing the schema

1. Edit `schema.prisma`.
2. `npm run db:migrate -w @hris/database -- --name <change>`. The `--` is required:
   without it npm consumes `--name` itself and Prisma never sees it.
3. If the change touches `Action` or `DataScope`, update `@hris/shared-types` too, in
   the same commit. A test compares the two and fails when they disagree.
4. If the change adds a soft-deleted model, add it to `SOFT_DELETED_MODELS`. Another
   test compares that list against `schema.prisma`.

Both tests exist because Prisma 7 no longer exposes `dmmf`, so neither fact can be
derived at runtime.