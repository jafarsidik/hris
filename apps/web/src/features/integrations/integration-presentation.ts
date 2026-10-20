import type {
  IntegrationDeliveryStatus,
  IntegrationKind,
  IntegrationStatus,
} from '@hris/shared-types';

/** Human labels for the integration kind vocabulary. */
export const KIND_LABELS: Readonly<Record<IntegrationKind, string>> = {
  EMAIL: 'Email',
  WEBHOOK: 'Webhook',
  STORAGE: 'Storage',
  ANALYTICS: 'Analytics',
  OTHER: 'Other',
};

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

/**
 * Maps integration health onto a badge variant.
 *
 * `CONNECTED` is the healthy state (success, not the brand `default`, which would read as
 * neutral); a fault is `destructive`; `UNKNOWN` is not a fault — it simply has not been
 * checked — so it stays neutral.
 */
export function statusBadgeVariant(status: IntegrationStatus): BadgeVariant {
  switch (status) {
    case 'CONNECTED':
      return 'success';
    case 'DISCONNECTED':
    case 'ERROR':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/** Maps a delivery outcome onto a badge variant. */
export function deliveryBadgeVariant(status: IntegrationDeliveryStatus): BadgeVariant {
  switch (status) {
    case 'SUCCEEDED':
      return 'success';
    case 'RETRYING':
      return 'warning';
    default:
      return 'destructive';
  }
}

/** Formats an ISO timestamp for display, or "Never" for null. */
export function formatTimestamp(value: string | null): string {
  if (value === null) {
    return 'Never';
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
