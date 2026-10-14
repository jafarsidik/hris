import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { totp } from '../src/common/crypto/totp';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { provisionTenant } from './helpers/iam-fixtures';

/**
 * End-to-end coverage for multi-factor authentication.
 *
 * Exercises the whole loop against the real Redis session/challenge store and the real
 * PostgreSQL: enroll -> confirm, the sign-in challenge, a recovery code, and disable.
 * TOTP codes are produced with the same helper the server verifies against, so the test
 * fails if either side drifts.
 */
describe('MFA (e2e)', () => {
  let app: INestApplication;

  const email = `mfa-${randomUUID().slice(0, 8)}@hris.test`;
  const password = 'Str0ng-Passw0rd!';

  let token = '';
  let factorId = '';
  let secret = '';
  let recoveryCodes: string[] = [];

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['SWAGGER_ENABLED'] = 'false';
    process.env['AUTH_LOGIN_RATE_LIMIT_PER_MINUTE'] = '1000';
    process.env['AUTH_MFA_ENCRYPTION_KEY'] = Buffer.from('e2e-mfa-key-'.padEnd(32, 'x')).toString(
      'base64',
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    await provisionTenant(app, { adminEmail: email, adminPassword: password });
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function login(): Promise<{
    mfaRequired: boolean;
    token?: string;
    challengeToken?: string;
  }> {
    const response = await api().post('/api/v1/auth/login').send({ email, password }).expect(200);
    return response.body.data as { mfaRequired: boolean; token?: string; challengeToken?: string };
  }

  it('reports MFA as not enrolled for a fresh account', async () => {
    const result = await login();
    expect(result.mfaRequired).toBe(false);
    token = result.token ?? '';

    const mfaStatus = await api()
      .get('/api/v1/mfa/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(mfaStatus.body.data).toMatchObject({ enrolled: false, recoveryCodesRemaining: 0 });
  });

  it('enrolls a TOTP factor and returns one-time recovery codes', async () => {
    const enroll = await api()
      .post('/api/v1/mfa/enroll')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(enroll.body.data.otpauthUrl).toContain('otpauth://totp/');
    expect(enroll.body.data.qrDataUrl).toContain('data:image/');
    factorId = enroll.body.data.factorId as string;
    secret = enroll.body.data.secret as string;

    const confirm = await api()
      .post(`/api/v1/mfa/enroll/${factorId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: totp(secret) })
      .expect(201);
    recoveryCodes = confirm.body.data.codes as string[];
    expect(recoveryCodes).toHaveLength(10);
  });

  it('requires the second factor on the next sign-in', async () => {
    const result = await login();
    expect(result.mfaRequired).toBe(true);
    expect(result.token).toBeUndefined();
    expect(result.challengeToken).toBeTruthy();
  });

  it('completes sign-in with a valid TOTP code', async () => {
    const challenge = await login();
    const verify = await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.challengeToken, code: totp(secret) })
      .expect(200);
    expect(verify.body.data.token).toBeTruthy();
    expect(verify.body.data.session.user.email).toBe(email);
    token = verify.body.data.token as string;
  });

  it('accepts a recovery code once and consumes it', async () => {
    const challenge = await login();
    const verify = await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.challengeToken, code: recoveryCodes[0] })
      .expect(200);
    expect(verify.body.data.token).toBeTruthy();

    const replay = await login();
    await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: replay.challengeToken, code: recoveryCodes[0] })
      .expect(401);
  });

  it('rejects a wrong code and consumes the challenge', async () => {
    const challenge = await login();
    await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.challengeToken, code: '000000' })
      .expect(401);

    await api()
      .post('/api/v1/auth/mfa/verify')
      .send({ challengeToken: challenge.challengeToken, code: totp(secret) })
      .expect(401);
  });

  it('disables MFA and lets sign-in proceed without a factor', async () => {
    await api().post('/api/v1/mfa/disable').set('Authorization', `Bearer ${token}`).expect(201);

    const result = await login();
    expect(result.mfaRequired).toBe(false);
    expect(result.token).toBeTruthy();
  });
});
