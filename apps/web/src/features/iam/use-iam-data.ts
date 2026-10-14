'use client';

import { useCallback, useEffect, useState } from 'react';

import { ApiRequestError } from '@/lib/api/http-client';

interface UseIamLoadResult<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly reload: () => void;
}

/**
 * Loads one administration resource from the IAM repository and offers a reload.
 *
 * `reload` bumps a counter that re-runs the loader, so screens can call it after a
 * successful mutation. Unauthenticated/forbidden trips map to a friendly message the
 * screen can render inline.
 */
export function useIamLoad<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
): UseIamLoadResult<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error?: string }>({
    data: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    setState((previous) => ({ ...previous, loading: true }));
    void loader().then(
      (data) => {
        if (active) {
          setState({ data, loading: false });
        }
      },
      (error: unknown) => {
        if (!active) {
          return;
        }
        let message = 'This data could not be loaded.';
        if (error instanceof ApiRequestError) {
          message =
            error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN'
              ? 'You do not have permission to view this data.'
              : error.message;
        }
        setState({ data: null, loading: false, error: message });
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return { data: state.data, loading: state.loading, error: state.error, reload };
}
