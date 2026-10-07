'use client';

import { describeApiError } from '@/lib/api/error-descriptions';
import { AlertCircle, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const ICONS = {
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info,
} as const;

/**
 * `info` maps to the neutral alert rather than gaining a fourth variant: "not found"
 * and "not implemented" are ordinary outcomes, and a distinct colour would make them
 * look like incidents.
 */
const ALERT_VARIANT = {
  error: 'destructive',
  warning: 'warning',
  info: 'default',
} as const;

/**
 * Renders a failed data fetch.
 *
 * The panel states the outcome in words, so it does not rely on the alert's colour or
 * icon to be understood. The reference is shown in a monospace element because it is
 * meant to be copied into a support request verbatim.
 */
export function ErrorPanel({
  error,
  onRetry,
  children,
}: {
  error: unknown;
  /** Omitted when there is nothing sensible to re-run, such as a bad address. */
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const described = describeApiError(error);
  const Icon = ICONS[described.tone];

  return (
    <Alert variant={ALERT_VARIANT[described.tone]}>
      <Icon aria-hidden="true" />
      <AlertTitle>{described.title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          <p>{described.description}</p>

          {described.correlationId !== undefined && (
            <p className="text-xs">
              Reference: <span className="font-mono">{described.correlationId}</span>
            </p>
          )}

          {children}

          {onRetry !== undefined && described.canRetry && (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
