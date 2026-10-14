import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { WEBAUTHN_ADAPTER, type WebAuthnAdapter } from '../src/modules/passkeys/webauthn.types';
import { provisionTenant } from './helpers/iam-fixtures';

const base64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * End-to-end coverage for passkeys.
 *
 * A real WebAuthn ceremony needs hardware (or a virtual authenticator) to sign a
 * challenge, so the relying-party adapter is replaced with deterministic fakes. That
 * still exercises everything the API owns: the single-use challenge in Redis, storing
 * the credential, listing it without leaking the public key, issuing the session on
 * assertion, the counter update and replay rejection.
 */
describe('Passkeys (e2e)', () => {
  let app: INestApplication;

  const email = `passkey-admin-${randomUUID().slice(0, 8)}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let adminToken = '';
  let lastVerifiedCounter = 0;

  const webauthnFake: WebAuthnAdapter = {
    generateRegistrationOptions: async () => ({
      challenge: 'reg-challenge-1',
      rp: { id: 'localhost' },
    }),
    verifyRegistration: async () => ({
      verified: true,
      registration: {
        credentialId: 'cred-1',
        publicKey: Buffer.from('cose-public-key').toString('base64url'),
        counter: 0,
        deviceType: 'singleDevice',
        transports: ['internal'],
      },
    }),
    generateAuthenticationOptions: async () => ({ challenge: 'auth-challenge-1' }),
    verifyAuthentication: async () => {
      lastVerifiedCounter += 1;
      return { verified: true, newCounter: lastVerifiedCounter };
    },
  };

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';
    process.env['WEBAUTHN_ENABLED'] = 'true';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WEBAUTHN_ADAPTER)
      .useValue(webauthnFake)
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

  it('refuses passkey sign-in when the account has none registered', async () => {
    await api().post('/api/v1/auth/passkeys/authentication/options').send({ email }).expect(401);
  });

  it('registers a passkey and lists it without exposing the public key', async () => {
    const options = await api()
      .post('/api/v1/passkeys/registration/options')
      .set(asAdmin())
      .expect(201);
    expect(options.body.data.challenge).toBe('reg-challenge-1');

    const created = await api()
      .post('/api/v1/passkeys/registration/verify')
      .set(asAdmin())
      .send({
        response: {
          id: 'cred-1',
          response: { clientDataJSON: base64url({ challenge: 'reg-challenge-1' }) },
        },
        deviceName: 'Work laptop',
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      deviceName: 'Work laptop',
      transports: ['internal'],
    });

    const list = await api().get('/api/v1/passkeys').set(asAdmin()).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ deviceName: 'Work laptop' });
    expect(JSON.stringify(list.body.data)).not.toContain('publicKey');
  });

  it('signs in with a passkey assertion and issues a session cookie', async () => {
    const options = await api()
      .post('/api/v1/auth/passkeys/authentication/options')
      .send({ email })
      .expect(200);
    expect(options.body.data.challenge).toBe('auth-challenge-1');

    const response = {
      id: 'cred-1',
      response: { clientDataJSON: base64url({ challenge: 'auth-challenge-1' }) },
    };
    const assertion = await api()
      .post('/api/v1/auth/passkeys/authentication/verify')
      .send({ response })
      .expect(200);
    const cookie = sessionCookie(assertion);
    expect(cookie).toContain('hris_session=');

    const me = await api().get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.data.user.email).toBe(email);

    await api().post('/api/v1/auth/passkeys/authentication/verify').send({ response }).expect(401);
  });

  it('deletes a passkey', async () => {
    const list = await api().get('/api/v1/passkeys').set(asAdmin()).expect(200);
    const passkeyId = list.body.data[0].id as string;

    await api().delete(`/api/v1/passkeys/${passkeyId}`).set(asAdmin()).expect(204);

    const after = await api().get('/api/v1/passkeys').set(asAdmin()).expect(200);
    expect(after.body.data).toEqual([]);
  });
});
