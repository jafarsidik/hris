import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';

/**
 * End-to-end coverage for the platform contracts that every business module
 * depends on: routing, versioning, the response envelope, validation behaviour,
 * security headers and health probes.
 *
 * The application is configured through the very same `configureApp` used by
 * `main.ts`, so these tests exercise production wiring rather than a
 * simplified stand-in.
 */
describe('Platform (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';

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

  describe('health probes', () => {
    it.each(['/health', '/health/live', '/health/ready'])(
      'serves %s without authentication or an API prefix',
      async (path) => {
        const response = await request(app.getHttpServer()).get(path).expect(200);
        expect(response.body).toBeDefined();
      },
    );

    it('reports liveness with service metadata', async () => {
      const response = await request(app.getHttpServer()).get('/health/live').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        service: 'hris-api',
        environment: 'test',
      });
      expect(typeof response.body.uptimeSeconds).toBe('number');
    });
  });

  describe('security headers', () => {
    it('sets hardened response headers', async () => {
      const response = await request(app.getHttpServer()).get('/health/live').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('correlation ids', () => {
    it('echoes a well-formed inbound correlation id', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .set('X-Correlation-Id', 'e2e-trace-1')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe('e2e-trace-1');
    });

    it('replaces an unsafe inbound correlation id', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .set('X-Correlation-Id', 'bad value with spaces')
        .expect(200);

      expect(response.headers['x-correlation-id']).not.toBe('bad value with spaces');
      expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('routing', () => {
    it('returns a JSON 404 envelope for an unknown versioned route', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: { code: 'NOT_FOUND' },
      });
    });

    it('does not expose unversioned business routes', async () => {
      // Confirms the prefix is active and no route is reachable outside it.
      await request(app.getHttpServer()).get('/employees').expect(404);
    });
  });

  describe('error contract', () => {
    it('always returns the standard error envelope', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);

      expect(response.body.success).toBe(false);
      expect(typeof response.body.error.message).toBe('string');
      expect(response.body.error.correlationId).toBeDefined();
      expect(response.body.error).not.toHaveProperty('stack');
    });
  });
});
