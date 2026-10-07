import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { fetchLiveness, fetchReadiness, type ApiLiveness } from '@/lib/api/health';
import { ApiRequestError } from '@/lib/api/http-client';

export const metadata: Metadata = {
  title: 'Platform status',
};

// The result of a live probe is inherently per-request; it must never be cached
// or prerendered at build time.
export const dynamic = 'force-dynamic';

interface ProbeOutcome {
  readonly name: string;
  readonly healthy: boolean;
  readonly detail: string;
}

const probe = async (name: string, run: () => Promise<unknown>): Promise<ProbeOutcome> => {
  try {
    const result = await run();
    return { name, healthy: true, detail: describe(result) };
  } catch (error: unknown) {
    const detail =
      error instanceof ApiRequestError
        ? `${error.code}: ${error.message}`
        : 'Unexpected probe failure';
    return { name, healthy: false, detail };
  }
};

function describe(result: unknown): string {
  if (typeof result !== 'object' || result === null) {
    return 'Responded';
  }
  const candidate = result as Partial<ApiLiveness> & { status?: string };
  if (candidate.status === 'ok') {
    return candidate.service
      ? `${candidate.service} is up (${candidate.environment ?? 'unknown environment'})`
      : 'Healthy';
  }
  return 'Responded';
}

export default async function StatusPage() {
  const outcomes = await Promise.all([
    probe('Liveness', () => fetchLiveness()),
    probe('Readiness', () => fetchReadiness()),
  ]);

  const allHealthy = outcomes.every((outcome) => outcome.healthy);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Platform status"
        description="Live probe results from the HRIS API, executed on every request."
      />
      <Card>
        <CardHeader>
          {/* CardTitle renders a div, so the heading element is supplied here to
              keep the document outline navigable by screen reader users. */}
          <CardTitle>
            <h2>Live probes</h2>
          </CardTitle>
          <CardDescription>Liveness and readiness checks against the API</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-4">
            {outcomes.map((outcome) => (
              <li key={outcome.name} className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-medium">{outcome.name}</span>
                <span className="flex items-center gap-2">
                  <span className={outcome.healthy ? 'text-success' : 'text-destructive'}>
                    {outcome.detail}
                  </span>
                  <Badge variant={outcome.healthy ? 'success' : 'destructive'}>
                    {outcome.healthy ? 'Healthy' : 'Unavailable'}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          {/* The label states the outcome in words. Colour is never the only
              carrier of meaning, so this stays readable in monochrome and in
              high-contrast modes.

              The `data-testid` is the machine-readable half of that, and it is what
              CI asserts on. It used to grep the sentence "All checks passing"
              directly, which silently made that English string a wire contract:
              rewording this badge broke the docker job. The two testids are mutually
              exclusive, so the assertion needs no attribute ordering and the copy
              stays free to change. */}
          {allHealthy ? (
            <Badge variant="success" data-testid="status-overall-ok">
              All checks passing
            </Badge>
          ) : (
            <Badge variant="destructive" data-testid="status-overall-failed">
              One or more checks failing
            </Badge>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>How to read this page</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Each probe is executed by the server on every request. A failure means the API is
            unreachable from the web tier, not that any employee data is unavailable: the API is the
            only source of truth for business data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
