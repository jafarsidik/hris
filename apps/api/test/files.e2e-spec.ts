import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { withTenantContext } from '@hris/database';

import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/common/auth/password.service';
import { type AppConfiguration } from '../src/config/app-configuration';
import { APP_CONFIG } from '../src/config/app-configuration.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/modules/database/prisma.service';
import { FilesService } from '../src/modules/files/files.service';
import { provisionTenant } from './helpers/iam-fixtures';

/** A file row as served by `GET /files`, narrowed to what these tests assert. */
interface FileRow {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number | null;
  readonly status: string;
  readonly checksum: string | null;
}

interface UploadTicket {
  readonly file: FileRow;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}

describe('Files (object storage)', () => {
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = `files-admin-${suffix}@acme.test`;
  const outsiderEmail = `files-outsider-${suffix}@acme.test`;
  const password = 'Str0ng-Passw0rd!';

  let app: INestApplication;
  let companyId: string;
  let adminToken: string;
  let outsiderToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SWAGGER_ENABLED = 'false';
    process.env.AUTH_LOGIN_RATE_LIMIT_PER_MINUTE = '1000';
    // Pinned so the presigned URLs the suite follows are signed for the RustFS instance
    // the local compose stack is running, regardless of how `.env` is loaded.
    process.env.STORAGE_ENDPOINT = 'http://localhost:9000';
    process.env.STORAGE_PUBLIC_ENDPOINT = 'http://localhost:9000';
    process.env.STORAGE_BUCKET = 'hris-documents';
    process.env.STORAGE_ACCESS_KEY = 'HRISDEVACCESSKEY';
    process.env.STORAGE_SECRET_KEY = 'hris_dev_storage_secret_0123456789';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, moduleRef.get<AppConfiguration>(APP_CONFIG));
    await app.init();

    const tenant = await provisionTenant(app, { adminEmail, adminPassword: password });
    companyId = tenant.companyId;

    const prisma = app.get(PrismaService);
    const passwordHash = await app.get(PasswordService).hashPassword(password);
    await withTenantContext(prisma.getClient(), companyId, async (tx) => {
      // A signed-in user with no roles, so no `document:*` permission.
      await tx.user.create({
        data: {
          id: randomUUID(),
          companyId,
          email: outsiderEmail,
          displayName: 'E2E Outsider',
          status: 'ACTIVE',
          passwordHash,
          hasVerifiedEmail: true,
        },
      });
    });

    adminToken = await login(adminEmail);
    outsiderToken = await login(outsiderEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.token as string;
  }

  /** Reserves, uploads and confirms an object, returning the AVAILABLE row. */
  async function upload(name: string, mimeType: string, body: string): Promise<FileRow> {
    const reserved = await api()
      .post('/api/v1/files')
      .set(asAdmin())
      .send({ name, mimeType, size: Buffer.byteLength(body) })
      .expect(201);
    const ticket = reserved.body.data as UploadTicket;

    const stored = await fetch(ticket.uploadUrl, { method: 'PUT', body });
    expect(stored.status).toBe(200);

    const completed = await api()
      .post(`/api/v1/files/${ticket.file.id}/complete`)
      .set(asAdmin())
      .expect(200);
    return completed.body.data as FileRow;
  }

  it('round-trips bytes through presigned URLs', async () => {
    const body = 'hello hris files';
    const file = await upload('greeting.txt', 'text/plain', body);

    expect(file.status).toBe('AVAILABLE');
    expect(file.size).toBe(Buffer.byteLength(body));
    expect(file.checksum).not.toBeNull();

    const ticket = await api().get(`/api/v1/files/${file.id}/download`).set(asAdmin()).expect(200);

    const fetched = await fetch(ticket.body.data.downloadUrl as string);
    expect(fetched.status).toBe(200);
    expect(await fetched.text()).toBe('hello hris files');
  });

  it('lists, then hides a soft-deleted object from the default view', async () => {
    const body = 'to be deleted';
    const file = await upload('delete-me.txt', 'text/plain', body);

    const listed = await api().get('/api/v1/files').set(asAdmin()).expect(200);
    expect((listed.body.data as FileRow[]).map((row) => row.id)).toContain(file.id);

    await api().delete(`/api/v1/files/${file.id}`).set(asAdmin()).expect(204);

    const afterDelete = await api().get('/api/v1/files').set(asAdmin()).expect(200);
    expect((afterDelete.body.data as FileRow[]).map((row) => row.id)).not.toContain(file.id);

    // The row survives so the deletion stays auditable; it is only absent from the
    // default view because the default view excludes DELETED.
    const deleted = await api().get('/api/v1/files?status=DELETED').set(asAdmin()).expect(200);
    expect(deleted.body.data as FileRow[]).toContainEqual(
      expect.objectContaining({ id: file.id, status: 'DELETED' }),
    );
  });

  it('refuses metadata and reservations without the document permissions', async () => {
    await api()
      .get('/api/v1/files')
      .set({ Authorization: `Bearer ${outsiderToken}` })
      .expect(403);
    await api()
      .post('/api/v1/files')
      .set({ Authorization: `Bearer ${outsiderToken}` })
      .send({ name: 'x.txt', mimeType: 'text/plain' })
      .expect(403);
  });

  it('refuses to confirm a reservation whose bytes never arrived', async () => {
    const reserved = await api()
      .post('/api/v1/files')
      .set(asAdmin())
      .send({ name: 'never.txt', mimeType: 'text/plain', retentionDays: 1 })
      .expect(201);
    const ticket = reserved.body.data as UploadTicket;

    await api().post(`/api/v1/files/${ticket.file.id}/complete`).set(asAdmin()).expect(422);

    // The row stays PENDING rather than being promoted to AVAILABLE by a failed confirm.
    const listed = await api().get('/api/v1/files').set(asAdmin()).expect(200);
    expect((listed.body.data as FileRow[]).find((row) => row.id === ticket.file.id)?.status).toBe(
      'PENDING',
    );
  });

  it('purges an object once its retention window has passed', async () => {
    const file = await upload('expiring.txt', 'text/plain', 'expiring');

    const prisma = app.get(PrismaService);
    const client = prisma.getClient();
    // Pull the window into the past so the sweep has something to act on.
    await withTenantContext(client, companyId, (tx) =>
      tx.fileObject.update({
        where: { id: file.id },
        data: { retentionUntil: new Date(Date.now() - 1_000) },
      }),
    );

    const purged = await app.get(FilesService).purgeExpired(companyId);
    expect(purged).toBeGreaterThanOrEqual(1);

    const after = await api().get('/api/v1/files').set(asAdmin()).expect(200);
    expect((after.body.data as FileRow[]).some((row) => row.id === file.id)).toBe(false);
  });
});
