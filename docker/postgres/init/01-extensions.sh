#!/bin/bash
# =============================================================================
# HRIS database bootstrap
#
# Runs once, on an empty data directory. Changes here do NOT apply to an existing
# volume: recreate it (`docker compose down -v`) or express the change as a
# Prisma migration under `database/migrations` (phase 1).
#
# This file only prepares the cluster. It deliberately creates no tables:
# application schema is owned by migrations, never by hand-written DDL.
#
# A shell wrapper rather than a .sql file because the database name is only
# available as an environment variable, and psql's :"VAR" substitution reads
# -v flags rather than the process environment.
# =============================================================================
set -euo pipefail

psql --set=ON_ERROR_STOP=1 --set=DBNAME="$POSTGRES_DB" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
-- pgcrypto provides gen_random_uuid(); citext gives case-insensitive identifiers
-- for logins and employee codes, so 'HR-001' and 'hr-001' cannot coexist.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Unaccented, case-insensitive employee-name search. Without this, searching for
-- "Jose" silently fails to match "José", which users read as missing data.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Bound how long a single statement may run so a runaway report cannot hold locks
-- open and starve the connection pool. Override per environment when needed.
ALTER DATABASE :"DBNAME" SET statement_timeout = '30s';
ALTER DATABASE :"DBNAME" SET idle_in_transaction_session_timeout = '60s';

-- Row Level Security is enabled per table by the migrations that own each schema
-- (see docs/DATABASE.md). It cannot be switched on cluster-wide: a policy is inert
-- until ENABLE ROW LEVEL SECURITY is set on the specific table, and forgetting that
-- is the usual way RLS silently does nothing. Authorisation is enforced in the
-- application layer regardless; RLS is defence in depth behind that.
SQL
