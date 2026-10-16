import type { Metadata } from 'next';

import { PageBody } from '@/components/layout/page-body';
import { PageHeader } from '@/components/layout/page-header';
import { Section } from '@/components/layout/section';
import { buttonVariants } from '@/components/ui/button';
import { CLIENT_API_PLATFORM_URL } from '@/lib/api/client-config';

export const metadata: Metadata = { title: 'API Documentation' };

const docsUrl = `${CLIENT_API_PLATFORM_URL}/api/docs`;
const specUrl = `${CLIENT_API_PLATFORM_URL}/api/docs-json`;

/**
 * The published developer reference.
 *
 * The OpenAPI document is generated from the running API, so this page links to the served
 * copy rather than restating it. Swagger is disabled outside development
 * (`SWAGGER_ENABLED`), in which case the links 404 at the API — noted on the page so the
 * reader knows why rather than assuming the platform is broken.
 */
export default function ApiDocsPage() {
  return (
    <PageBody>
      <PageHeader
        title="API Documentation"
        description="The OpenAPI reference for the platform's public REST API, generated from the running services."
        actions={
          <a href={docsUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
            Open interactive reference
          </a>
        }
      />

      <Section title="Base URL" bodyClassName="flex flex-col gap-3">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          {CLIENT_API_PLATFORM_URL}
        </pre>
        <p className="text-sm text-muted-foreground">
          Versioned business endpoints live under <code>/api/v1</code>. Present an API key as
          <code> X-API-Key</code> or as <code>Authorization: Bearer hris_ak_…</code>; a browser
          session instead carries the <code>hris_session</code> cookie.
        </p>
      </Section>

      <Section title="Reference" bodyClassName="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          The interactive reference renders every documented route and both credential schemes. The
          raw document can be imported into Postman, Insomnia or a client generator.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {docsUrl}
          </a>
          <a
            href={specUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            OpenAPI JSON
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          The explorer is served only when <code>SWAGGER_ENABLED</code> is on (on by default outside
          production). If these links return 404, the explorer is disabled on this environment.
        </p>
      </Section>

      <Section title="Example" bodyClassName="flex flex-col gap-3">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          {`curl -H "X-API-Key: hris_ak_<clientId>.<secret>" \\\n  ${CLIENT_API_PLATFORM_URL}/api/v1/users`}
        </pre>
      </Section>
    </PageBody>
  );
}
