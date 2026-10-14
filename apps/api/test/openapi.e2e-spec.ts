import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';

/**
 * Guards the OpenAPI surface consumed by API clients.
 *
 * The document is generated from the running application, so the risk is not a wrong
 * spec but a *shrinking* one: a controller refactor that drops a path or a security
 * scheme would otherwise go unnoticed until a consumer broke. These assertions pin the
 * document's shape, not its exact contents, so legitimate additions stay frictionless.
 */
describe('OpenAPI surface (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, moduleFixture.get<AppConfiguration>(APP_CONFIG));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves a machine-readable document at the explorer path', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const document = response.body as {
      openapi?: string;
      info?: { title?: string; version?: string };
      paths?: Record<string, unknown>;
      components?: { securitySchemes?: Record<string, unknown> };
    };

    expect(document.openapi).toMatch(/^3\./);
    expect(document.info?.title).toBe('HRIS API');
    expect(document.info?.version).toBeTruthy();
    expect(document.paths).toBeDefined();
    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(20);
  });

  it('documents the versioned, prefixed routes consumers call', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const paths = Object.keys((response.body as { paths: Record<string, unknown> }).paths);

    // Spot-check one route from each representation: a versioned prefixed route, a
    // settings route, and the generic records surface. Health probes are deliberately
    // `@ApiExcludeEndpoint()` (they are public and enumerate nothing useful), so they
    // are asserted absent rather than present.
    expect(paths).toContain('/api/v1/auth/login');
    expect(paths).toContain('/api/v1/settings');
    expect(paths.some((path) => path.startsWith('/api/v1/records'))).toBe(true);
    expect(paths).not.toContain('/health/live');
  });

  it('documents both credential kinds', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    const schemes = (
      response.body as { components: { securitySchemes: Record<string, { type: string }> } }
    ).components.securitySchemes;

    expect(schemes['access-token']?.type).toBe('http');
    expect(schemes['api-key']?.type).toBe('apiKey');
  });

  it('is not served when Swagger is disabled', async () => {
    process.env['SWAGGER_ENABLED'] = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const disabled = moduleFixture.createNestApplication();

    configureApp(disabled, moduleFixture.get<AppConfiguration>(APP_CONFIG));
    await disabled.init();

    try {
      await request(disabled.getHttpServer()).get('/api/docs-json').expect(404);
    } finally {
      await disabled.close();
    }
  });
});
