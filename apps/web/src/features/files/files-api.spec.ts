import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/lib/api/http-client';

import { uploadFile } from './files-api';

const BASE_URL = 'http://localhost:3001/api/v1';
const UPLOAD_URL = 'http://storage.test/hris-documents/company/file?X-Amz-Signature=abc';

const summary = {
  id: 'file-1',
  name: 'policy.pdf',
  mimeType: 'application/pdf',
  size: 12,
  status: 'AVAILABLE',
  checksum: 'etag-1',
  entity: null,
  entityId: null,
  retentionUntil: null,
  uploadedBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  removedAt: null,
} as const;

const envelope = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** Records every call and answers the three requests `uploadFile` makes, in order. */
function stubUpload(uploadStatus = 200) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  const spy = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body });
    if (url === `${BASE_URL}/files`) {
      return envelope({
        file: { ...summary, status: 'PENDING' },
        uploadUrl: UPLOAD_URL,
        method: 'PUT',
        headers: {},
        expiresAt: '2026-01-01T00:15:00.000Z',
      });
    }
    if (url === UPLOAD_URL) {
      return new Response(null, { status: uploadStatus });
    }
    return envelope(summary);
  });
  vi.stubGlobal('fetch', spy);
  return calls;
}

describe('uploadFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reserves, PUTs the bytes to storage, then confirms', async () => {
    const calls = stubUpload();
    const file = new File(['hello world!'], 'policy.pdf', { type: 'application/pdf' });

    const uploaded = await uploadFile(file);

    expect(uploaded).toEqual(summary);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST ${BASE_URL}/files`,
      `PUT ${UPLOAD_URL}`,
      `POST ${BASE_URL}/files/file-1/complete`,
    ]);
    // The bytes go to storage, never to the API.
    expect(calls[1]?.body).toBe(file);
  });

  it('does not confirm when storage rejects the upload', async () => {
    const calls = stubUpload(403);
    const file = new File(['nope'], 'policy.pdf', { type: 'application/pdf' });

    await expect(uploadFile(file)).rejects.toBeInstanceOf(ApiRequestError);
    // The reservation stays PENDING: no third call is made, so no row claims bytes that
    // storage refused.
    expect(calls).toHaveLength(2);
  });
});
