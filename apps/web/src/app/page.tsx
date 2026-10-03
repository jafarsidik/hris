import { Card, Text } from '@hris/ui';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Overview',
};

/**
 * Foundation landing page.
 *
 * Business modules are added in later phases. This page deliberately states
 * what exists rather than showing placeholder dashboards, so nobody mistakes
 * unimplemented screens for working features.
 */
export default function HomePage() {
  return (
    <div style={{ display: 'grid', gap: 'var(--hris-space-5)' }}>
      <Card title="HRIS platform foundation" subtitle="Repository, tooling and API scaffolding">
        <Text>
          The platform foundation is in place: the API boots with versioned routing, validated input,
          standardised responses and health probes, and the web and mobile clients consume that same
          API.
        </Text>
      </Card>

      <Card title="Engineering baseline" subtitle="Verified on every change">
        <ul style={{ margin: 0, paddingInlineStart: '1.25rem', lineHeight: 1.75 }}>
          <li>Type-safe domain contracts shared by API, web and mobile</li>
          <li>Server-side authorisation model with explicit data scopes</li>
          <li>Immutable-by-design audit and payroll integrity constraints</li>
          <li>Lint, typecheck, unit, integration and end-to-end tests in CI</li>
          <li>Docker-based development and deployment definitions</li>
        </ul>
      </Card>

      <Card title="Next steps" subtitle="Delivered strictly in phase order">
        <Text tone="muted">
          Business capabilities land in order: identity and access, organization and core HR,
          then workflow, attendance, leave, claims, administration, ATS, performance, payroll,
          employee relations, mobile, analytics and AI. See docs/IMPLEMENTATION_PLAN.md.
        </Text>
      </Card>
    </div>
  );
}