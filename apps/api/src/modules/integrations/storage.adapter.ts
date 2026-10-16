import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration } from '../../config/app-configuration';
import { S3StorageService } from '../files/s3-storage.service';

/** One-byte smoke payload; the probe only proves the store will accept a write. */
const PROBE_BYTES = new Uint8Array([1]);

/**
 * Object storage adapter (RustFS/S3).
 *
 * A reserve-upload-confirm round trip through the same S3 client the files module
 * uses: presign a PUT for a throwaway key, upload one byte, HEAD to confirm, and
 * remove it. A reachability check alone would say a bucket is fine when the real
 * problem is write permission, which is the part that actually fails on a misconfigured
 * relay.
 */
@Injectable()
export class StorageAdapter {
  readonly kind = 'STORAGE' as const;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const storage = this.config.storage;
    if (storage === null) {
      return {
        ok: false,
        message:
          'Object storage is not configured (STORAGE_ENDPOINT / STORAGE_ACCESS_KEY missing).',
      };
    }

    const client = new S3StorageService(this.config);
    const bucket = client.bucket;
    const probeKey = `${storage.endpoint.includes('localhost') ? 'probe' : 'probe'}/${randomUUID()}`;
    const { url } = client.presignUpload(probeKey);

    const startedAt = Date.now();
    let uploaded = false;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        body: PROBE_BYTES,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return {
          ok: false,
          message: `The upload probe was rejected with HTTP ${response.status}.`,
        };
      }
      uploaded = true;
      const head = await client.head(probeKey);
      if (!head.exists) {
        return { ok: false, message: 'The uploaded probe was not readable after the PUT.' };
      }
      return {
        ok: true,
        message: `Object storage is reachable (bucket "${bucket}", ${Date.now() - startedAt}ms).`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `The object store could not be reached: ${message}` };
    } finally {
      if (uploaded) {
        await client.remove(probeKey).catch(() => undefined);
      }
    }
  }
}
