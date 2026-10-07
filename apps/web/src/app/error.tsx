'use client';

import { ErrorPanel } from '@/components/feedback/error-panel';
import { useEffect } from 'react';

/**
 * Route-level error boundary.
 *
 * A client component because Next hands it the `reset` callback. It renders inside
 * `layout.tsx`, so the sidebar and header survive a failure — losing navigation
 * precisely when a user needs to get somewhere else is a poor trade.
 *
 * The thrown value is never rendered as text. Next redacts server error messages in
 * production builds, so `error.message` is unreliable here by design, and a boundary
 * that printed it would show developers a stack-shaped string in production and users
 * nothing useful. `digest` is the only field guaranteed to exist in both environments,
 * so it is what the panel is told to cite.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the join key between this screen and the server log line, so it is
    // recorded client-side too. Deliberately does not log the message: it can carry
    // request data, and the server log already has it.
    console.error('Route error', { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* `describeApiError` reads `correlationId`, not `digest`, so no reference is
          printed by the panel here and the digest below is the only one on screen. */}
      <ErrorPanel error={error} onRetry={reset}>
        {error.digest !== undefined && (
          <p className="text-xs">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </ErrorPanel>
    </div>
  );
}
