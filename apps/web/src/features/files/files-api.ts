import type {
  FileDownloadTicket,
  FileObjectStatus,
  FileObjectSummary,
  FileUploadTicket,
} from '@hris/shared-types';

import { apiRequestV1 } from '@/lib/api/client-config';
import { ApiRequestError } from '@/lib/api/http-client';

/**
 * The files module's browser client.
 *
 * Uploads do not travel through this client: the browser `PUT`s the bytes straight to the
 * object store using the presigned URL from {@link filesApi.reserve}, so the API never
 * buffers a payload. Everything else — metadata, download tickets, deletion — goes through
 * the versioned API, where the tenant boundary and the `document:*` permissions live.
 */

export interface ReserveFileInput {
  readonly name: string;
  readonly mimeType: string;
  readonly size?: number;
  readonly entity?: string;
  readonly entityId?: string;
  readonly retentionDays?: number;
}

export interface FileFilter {
  readonly entity?: string;
  readonly entityId?: string;
  /** Omit to receive everything except deleted objects. */
  readonly status?: FileObjectStatus;
}

const query = (params: Readonly<Record<string, string | undefined>>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value.length > 0) {
      search.set(key, value);
    }
  }
  const rendered = search.toString();
  return rendered.length === 0 ? '' : `?${rendered}`;
};

export const filesApi = {
  list: (filter: FileFilter = {}): Promise<readonly FileObjectSummary[]> =>
    apiRequestV1<readonly FileObjectSummary[]>(
      `/files${query({ entity: filter.entity, entityId: filter.entityId, status: filter.status })}`,
    ),

  reserve: (input: ReserveFileInput): Promise<FileUploadTicket> =>
    apiRequestV1<FileUploadTicket>('/files', { method: 'POST', body: input }),

  complete: (id: string): Promise<FileObjectSummary> =>
    apiRequestV1<FileObjectSummary>(`/files/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
    }),

  download: (id: string): Promise<FileDownloadTicket> =>
    apiRequestV1<FileDownloadTicket>(`/files/${encodeURIComponent(id)}/download`),

  remove: (id: string): Promise<void> =>
    apiRequestV1<never>(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/**
 * Reserves, uploads and confirms one file.
 *
 * The reserved MIME type always comes from the browser's own `File`, never from a form
 * field, so what the API records cannot disagree with what the browser uploaded. A failed
 * `PUT` aborts before confirmation, leaving the reservation PENDING rather than a row that
 * claims bytes it does not have.
 */
export interface UploadFileOptions {
  /** The record the file belongs to, e.g. `employee` with the employee's id. */
  readonly entity?: string;
  readonly entityId?: string;
}

export async function uploadFile(
  file: File,
  options: UploadFileOptions = {},
): Promise<FileObjectSummary> {
  const mimeType = file.type.length > 0 ? file.type : 'application/octet-stream';
  const ticket = await filesApi.reserve({
    name: file.name,
    mimeType,
    size: file.size,
    ...(options.entity === undefined ? {} : { entity: options.entity }),
    ...(options.entityId === undefined ? {} : { entityId: options.entityId }),
  });

  let stored: Response;
  try {
    stored = await fetch(ticket.uploadUrl, { method: 'PUT', body: file });
  } catch (cause) {
    throw new ApiRequestError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The object store could not be reached. Please try again shortly.',
      status: 0,
      cause,
    });
  }

  if (!stored.ok) {
    throw new ApiRequestError({
      code: 'INTERNAL_ERROR',
      message: `The upload was rejected by storage (HTTP ${stored.status}).`,
      status: stored.status,
    });
  }

  return filesApi.complete(ticket.file.id);
}
