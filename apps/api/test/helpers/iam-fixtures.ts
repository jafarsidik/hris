import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { withCompanyProvisioning, withTenantContext } from '@hris/database';

import { PasswordService } from '../../src/common/auth/password.service';
import { PrismaService } from '../../src/modules/database/prisma.service';

/**
 * Provisions a self-contained tenant (company + an ACTIVE administrator holding the
 * SYSTEM_ADMIN role) for end-to-end IAM tests.
 *
 * Every test uses its own random company id, so RLS gives cross-test isolation with
 * no teardown: rows for one company are invisible to another tenant and the database
 * can be shared safely even when suites run in parallel.
 */
export async function provisionTenant(
  app: INestApplication,
  options: { adminEmail: string; adminPassword: string },
): Promise<{ companyId: string; adminId: string }> {
  const prisma = app.get(PrismaService);
  const passwords = app.get(PasswordService);
  const client = prisma.getClient();

  const companyId = randomUUID();
  const companyCode = `E2E_${companyId.slice(0, 8)}`.toUpperCase();

  await withCompanyProvisioning(client, companyId, (tx) =>
    tx.company.create({
      data: { id: companyId, code: companyCode, name: `E2E Tenant ${companyCode}` },
    }),
  );

  const passwordHash = await passwords.hashPassword(options.adminPassword);
  const adminId = randomUUID();

  await withTenantContext(client, companyId, async (tx) => {
    await tx.user.create({
      data: {
        id: adminId,
        companyId,
        email: options.adminEmail,
        displayName: 'E2E Administrator',
        status: 'ACTIVE',
        passwordHash,
        hasVerifiedEmail: true,
      },
    });

    const adminRole = await tx.role.findUniqueOrThrow({ where: { key: 'SYSTEM_ADMIN' } });
    await tx.userRole.create({
      data: { userId: adminId, roleId: adminRole.id, companyId },
    });
  });

  return { companyId, adminId };
}
