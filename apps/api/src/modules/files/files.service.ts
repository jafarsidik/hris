import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { withTenantContext } from '@hris/database';
import type {
  FileDownloadTicket,
  FileObjectStatus,
  FileObjectSummary,
  FileUploadTicket,
} from '@hris/shared-types';

import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { LogService } from '../logs/log.service';
import { S3StorageService } from './s3-storage.service';

/** The caller attributes the files module records. */
export interface FileActor {
  readonly companyId: string;
  readonly userId: string;
}

/** Input for reserving an object. `size` is a hint; storage is authoritative. */
export interface CreateFileInput {
  readonly name: string;
  readonly mimeType: string;
  readonly size?: number;
  readonly entity?: string;
  readonly entityId?: string;
  readonly retentionDays?: number;
}

/** How long a deleted object (with no explicit policy) stays recoverable. */
export const DEFAULT_RETENTION_DAYS = 30;

/** Ceiling on a caller-supplied retention window (ten years). */
export const MAX_RETENTION_DAYS = 3650;

/** The columns the summary mapper reads. Kept structural so Prisma rows fit directly. */
interface FileRow {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: bigint | null;
  readonly status: FileObjectStatus;
  readonly checksum: string | null;
  readonly entity: string | null;
  readonly entityId: string | null;
  readonly retentionUntil: Date | null;
  readonly uploadedBy: string | null;
  readonly createdAt: Date;
  readonly removedAt: Date | null;
}

function toSummary(row: FileRow): FileObjectSummary {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    // Storage reports bytes as an integer, which JSON cannot carry as BigInt.
    size: row.size === null ? null : Number(row.size),
    status: row.status,
    checksum: row.checksum,
    entity: row.entity,
    entityId: row.entityId,
    retentionUntil: row.retentionUntil === null ? null : row.retentionUntil.toISOString(),
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    removedAt: row.removedAt === null ? null : row.removedAt.toISOString(),
  };
}

/**
 * Builds a storage key that is unique, tenant-scoped and path-safe.
 *
 * The company id leads so an operator can attribute an object without the database; the
 * UUID segment makes the key collision-proof even for two files with the same name; and
 * the human-readable tail is folded to ASCII so no signature ever depends on a filename's
 * original encoding.
 */
