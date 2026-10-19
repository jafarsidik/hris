import type { SystemSettingReadModel } from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';

export interface SettingUpdateInput {
  readonly key: string;
  readonly value: unknown;
}

export const tenantSettingsApi = {
  list: (group?: string): Promise<readonly SystemSettingReadModel[]> =>
    apiRequestV1<readonly SystemSettingReadModel[]>(
      group === undefined ? '/settings' : `/settings/${encodeURIComponent(group)}`,
    ),

  update: (items: readonly SettingUpdateInput[]): Promise<readonly SystemSettingReadModel[]> =>
    apiRequestV1<readonly SystemSettingReadModel[]>('/settings', {
      method: 'PUT',
      body: { items },
    }),
};
