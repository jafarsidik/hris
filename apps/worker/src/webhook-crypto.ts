import { createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook signing primitives shared by the worker's deliverer and its tests.
 *
 * The at-rest envelope format (`iv.tag.ciphertext`, AES-256-GCM, key = SHA-256 of the
 * configured passphrase) is the same contract `CredentialCipherService` writes on the
 * API side. It is reproduced here rather than imported because the worker is a separate
 * process that must not depend on the API's Nest wiring; `credentials-cipher` tests and
 * the worker's unit tests pin both ends to the format.
 */
const ALGORITHM = 'aes-256-gcm';

/** Derives the 32-byte AES key from the operator-supplied passphrase. */
export function deriveKey(raw: string): Buffer {
  return createHash('sha256').update(raw, 'utf8').digest();
}

/** Opens an `iv.tag.ciphertext` envelope. Throws on tampering or a wrong key. */
export function decryptSecret(key: Buffer, envelope: string): string {
  const [ivPart, tagPart, ciphertextPart] = envelope.split('.');
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error('Stored credential is not a valid ciphertext envelope.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Signs a delivery body as `t=<unix seconds>,v1=<hex HMAC-SHA256>`.
 *
 * The timestamp is inside the signed string, so a captured request cannot be replayed
 * after the receiver's tolerance window and the timestamp cannot be rewritten in flight.
 */
export function signPayload(secret: string, timestampSeconds: number, body: string): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestampSeconds}.${body}`)
    .digest('hex');
  return `t=${timestampSeconds},v1=${signature}`;
}

/**
 * Verifies a signature the way a receiver should.
 *
 * Exported so it is a tested reference rather than prose in documentation. Returns false
 * for a malformed header, a stale timestamp or a mismatched digest; the comparison is
 * constant-time so a receiver cannot be probed byte by byte.
 */
export function verifyPayload(
  secret: string,
  header: string,
  body: string,
  options: { readonly toleranceSeconds: number; readonly nowSeconds: number },
): boolean {
  const parts = new Map(
    header.split(',').map((part) => {
      const separator = part.indexOf('=');
      return [part.slice(0, separator), part.slice(separator + 1)] as const;
    }),
  );
  const timestamp = Number(parts.get('t'));
  const provided = parts.get('v1');
  if (!Number.isFinite(timestamp) || provided === undefined) {
    return false;
  }
  if (Math.abs(options.nowSeconds - timestamp) > options.toleranceSeconds) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
