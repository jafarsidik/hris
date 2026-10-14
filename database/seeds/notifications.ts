/**
 * Company-scoped notification template defaults.
 *
 * `notification_templates` is tenant-scoped and unique on
 * (companyId, eventKey, channel). The seed provisions the
 * `NOTIFICATION_TEMPLATE_DEFAULTS` catalogue for every company that exists when
 * the seed runs, so a fresh company starts with the same copy the runtime
 * fallback would render. The push channel is skipped: push notifications are
 * disabled by default and have no in-app renderer yet, so seeding them would
 * create rows no surface can edit meaningfully.
 */
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_KEYS,
  NOTIFICATION_TEMPLATE_DEFAULTS,
} from '@hris/shared-types';

import type { PrismaClient } from '../src/generated/prisma/client';

export interface NotificationSeedResult {
  readonly companies: number;
  readonly templates: number;
}

export async function seedNotificationTemplates(
  client: PrismaClient,
): Promise<NotificationSeedResult> {
  const companies = await client.company.findMany({ select: { id: true } });

  let templates = 0;
  for (const company of companies) {
    for (const eventKey of NOTIFICATION_EVENT_KEYS) {
      for (const channel of NOTIFICATION_CHANNELS) {
        if (channel === 'PUSH') {
          continue;
        }
        const defaults = NOTIFICATION_TEMPLATE_DEFAULTS[eventKey][channel];
        await client.notificationTemplate.upsert({
          where: {
            companyId_eventKey_channel: { companyId: company.id, eventKey, channel },
          },
          create: {
            companyId: company.id,
            eventKey,
            channel,
            subjectTemplate: defaults.subjectTemplate,
            bodyTemplate: defaults.bodyTemplate,
            enabled: true,
          },
          update: {},
        });
        templates += 1;
      }
    }
  }

  return { companies: companies.length, templates };
}
