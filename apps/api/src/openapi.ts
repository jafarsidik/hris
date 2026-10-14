import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import type { AppConfiguration } from './config/app-configuration';

/**
 * Builds the OpenAPI document that describes the public API surface.
 *
 * Extracted from `configureApp` so the served explorer and any consumer export are
 * generated from one definition. Generating it from the running Nest application means
 * the spec cannot describe a route that does not exist; the e2e suite re-reads the
 * served copy so a controller that loses its documentation is caught rather than
 * silently dropped.
 *
 * Two credentials are documented because the API accepts two kinds of caller: a
 * human session (opaque bearer token, from the `hris_session` cookie or the
 * `Authorization` header) and a developer API key (presented as `X-API-Key` or an
 * `Authorization: Bearer hris_ak_...`). Both are resolved server-side and neither
 * carries the caller's permissions.
 */
export function buildOpenApiDocument(
  app: INestApplication,
  config: AppConfiguration,
): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('HRIS API')
      .setDescription(
        [
          'Enterprise HRIS REST API.',
          '',
          'Every success response is wrapped in a standard envelope and every error is a',
          'typed error code; authorization for entity-sensitive resources is enforced',
          'server-side and cannot be widened from a client.',
        ].join('\n'),
      )
      .setVersion(config.http.defaultVersion)
      .addServer('/', 'Current host')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'opaque session token' },
        'access-token',
      )
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'api-key')
      .addTag('Health', 'Liveness and readiness probes. Public; never behind a session.')
      .addTag('Auth', 'Sign-in, sign-out, session and credential lifecycle.')
      .addTag('Access', 'Users, roles, permissions and grants.')
      .addTag('Registry', 'Applications, modules, resources, fields and actions.')
      .addTag('Records', 'Generic metadata-driven CRUD and custom actions.')
      .addTag('Settings', 'Tenant system settings, including encrypted secrets.')
      .addTag('Notifications', 'In-app notifications and delivery status.')
      .addTag('Queue', 'Background job queues and failed-job inspection.')
      .addTag('Integrations', 'Outbound integrations and delivery configuration.')
      .addTag('API clients', 'Developer API keys, their scopes and rate limits.')
      .build(),
  );
}
