/**
 * Files vocabulary shared by the API and the web tier.
 *
 * The storage location is deliberately absent from every read model: a client learns
 * where an object *is* only through a short-lived presigned URL, never through a path it
 * could keep and reuse. `storageKey` and `bucket` therefore never cross the HTTP
 * boundary.
 */

export const FILE_OBJECT_STATUSES = ['PENDING', 'AVAILABLE', 'DELETED'] as const;

export type FileObjectStatus = (typeof FILE_OBJECT_STATUSES)[number];

/** The owning record a file may be attached to (e.g. an employee or a claim). */
export interface FileEntityRef {
  readonly entity: string;
  readonly entityId: string;
}

/** A stored object as the API returns it. */
export interface FileObjectSummary {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number | null;
  readonly status: FileObjectStatus;
  readonly checksum: string | null;
  readonly entity: string | null;
  readonly entityId: string | null;
  readonly retentionUntil: string | null;
  readonly uploadedBy: string | null;
  readonly createdAt: string;
  readonly removedAt: string | null;
}

/**
 * A freshly reserved object plus the presigned request that uploads its bytes.
 *
 * The browser `PUT`s directly to the storage endpoint, so the API never proxies the
 * payload. `headers` carries the signed content-type the storage service will require.
 */
export interface FileUploadTicket {
  readonly file: FileObjectSummary;
  readonly uploadUrl: string;
  readonly method: 'PUT';
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

/** A metadata record plus a short-lived presigned URL to download its bytes. */
export interface FileDownloadTicket {
  readonly file: FileObjectSummary;
  readonly downloadUrl: string;
  readonly expiresAt: string;
}
