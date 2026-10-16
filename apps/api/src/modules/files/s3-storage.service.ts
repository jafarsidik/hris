import { createHash, createHmac } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ServiceUnavailableError } from '../../common/errors/app-error';
import { APP_CONFIG } from '../../config/app-configuration.module';
import type { AppConfiguration, StorageConfig } from '../../config/app-configuration';

/** A presigned request: the URL to call and when it stops working. */
export interface PresignedRequest {
  readonly url: string;
  readonly expiresAt: string;
}

/** The subset of an object's metadata the platform persists. */
export interface StoredObjectMetadata {
  readonly exists: boolean;
  readonly size: number | null;
  readonly contentType: string | null;
  readonly etag: string | null;
}

const EMPTY_PAYLOAD_SHA256 = createHash('sha256').update('').digest('hex');

/**
 * RFC 3986 encoding, as AWS SigV4 requires.
 *
 * `encodeURIComponent` already percent-encodes UTF-8 correctly but leaves a few
 * sub-delimiters (`!'()*`) untouched, which SigV4 does not allow. Slashes stay literal in
 * paths and are encoded in query values, which is the one place the two differ.
 */
function uriEncode(value: string, encodeSlash: boolean): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return encodeSlash ? encoded : encoded.replace(/%2F/gi, '/');
}

/** `20261016T123456Z` and `20261016` for the same instant. */
function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const compact = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: compact, dateStamp: compact.slice(0, 8) };
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * A minimal S3 client: presigning for the browser, and signed HEAD/DELETE for the server.
 *
 * The platform ships no AWS SDK on purpose. It needs four operations against one bucket,
 * and SigV4 over `node:crypto` is a few dozen lines that never drift with a dependency's
 * major version; the alternative is a large transitive tree for a PUT, a GET, a HEAD and
 * a DELETE.
 *
 * Addressing is path-style (`/bucket/key`), which RustFS and MinIO expect.
 */
