/**
 * Soft-delete filtering, applied as a client extension so callers cannot forget it.
 *
 * The alternative is a `deleted_at IS NULL` clause in every query, which is exactly
 * the kind of rule that gets omitted in the one query written under time pressure, and
 * the omission is invisible until deleted records start reappearing in a list.
 *
 * Only the models listed in {@link SOFT_DELETED_MODELS} are filtered. Countries,
 * currencies, roles, permissions, `user_roles` and `audit_logs` have no `deleted_at`
 * column and hard-delete or append-only semantics, so filtering them would reference a
 * field that does not exist.
 *
 * Prisma 7 no longer exposes `dmmf` from a generated client, so the list cannot be
 * derived from the schema at runtime. `database/tests/schema-contract.test.ts`
 * compares this list against `schema.prisma` and fails when a soft-deleted model is
 * added without being registered here.
 */
import { Prisma } from './generated/prisma/client';

/** Models that carry a nullable `deleted_at` column. */
export const SOFT_DELETED_MODELS = [
  'Company',
  'Entity',
  'OrganizationalUnit',
  'User',
  'Session',
] as const;

export type SoftDeletedModel = (typeof SOFT_DELETED_MODELS)[number];

const SOFT_DELETED_MODEL_SET: ReadonlySet<string> = new Set(SOFT_DELETED_MODELS);

/** Read operations that accept an arbitrary `where`, so the filter can be added. */
const FILTERABLE_OPERATIONS: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

function isSoftDeletedModel(model: string | undefined): boolean {
  return model !== undefined && SOFT_DELETED_MODEL_SET.has(model);
}

function isSoftDeletedRecord(result: unknown): boolean {
  if (result === null || typeof result !== 'object') {
    return false;
  }

  return (result as { deletedAt?: unknown }).deletedAt != null;
}

/**
 * Filters out soft-deleted rows on reads.
 *
 * Two shapes of operation need different handling, and conflating them is how this
 * kind of extension silently starts hiding rows:
 *
 *   * `findMany`, `findFirst`, `count`, `aggregate` and `groupBy` take a plain filter,
 *     so `deleted_at IS NULL` can simply be ANDed into the existing `where`.
 *   * `findUnique` and `findUniqueOrThrow` take a *unique* input that rejects any
 *     non-unique field. Passing `deletedAt: null` there is a validation error, not a
 *     filter, so the result is post-checked instead. `findUniqueOrThrow` raises the
 *     same `P2025` Prisma uses for a missing record, which keeps existing
 *     `catch` blocks working.
 *
 * Writes are deliberately left alone. Filtering them would turn `delete` into a
 * no-op update on an already-deleted row, and purging is an explicit decision that
 * should have to be spelled out as `deletedAt: null` in the `where` clause.
 */
export function softDeleteExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!isSoftDeletedModel(model)) {
              return query(args);
            }

            if (FILTERABLE_OPERATIONS.has(operation)) {
              // `args` is a union of every model's operation arguments, so `where` only
              // exists on the read shapes. The operation was already narrowed above.
              const existing = (args as { where?: unknown } | undefined)?.where ?? {};

              return query({
                ...args,
                where: { AND: [existing, { deletedAt: null }] },
              } as never);
            }

            if (operation === 'findUnique') {
              const result: unknown = await query(args);
              return isSoftDeletedRecord(result) ? null : result;
            }

            if (operation === 'findUniqueOrThrow') {
              const result: unknown = await query(args);

              if (isSoftDeletedRecord(result)) {
                throw new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
                  code: 'P2025',
                  clientVersion: Prisma.prismaVersion.client,
                });
              }

              return result;
            }

            return query(args);
          },
        },
      },
    }),
  );
}
