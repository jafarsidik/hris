/**
 * Company-scoped system setting defaults.
 *
 * `system_settings` rows are tenant-scoped (unique on companyId/group/key), so the
 * seed provisions the `SYSTEM_SETTING_DEFAULTS` catalogue for every company that
 * exists when the seed runs, and is a no-op for a database with no companies.
 * Later tenant provisioning should insert the same catalogue for new companies via
 * the same function.
 */
import type { SettingValueType } from '@hris/shared-types';
import { SYSTEM_SETTING_DEFAULTS } from '@hris/shared-types';

import type { Prisma, PrismaClient } from '../src/generated/prisma/client';

import type { SystemSettingDefault } from '@hris/shared-types';

export interface SettingsSeedResult {
  readonly companies: number;
  readonly settings: number;
}

export async function seedSettings(client: PrismaClient): Promise<SettingsSeedResult> {
  const companies = await client.company.findMany({ select: { id: true } });

  let settings = 0;
  for (const company of companies) {
    for (const row of SYSTEM_SETTING_DEFAULTS) {
      await upsertSetting(client, company.id, row);
      settings += 1;
    }
  }

  return { companies: companies.length, settings };
}

async function upsertSetting(
  client: PrismaClient,
  companyId: string,
  row: SystemSettingDefault,
): Promise<void> {
  await client.systemSetting.upsert({
    where: {
      companyId_group_key: {
        companyId,
        group: row.group,
        key: row.key,
      },
    },
    create: {
      companyId,
      group: row.group,
      key: row.key,
      value: (row.value ?? null) as Prisma.InputJsonValue,
      valueType: row.valueType as SettingValueType,
      isSensitive: row.isSensitive ?? false,
      isEditable: row.isEditable ?? true,
      description: row.description ?? null,
    },
    update: {
      valueType: row.valueType as SettingValueType,
      description: row.description ?? null,
    },
  });
}
