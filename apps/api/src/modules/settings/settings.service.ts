import { Inject, Injectable } from '@nestjs/common';

import { type Prisma, withTenantContext } from '@hris/database';
import {
  SYSTEM_SETTING_DEFAULTS,
  type SettingGroup,
  type SettingValueType,
  type SystemSettingReadModel,
  isSettingGroup,
} from '@hris/shared-types';

import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { ValidationError } from '../../common/errors/app-error';
import { LOG_EVENT_TYPES } from '@hris/shared-types';

/** Server-side placeholder for a set-but-sensitive value; the client shows set/unset. */
export const MASKED_SETTING_VALUE = '••••••••';

export interface SettingUpdateInput {
  readonly key: string;
  /**
   * For sensitive values, an empty string means "leave unchanged": the stored secret
   * can never be read back, so the client expresses the two states as set (masked)
   * or unset, and only a non-blank value replaces the secret.
   */
  readonly value: unknown;
}

interface SystemSettingRow {
  readonly id: string;
  readonly companyId: string;
  readonly group: string;
  readonly key: string;
  readonly value: unknown;
  readonly valueType: SettingValueType;
  readonly isSensitive: boolean;
  readonly isEditable: boolean;
  readonly description: string | null;
  readonly updatedAt: Date;
}

const SETTING_SELECT = {
  id: true,
  companyId: true,
  group: true,
  key: true,
  value: true,
  valueType: true,
  isSensitive: true,
  isEditable: true,
  description: true,
  updatedAt: true,
} as const;

/**
 * System settings (brief, Administration: System Settings; tabbed by group).
 *
 * Values are company-scoped JSON rows. Reads mask sensitive values; writes validate
 * against each setting's stored type and write an audit + event record so a
 * configuration change is attributable to the user who made it.
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  async listSettings(companyId: string, group?: string): Promise<SystemSettingReadModel[]> {
    const client = this.prisma.getClient();
    const where = { companyId, ...(group && isSettingGroup(group) ? { group } : {}) };
    const rows = await withTenantContext(client, companyId, (tx) =>
      tx.systemSetting.findMany({
        where,
        orderBy: [{ group: 'asc' }, { key: 'asc' }],
        select: SETTING_SELECT,
      }),
    );
    return rows.map(toReadModel);
  }

  /**
   * Returns the effective value for a setting key: the stored row when one exists,
   * otherwise the catalogue default. Policy consumers (notifications, MFA, SSO)
   * read through this so a company whose settings were never touched behaves
   * exactly like a seeded company.
   */
  async getEffectiveSetting(companyId: string, key: string): Promise<unknown> {
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, (tx) =>
      tx.systemSetting.findFirst({
        where: { companyId, key },
        select: { value: true },
      }),
    );
    if (row) {
      return row.value;
    }
    return SYSTEM_SETTING_DEFAULTS.find((entry) => entry.key === key)?.value ?? null;
  }

  async updateSettings(
    companyId: string,
    actorUserId: string,
    items: readonly SettingUpdateInput[],
  ): Promise<SystemSettingReadModel[]> {
    if (items.length === 0) {
      throw new ValidationError('At least one setting must be provided.');
    }

    const client = this.prisma.getClient();
    const updated: SystemSettingReadModel[] = [];

    await withTenantContext(client, companyId, async (tx) => {
      for (const item of items) {
        const row = await tx.systemSetting.findFirst({
          where: { companyId, key: item.key },
          select: SETTING_SELECT,
        });

        if (!row) {
          throw new ValidationError(`The setting "${item.key}" does not exist.`);
        }
        if (!row.isEditable) {
          throw new ValidationError(`The setting "${item.key}" is not editable.`);
        }

        const nextValue = resolveUpdateValue(row, item.value);

        await tx.systemSetting.update({
          where: { id: row.id },
          data: { value: nextValue as Prisma.InputJsonValue, createdBy: actorUserId },
        });

        await this.logs.recordEvent(companyId, {
          category: 'ACTIVITY',
          eventType: LOG_EVENT_TYPES['settings.updated'],
          actorUserId,
          resource: 'setting',
          resourceId: item.key,
          status: 'SUCCESS',
          metadata: { group: row.group, sensitive: row.isSensitive },
        });
        await this.logs.writeAudit(companyId, {
          actorUserId,
          action: 'settings.update',
          resource: 'setting',
          resourceId: item.key,
          payload: { group: row.group, untrustedValueSet: !row.isSensitive },
        });

        updated.push(
          toReadModel({ ...row, value: nextValue, group: row.group, updatedAt: new Date() }),
        );
      }
    });

    return updated;
  }
}

function toReadModel(row: SystemSettingRow): SystemSettingReadModel {
  const isSet = row.value !== null && row.value !== undefined;
  return {
    group: row.group as SettingGroup,
    key: row.key,
    value: row.isSensitive ? (isSet ? MASKED_SETTING_VALUE : null) : String(row.value),
    valueType: row.valueType,
    isSensitive: row.isSensitive,
    isEditable: row.isEditable,
    description: row.description,
  };
}

/**
 * Validates an inbound value against the setting's declared type and returns what to
 * store. A sensitive setting refuses to be cleared through the empty-string signal
 * only when a value already exists (see {@link SettingUpdateInput}).
 */
function resolveUpdateValue(row: SystemSettingRow, inbound: unknown): unknown {
  if (
    row.isSensitive &&
    (inbound === undefined || (typeof inbound === 'string' && inbound.trim() === ''))
  ) {
    if (row.value === null || row.value === undefined) {
      return null;
    }
    return row.value;
  }

  switch (row.valueType) {
    case 'STRING':
      if (typeof inbound !== 'string') {
        throw new ValidationError(`The setting "${row.key}" expects a text value.`);
      }
      return inbound;
    case 'NUMBER': {
      const parsed = typeof inbound === 'number' ? inbound : Number(inbound);
      if (!Number.isFinite(parsed)) {
        throw new ValidationError(`The setting "${row.key}" expects a number.`);
      }
      return parsed;
    }
    case 'BOOLEAN':
      if (inbound === true || inbound === 'true') {
        return true;
      }
      if (inbound === false || inbound === 'false') {
        return false;
      }
      throw new ValidationError(`The setting "${row.key}" expects a boolean.`);
    case 'STRING_LIST':
      if (!Array.isArray(inbound) || inbound.some((entry) => typeof entry !== 'string')) {
        throw new ValidationError(`The setting "${row.key}" expects a list of text values.`);
      }
      return inbound;
    case 'JSON':
      if (typeof inbound !== 'object' || inbound === null || Array.isArray(inbound)) {
        throw new ValidationError(`The setting "${row.key}" expects a structured value.`);
      }
      return inbound;
    default:
      throw new ValidationError(`The setting "${row.key}" has an unrecognised value type.`);
  }
}
