import { Badge, Card, Text } from '@hris/ui';
import type { Metadata } from 'next';

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
    <div style={{ display: 'grid', gap: 'var(--hris-space-5)' }}>
      <Card
        title="Platform status"
        subtitle="Live probe results from the HRIS API"
        footer={
          allHealthy ? (
            <Badge tone="success">All checks passing</Badge>
          ) : (
            <Badge tone="danger">One or more checks failing</Badge>
          )
        }
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
          {outcomes.map((outcome) => (
            <li
              key={outcome.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--hris-space-4)',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 500 }}>{outcome.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--hris-space-2)' }}>
                <Text tone={outcome.healthy ? 'success' : 'danger'}>{outcome.detail}</Text>
                <Badge tone={outcome.healthy ? 'success' : 'danger'}>
                  {outcome.healthy ? 'Healthy' : 'Unavailable'}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="How to read this page">
        <Text tone="muted">
          Each probe is executed by the server on every request. A failure means the API is
          unreachable from the web tier, not that any employee data is unavailable: the API is the
          only source of truth for business data.
        </Text>
      </Card>
    </div>
  );
}