@Injectable()
export class S3StorageService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfiguration) {}

  /** The configured bucket, or a 503 when object storage is not configured. */
  private storage(): StorageConfig {
    const storage = this.config.storage;
    if (storage === null) {
      throw new ServiceUnavailableError('Object storage is not configured.');
    }
    return storage;
  }

  get bucket(): string {
    return this.storage().bucket;
  }

  /**
   * A URL the browser may `PUT` the object's bytes to.
   *
   * Only `host` is signed, so the client sends no header whose exact value the signature
   * depends on; the content type is made authoritative on download instead (see
   * {@link presignDownload}), where a wrong guess cannot break the upload.
   */
  presignUpload(key: string, ttlSeconds?: number): { url: string; expiresAt: string } {
    return this.presign('PUT', key, {}, this.ttl(ttlSeconds));
  }

  /**
   * A URL the browser may `GET` the object's bytes from.
   *
   * The response override parameters are signed with the rest of the query, so a browser
   * cannot rename a download without invalidating the URL, and the stored name and MIME
   * type win even when storage recorded a generic content type.
   */
  presignDownload(
    key: string,
    options: { filename?: string; contentType?: string; ttlSeconds?: number } = {},
  ): { url: string; expiresAt: string } {
    const overrides: Record<string, string> = {};
    if (options.contentType !== undefined) {
      overrides['response-content-type'] = options.contentType;
    }
    if (options.filename !== undefined) {
      overrides['response-content-disposition'] =
        `attachment; filename="${options.filename.replace(/["\\\r\n]/g, '_')}"`;
    }
    return this.presign('GET', key, overrides, this.ttl(options.ttlSeconds));
  }

  /** Whether the object landed, and what storage recorded about it. */
  async head(key: string): Promise<StoredObjectMetadata> {
    const response = await this.signedRequest('HEAD', key);
    if (response.status === 404) {
      return { exists: false, size: null, contentType: null, etag: null };
    }
    if (!response.ok) {
      throw new ServiceUnavailableError(
        `Object storage rejected the request (HTTP ${response.status}).`,
      );
    }
    const contentLength = response.headers.get('content-length');
    const etag = response.headers.get('etag');
    return {
      exists: true,
      size: contentLength === null ? null : Number.parseInt(contentLength, 10),
      contentType: response.headers.get('content-type'),
      etag: etag === null ? null : etag.replace(/"/g, ''),
    };
  }

  /**
   * Permanently removes an object.
   *
   * S3 `DELETE` is idempotent and answers 204 whether or not the key existed, so a retry
   * after a partial failure is safe; any other status is a real storage problem.
   */
  async remove(key: string): Promise<void> {
    const response = await this.signedRequest('DELETE', key);
    if (!response.ok && response.status !== 404) {
      throw new ServiceUnavailableError(
        `Object storage rejected the delete (HTTP ${response.status}).`,
      );
    }
  }

  private ttl(override?: number): number {
    return override ?? this.storage().signedUrlTtlSeconds;
  }

  /** `/bucket/key` in the encoding SigV4 requires for a path. */
  private canonicalUri(storage: StorageConfig, key: string): string {
    return `/${uriEncode(storage.bucket, true)}/${uriEncode(key, false)}`;
  }

  /** The `AWS4-HMAC-SHA256` signing key for the current date and region. */
  private signingKey(storage: StorageConfig, dateStamp: string): Buffer {
    return hmac(
      hmac(hmac(hmac(`AWS4${storage.secretKey}`, dateStamp), storage.region), 's3'),
      'aws4_request',
    );
  }

  /** The Authorization header for a bodyless HEAD/DELETE request. */
  private async signedRequest(method: 'HEAD' | 'DELETE', key: string): Promise<Response> {
    const storage = this.storage();
    const uri = this.canonicalUri(storage, key);
    const now = new Date();
    const { amzDate, dateStamp } = amzDates(now);
    const host = new URL(storage.endpoint).host;
    const scope = `${dateStamp}/${storage.region}/s3/aws4_request`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${EMPTY_PAYLOAD_SHA256}\n` +
      `x-amz-date:${amzDate}\n`;
    const canonicalRequest = [
      method,
      uri,
      '',
      canonicalHeaders,
      signedHeaders,
      EMPTY_PAYLOAD_SHA256,
    ].join('\n');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
    const signature = hmac(this.signingKey(storage, dateStamp), stringToSign).toString('hex');

    // `host` is intentionally not set here: the runtime derives it from the URL, and
    // signing it produces the same value, so sending it again would only risk a mismatch.
    return fetch(`${storage.endpoint}${uri}`, {
      method,
      headers: {
        'x-amz-content-sha256': EMPTY_PAYLOAD_SHA256,
        'x-amz-date': amzDate,
        authorization: `AWS4-HMAC-SHA256 Credential=${storage.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    });
  }

  /** Builds a presigned URL. `overrides` are extra signed query parameters. */
  private presign(
    method: 'GET' | 'PUT',
    key: string,
    overrides: Readonly<Record<string, string>>,
    ttlSeconds: number,
  ): { url: string; expiresAt: string } {
    const storage = this.storage();
    const now = new Date();
    const { amzDate, dateStamp } = amzDates(now);
    const scope = `${dateStamp}/${storage.region}/s3/aws4_request`;
    const uri = this.canonicalUri(storage, key);

    const query: ReadonlyArray<readonly [string, string]> = [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${storage.accessKey}/${scope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(ttlSeconds)],
      ['X-Amz-SignedHeaders', 'host'],
      ...Object.entries(overrides).map(([name, value]) => [name, value] as const),
    ];
    const canonicalQuery = [...query]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([name, value]) => `${uriEncode(name, true)}=${uriEncode(value, true)}`)
      .join('&');

    const host = new URL(storage.publicEndpoint).host;
    const canonicalRequest = [
      method,
      uri,
      canonicalQuery,
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256Hex(canonicalRequest)}`;
    const signature = hmac(this.signingKey(storage, dateStamp), stringToSign).toString('hex');
    return {
      url: `${storage.publicEndpoint}${uri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };
  }
}
