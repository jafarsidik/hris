/**
 * Public surface of `@hris/database`.
 *
 * The generated client is re-exported from here rather than imported from its
 * `src/generated` path by consumers, so that moving the generator output does not
 * require touching code outside this package.
 */
export {
  type PostgresConnectionSettings,
  type PostgresEnvironment,
  buildPostgresUrl,
  missingApplicationPostgresVariables,
  missingPostgresVariables,
  readApplicationPostgresSettings,
  readPostgresSettings,
  redactPostgresUrl,
} from './connection-string';

export {
  type CreatePrismaClientOptions,
  type DatabaseClient,
  createPrismaClient,
  describeApplicationConnection,
} from './client';

export {
  COMPANY_ID_SETTING,
  PROVISIONING_SETTING,
  type TenantTransactionClient,
  assertCompanyId,
  withCompanyProvisioning,
  withTenantContext,
} from './tenant-context';

export {
  SOFT_DELETED_MODELS,
  type SoftDeletedModel,
  softDeleteExtension,
} from './soft-delete-extension';

export { Prisma } from './generated/prisma/client';
export { PrismaClient } from './generated/prisma/client';
