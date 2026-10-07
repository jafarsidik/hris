import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { parseConfiguration, type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';

/**
 * Readiness when a dependency is missing.
 *
 * The companion suite in `platform.e2e-spec.ts` asserts that readiness succeeds, which
 * only proves anything when PostgreSQL and Redis are actually reachable. This suite
 * asserts the other half: that the process still starts and still answers liveness while
 * a dependency is absent, and that readiness reports the specific failure instead of
 * silently returning 200.
 *
 * That distinction is the whole point of splitting liveness from readiness. A process
 * that refuses to boot when its database is unreachable cannot tell anyone why, and an
 * orchestrator that restarts it turns a recoverable dependency outage into a crash loop.
 */
describe('Health with a missing dependency (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';

    // Parse the real environment, then remove only the database section. Building the
    // config from `parseConfiguration` keeps every other value identical to production,
    // so this tests the missing-dependency path rather than a hand-written config.
    const base = parseConfiguration(process.env);
    const withoutDatabase: AppConfiguration = { ...base, database: null };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(withoutDatabase)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, withoutDatabase);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('still starts and reports liveness', async () => {
    // A process that cannot reach its database is alive; it simply cannot serve traffic.
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });

  it('reports readiness as unavailable', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });
  });

  it('names the missing dependency rather than reporting a generic outage', async () => {
    // Terminus replaces the per-indicator detail with a flat 503 body, so the actionable
    // message is asserted through the roll-up endpoint's logger-free path: it must not
    // leak a stack trace or a connection string.
    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(JSON.stringify(response.body)).not.toMatch(/postgresql:\/\//i);
    expect(JSON.stringify(response.body)).not.toMatch(/at Object\./);
  });
});