function storageKeyFor(companyId: string, name: string): string {
  const safe = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `${companyId}/${randomUUID()}/${safe.length === 0 ? 'file' : safe}`;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Files: metadata and authorisation over the S3-compatible object store.
 *
 * The bytes never pass through the API. A client asks to reserve an object, receives a
 * presigned `PUT`, and confirms; the API then verifies the object exists before marking
 * it AVAILABLE, so a record can never claim bytes that were never uploaded. Downloads are
 * presigned per request, so a leaked URL expires and a tenant boundary is re-checked on
 * every fetch rather than being baked into a stored link.
 */
@Injectable()
export class FilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(S3StorageService) private readonly storage: S3StorageService,
    @Inject(LogService) private readonly logs: LogService,
  ) {}

  /** Reserves an object and returns the presigned upload request for its bytes. */
  async create(actor: FileActor, input: CreateFileInput): Promise<FileUploadTicket> {
    const name = input.name.trim();
    const mimeType = input.mimeType.trim();
    const retentionDays = input.retentionDays;
    const storageKey = storageKeyFor(actor.companyId, name);
    const client = this.prisma.getClient();

    const created = await withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.fileObject.create({
        data: {
          companyId: actor.companyId,
          name,
          mimeType,
          size: input.size === undefined ? null : BigInt(input.size),
          storageKey,
          bucket: this.storage.bucket,
          status: 'PENDING',
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          retentionDays: retentionDays ?? null,
          retentionUntil: retentionDays === undefined ? null : addDays(new Date(), retentionDays),
          uploadedBy: actor.userId,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'file.create',
        resource: 'document',
        resourceId: row.id,
      });
      return row;
    });

    const upload = this.storage.presignUpload(created.storageKey);
    return {
      file: toSummary(created),
      uploadUrl: upload.url,
      method: 'PUT',
      headers: {},
      expiresAt: upload.expiresAt,
    };
  }

  /** Confirms an upload by checking storage, then marks the object AVAILABLE. */
  async complete(actor: FileActor, id: string): Promise<FileObjectSummary> {
    const existing = await this.requireRow(actor.companyId, id);
    if (existing.status === 'AVAILABLE') {
      return toSummary(existing);
    }
    if (existing.status === 'DELETED') {
      throw new ConflictError('The object has been deleted.');
    }

    const metadata = await this.storage.head(existing.storageKey);
    if (!metadata.exists) {
      throw new UnprocessableEntityError('The object was never uploaded.');
    }

    const client = this.prisma.getClient();
    const updated = await withTenantContext(client, actor.companyId, async (tx) => {
      const row = await tx.fileObject.update({
        where: { id },
        data: {
          status: 'AVAILABLE',
          size: metadata.size === null ? null : BigInt(metadata.size),
          checksum: metadata.etag,
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'file.complete',
        resource: 'document',
        resourceId: id,
        payload: { size: metadata.size },
      });
      return row;
    });

    return toSummary(updated);
  }

  /** Lists metadata, newest first, optionally narrowed to an owning record. */
  async list(
    companyId: string,
    filter: { entity?: string; entityId?: string; status?: FileObjectStatus } = {},
  ): Promise<readonly FileObjectSummary[]> {
    const client = this.prisma.getClient();
    return withTenantContext(client, companyId, async (tx) => {
      const rows = await tx.fileObject.findMany({
        where: {
          ...(filter.entity === undefined ? {} : { entity: filter.entity }),
          ...(filter.entityId === undefined ? {} : { entityId: filter.entityId }),
          status: filter.status ?? { not: 'DELETED' },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return rows.map(toSummary);
    });
  }

  async get(companyId: string, id: string): Promise<FileObjectSummary> {
    return toSummary(await this.requireRow(companyId, id));
  }

  /** A short-lived URL the browser may download the object's bytes from. */
  async download(actor: FileActor, id: string): Promise<FileDownloadTicket> {
    const row = await this.requireRow(actor.companyId, id);
    if (row.status !== 'AVAILABLE') {
      throw new ConflictError('The object has not been uploaded.');
    }
    const presigned = this.storage.presignDownload(row.storageKey, {
      filename: row.name,
      contentType: row.mimeType,
    });
    await this.logs.writeAudit(actor.companyId, {
      actorUserId: actor.userId,
      action: 'file.download',
      resource: 'document',
      resourceId: id,
    });
    return {
      file: toSummary(row),
      downloadUrl: presigned.url,
      expiresAt: presigned.expiresAt,
    };
  }

  /**
   * Soft-deletes an object and removes its bytes immediately.
   *
   * The row survives its retention window so an accidental delete is visible and its
   * metadata auditable; the bytes are gone at once, because keeping them after a user
   * asked for deletion is the failure that matters most.
   */
  async remove(actor: FileActor, id: string): Promise<void> {
    const row = await this.requireRow(actor.companyId, id);
    if (row.status === 'DELETED') {
      return;
    }
    await this.storage.remove(row.storageKey);

    const client = this.prisma.getClient();
    const now = new Date();
    const retentionDays = row.retentionDays ?? DEFAULT_RETENTION_DAYS;
    await withTenantContext(client, actor.companyId, async (tx) => {
      await tx.fileObject.update({
        where: { id },
        data: {
          status: 'DELETED',
          removedAt: now,
          retentionUntil: addDays(now, retentionDays),
        },
      });
      await this.logs.writeAudit(actor.companyId, {
        actorUserId: actor.userId,
        action: 'file.delete',
        resource: 'document',
        resourceId: id,
      });
    });
  }

  /**
   * Purges objects whose retention window has closed.
   *
   * Called by the scheduled retention sweep. Each object is removed from storage before
   * its row is deleted, so a crash mid-sweep leaves a row pointing at a missing object
   * (which the next sweep finishes) rather than bytes nothing references.
   */
  async purgeExpired(companyId: string, now: Date = new Date()): Promise<number> {
    const client = this.prisma.getClient();
    const expired = await withTenantContext(client, companyId, async (tx) =>
      tx.fileObject.findMany({
        where: { retentionUntil: { lt: now } },
        select: { id: true, storageKey: true },
      }),
    );

    let purged = 0;
    for (const row of expired) {
      await this.storage.remove(row.storageKey);
      await withTenantContext(client, companyId, (tx) =>
        tx.fileObject.delete({ where: { id: row.id } }),
      );
      purged += 1;
    }
    return purged;
  }

  /** Loads a row or throws, so every caller gets the same 404 wording. */
  private async requireRow(
    companyId: string,
    id: string,
  ): Promise<FileRow & { storageKey: string; retentionDays: number | null }> {
    const client = this.prisma.getClient();
    const row = await withTenantContext(client, companyId, (tx) =>
      tx.fileObject.findFirst({ where: { id } }),
    );
    if (row === null) {
      throw new NotFoundError('The file does not exist.');
    }
    return row;
  }
}
