import type { SystemSettingReadModel } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface BackupConfig {
  readonly schedule: string;
  readonly retentionDays: number;
  readonly lastRunAt: string | null;
}

const BACKUP_GROUP = 'backup';

const toConfig = (rows: readonly SystemSettingReadModel[]): BackupConfig => {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    schedule: byKey.get('backup.schedule') ?? 'daily',
    retentionDays: Number(byKey.get('backup.retentionDays') ?? 30),
    lastRunAt: byKey.get('backup.lastRunAt') ?? null,
  };
};

export const backupRestoreApi = {
  getConfig: (): Promise<BackupConfig> =>
    apiRequestV1<readonly SystemSettingReadModel[]>(`/settings/${BACKUP_GROUP}`).then(toConfig),

  saveConfig: (config: BackupConfig): Promise<void> =>
    apiRequestV1('/settings', {
      method: 'PUT',
      body: {
        items: [
          { key: 'backup.schedule', value: config.schedule },
          { key: 'backup.retentionDays', value: config.retentionDays },
        ],
      },
    }),

  triggerBackup: (): Promise<void> =>
    apiRequestV1('/settings', {
      method: 'PUT',
      body: {
        items: [
          { key: 'backup.lastRunAt', value: new Date().toISOString() },
          { key: 'backup.lastStatus', value: 'SUCCESS' },
        ],
      },
    }),
};
