import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import type { SsoAssertedIdentity } from '@hris/shared-types';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { SSO_OIDC_CLIENT, SSO_SAML_CLIENT } from '../src/modules/sso/sso.types';
import type { SsoOidcClient, SsoSamlClient } from '../src/modules/sso/sso.types';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for the SSO sign-in flow.
 *
 * The protocol clients are replaced with deterministic fakes: `openid-client` would
 * perform network discovery and `samlify` would require a signed assertion, neither
 * of which belongs in a test. The fakes return the asserted identity directly, which
 * exercises everything the API owns: provider storage/encryption, the single-use
 * state, identity linking by verified email, and session establishment.
 */
describe('SSO (e2e)', () => {
  let app: INestApplication;

  const email = `sso-admin-${randomUUID().slice(0, 8)}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let adminToken = '';
  let oidcIdentity: SsoAssertedIdentity = { subject: 'sub', email: null, emailVerified: true };
  let samlIdentity: SsoAssertedIdentity = { subject: 'sub', email: null, emailVerified: true };

  const oidcFake: SsoOidcClient = {
    buildAuthorizationUrl: async (_config, req) =>
      `https://idp.example/authorize?state=${req.state}&nonce=${req.nonce}`,
    exchangeCode: async () => oidcIdentity,
  };

  const samlFake: SsoSamlClient = {
    buildLoginUrl: (_config, req) => `https://idp.example/sso?RelayState=${req.relayState}`,
    parseResponse: async () => samlIdentity,
  };

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';
    process.env['SSO_ENCRYPTION_KEY'] = 'e2e-sso-key';
    process.env['API_PUBLIC_URL'] = 'http://localhost:3001';
    process.env['WEB_APP_URL'] = 'http://localhost:3000';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SSO_OIDC_CLIENT)
      .useValue(oidcFake)
      .overrideProvider(SSO_SAML_CLIENT)
      .useValue(samlFake)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    await provisionTenant(app, { adminEmail: email, adminPassword: password });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    adminToken = login.body.data.token as string;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  function sessionCookie(response: { headers: Record<string, unknown> }): string {
    const raw = response.headers['set-cookie'];
    const value = Array.isArray(raw) ? raw[0] : undefined;
    if (typeof value !== 'string') {
      throw new Error('Expected the response to set a session cookie.');
    }
    return value.split(';')[0] ?? '';
  }

  async function createOidcProvider(): Promise<string> {
    const response = await api()
      .post('/api/v1/identity-providers')
      .set(asAdmin())
      .send({
        name: 'Acme OIDC',
        type: 'OIDC',
        domains: ['ACME.test'],
        oidc: {
          issuer: 'https://idp.example',
          clientId: 'client-1',
          clientSecret: 'super-secret',
          scopes: ['openid', 'email'],
        },
      })
      .expect(201);
    return response.body.data.id as string;
  }

  it('creates an OIDC provider without echoing the client secret', async () => {
    const providerId = await createOidcProvider();

    const list = await api().get('/api/v1/identity-providers').set(asAdmin()).expect(200);
    const provider = list.body.data.find((row: { id: string }) => row.id === providerId);
    expect(provider).toMatchObject({
      name: 'Acme OIDC',
      type: 'OIDC',
      hasClientSecret: true,
      domains: ['acme.test'],
    });
    expect(JSON.stringify(provider)).not.toContain('super-secret');
  });

  it('discovers providers by email domain without authentication', async () => {
    const providerId = await createOidcProvider();
    const response = await api()
      .get('/api/v1/auth/sso/providers')
      .query({ email: 'someone@acme.test' })
      .expect(200);
    const ids = response.body.data.map((row: { id: string }) => row.id);
    expect(ids).toContain(providerId);

    const other = await api()
      .get('/api/v1/auth/sso/providers')
      .query({ email: 'someone@nowhere.test' })
      .expect(200);
    expect(other.body.data).toEqual([]);
  });

  it('logs in through OIDC and issues a session cookie', async () => {
    const providerId = await createOidcProvider();
    oidcIdentity = { subject: 'oidc-subject-1', email, emailVerified: true };

    const start = await api().get(`/api/v1/auth/sso/${providerId}/start`).expect(200);
    expect(start.body.data.authorizationUrl).toContain('https://idp.example/authorize');
    const state = start.body.data.state as string;

    const callback = await api()
      .get(`/api/v1/auth/sso/${providerId}/callback`)
      .query({ code: 'auth-code', state })
      .expect(302);
    expect(callback.headers['location']).toBe('http://localhost:3000/login?sso=success');
    const cookie = sessionCookie(callback);
    expect(cookie).toContain('hris_session=');

    const me = await api().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.data.user.email).toBe(email);
  });

  it('rejects a replayed or unknown state', async () => {
    const providerId = await createOidcProvider();
    oidcIdentity = { subject: 'oidc-subject-2', email, emailVerified: true };

    const start = await api().get(`/api/v1/auth/sso/${providerId}/start`).expect(200);
    const state = start.body.data.state as string;

    await api()
      .get(`/api/v1/auth/sso/${providerId}/callback`)
      .query({ code: 'auth-code', state })
      .expect(302);

    await api()
      .get(`/api/v1/auth/sso/${providerId}/callback`)
      .query({ code: 'auth-code', state })
      .expect(401);

    await api()
      .get(`/api/v1/auth/sso/${providerId}/callback`)
      .query({ code: 'auth-code', state: randomUUID() })
      .expect(401);
  });

  it('fails closed when no local account matches the asserted email', async () => {
    const providerId = await createOidcProvider();
    oidcIdentity = { subject: 'stranger', email: 'stranger@acme.test', emailVerified: true };

    const start = await api().get(`/api/v1/auth/sso/${providerId}/start`).expect(200);
    await api()
      .get(`/api/v1/auth/sso/${providerId}/callback`)
      .query({ code: 'auth-code', state: start.body.data.state })
      .expect(401);
  });

  it('logs in through SAML via the POST assertion consumer service', async () => {
    const created = await api()
      .post('/api/v1/identity-providers')
      .set(asAdmin())
      .send({
        name: 'Acme SAML',
        type: 'SAML',
        domains: ['acme.test'],
        saml: {
          entryPoint: 'https://idp.example/sso',
          issuer: 'https://api.example/sp',
          idpCert: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
        },
      })
      .expect(201);
    const providerId = created.body.data.id as string;

    samlIdentity = { subject: 'saml-subject-1', email, emailVerified: true };

    const start = await api().get(`/api/v1/auth/sso/${providerId}/start`).expect(200);
    const relayState = start.body.data.state as string;

    const callback = await api()
      .post(`/api/v1/auth/sso/${providerId}/callback`)
      .type('form')
      .send({ SAMLResponse: 'base64-assertion', RelayState: relayState })
      .expect(302);
    expect(callback.headers['location']).toBe('http://localhost:3000/login?sso=success');
    const cookie = sessionCookie(callback);

    const me = await api().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.data.user.email).toBe(email);
  });
});
