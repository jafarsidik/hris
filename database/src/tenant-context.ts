/**
 * Transaction-scoped tenant context.
 *
 * The row-level security policies in the initial migration read
 * `app.current_company_id`. That value has to be set on the same connection that runs
 * the query, and the only reliable way to guarantee that is to set it inside a
 * transaction: `set_config(..., true)` is then scoped to that transaction and is
 * discarded on commit or rollback, so a pooled connection can never carry one
 * request's tenant into the next request that borrows it.
 *
 * Doing this with the application's authorisation checks alone would leave the
 * database policies untested and unenforced, and a forgotten `company_id` in a
 * `where` clause would then return another tenant's rows with nothing to stop it.
 */

import type { DatabaseClient } from './client';
import type { Prisma } from './generated/prisma/client';

/** The session setting the policies read. Kept in one place so it cannot drift. */
export const COMPANY_ID_SETTING = 'app.current_company_id';

/** The one-off setting that permits the first row in a new company. */
export const PROVISIONING_SETTING = 'app.allow_company_provisioning';

/** A UUID, checked before it reaches the database. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The subset of a transaction client that can run raw statements. */
export interface TenantTransactionClient {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * The client shape this module operates on.
 *
 * `$extends` returns a client whose `$transaction` callback receives a wider transaction
 * type than `Prisma.TransactionClient`, and TypeScript's assignability rules for generic
 * signatures reject one in favour of the other no matter how the parameter is declared.
 * Rather than loosening every query in every caller, the friction is contained here: the
 * caller passes the client, the callback gets a fully typed `Prisma.TransactionClient`,
 * and the single unavoidable cast is in {@link runInTransaction}.
 */
export type TenantContextHost = DatabaseClient;

export function assertCompanyId(companyId: string): string {
  if (!UUID_PATTERN.test(companyId)) {
    throw new Error(
      `Company id must be a UUID before it can be used as a tenant context, received "${companyId}".`,
    );
  }

  return companyId;
}

/**
 * Runs `work` inside a transaction with the tenant set.
 *
 * Every query in phase 1 belongs inside this function. A query on the plain client has
 * no `app.current_company_id`, and the policies are written to fail closed, so such a
 * query returns nothing rather than returning too much.
 */
export function withTenantContext<TResult>(
  client: TenantContextHost,
  companyId: string,
  work: (transaction: Prisma.TransactionClient) => Promise<TResult>,
): Promise<TResult> {
  return runInTransaction(client, work, (transaction) =>
    transaction.$executeRawUnsafe(
      `SELECT set_config('${COMPANY_ID_SETTING}', $1, true)`,
      assertCompanyId(companyId),
    ),
  );
}

/**
 * Allows exactly one company insert, then relies on the transaction ending.
 *
 * Two settings are needed, and the second one is not obvious.
 *
 * `app.allow_company_provisioning` opens the `companies` insert policy, because a new
 * company cannot reference itself as a tenant context before it exists.
 *
 * `app.current_company_id` is then set to that same new company, so the row being
 * inserted also satisfies the `companies` select policy. This is required, not
 * optional: PostgreSQL evaluates the select policies for an `INSERT ... RETURNING`,
 * and Prisma always sends a `RETURNING` clause to read back the generated columns. With
 * only the provisioning flag set, the insert is rejected with
 * "new row violates row-level security policy for table companies" even though the
 * `WITH CHECK` condition is satisfied.
 *
 * The upshot is that company creation is "become the tenant you are creating": the
 * caller generates the company id up front and passes it to `create`. That also removes
 * the need to revoke anything afterwards, since both settings are transaction-local and
 * are discarded on commit or rollback alike — which is fortunate, because revoking in a
 * `finally` block cannot work when the transaction has already been aborted.
 */
export function withCompanyProvisioning<TResult>(
  client: TenantContextHost,
  companyId: string,
  work: (transaction: Prisma.TransactionClient) => Promise<TResult>,
): Promise<TResult> {
  return runInTransaction(client, work, async (transaction) => {
    await transaction.$executeRawUnsafe(
      `SELECT set_config('${COMPANY_ID_SETTING}', $1, true)`,
      assertCompanyId(companyId),
    );

    await transaction.$executeRawUnsafe(`SELECT set_config('${PROVISIONING_SETTING}', 'on', true)`);
  });
}

/**
 * The single place the extended client's transaction type is reconciled with
 * `Prisma.TransactionClient`.
 *
 * The cast is sound because the extension only narrows reads: it filters soft-deleted
 * rows, so anything returned through this transaction is a valid
 * `Prisma.TransactionClient` result for the same query. Widening the public type
 * instead would push an `any` into every caller's queries, which is a much worse trade
 * than one documented assertion here.
 */
function runInTransaction<TResult>(
  client: TenantContextHost,
  work: (transaction: Prisma.TransactionClient) => Promise<TResult>,
  before: (transaction: Prisma.TransactionClient) => Promise<unknown>,
): Promise<TResult> {
  return client.$transaction(async (transaction) => {
    const typed = transaction as unknown as Prisma.TransactionClient;
    await before(typed);

    return work(typed);
  });
}
