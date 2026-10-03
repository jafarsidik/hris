# Database assets

Migrations, seeds and fixtures for the HRIS database.

**This directory is intentionally empty of schema.** The database currently has no
application tables. Prisma is adopted in
[phase 1](../docs/PHASE_STATUS.md); see
[ADR 0002](../docs/ADR/0002-prisma-orm.md).

## Contents once phase 1 lands

| Path            | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `migrations/`   | Prisma migrations, applied in order and never edited after being applied |
| `seeds/`        | Idempotent reference data: countries, currencies, leave types, role definitions |
| `fixtures/`     | Test fixtures. Synthetic records only, never real personal data           |

## What does not belong here

- **Table definitions.** The cluster bootstrap in `docker/postgres/init` prepares
  extensions and timeouts and creates no tables. Application schema belongs in
  migrations, because a bootstrap script cannot be replayed, diffed or rolled back.
- **Hand-written DDL.** If it is not produced by a migration, it will drift from the
  schema the application expects.
- **Real personal data.** Seeds and fixtures are committed to version control. A
  payslip or a disciplinary record in this repository is a data breach.

## Conventions

The rules for identifiers, money, timestamps, soft deletion and tenant isolation are
in [DATABASE.md](../docs/DATABASE.md). They apply from the first migration onward so
they are never retrofitted onto a populated table.

## Applying migrations

```bash
# Generate a migration from a schema change
npm run db:migrate --workspace @hris/api -- --name descriptive_change

# Apply pending migrations
npm run db:deploy --workspace @hris/api

# Reset and reseed a local database (destroys all local data)
npm run db:reset --workspace @hris/api
```

These scripts are added in phase 1 alongside Prisma. They do not exist yet.

## Recreating a local database

Cluster-level settings from `docker/postgres/init` apply only on first
initialisation:

```bash
npm run stack:down
docker volume rm hris_postgres-data
npm run stack:up
```

This deletes all data. Never run it outside local development.
