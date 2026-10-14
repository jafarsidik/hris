import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Minimal RFC 4226 (HOTP) / RFC 6238 (TOTP) implementation.
 *
 * Deliberately dependency-free: the popular `otplib` publishes an ES-module-only
 * dependency tree that cannot be `require`d from this CommonJS service, and the
 * algorithm is small and stable enough that owning it removes a fragile runtime
 * dependency (and makes it deterministically testable with a fixed epoch).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_LOOKUP = new Map([...BASE32_ALPHABET].map((char, index) => [char, index] as const));

export interface TotpOptions {
  readonly digits?: number;
  readonly period?: number;
}

export interface TotpVerifyOptions extends TotpOptions {
  /** Number of periods of drift tolerated on each side (default 1). */
  readonly window?: number;
  /** Override the clock; only used by tests. */
  readonly epoch?: number;
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function totpUri(options: {
  readonly issuer: string;
  readonly label: string;
  readonly secret: string;
  readonly digits?: number;
  readonly period?: number;
}): string {
  const digits = options.digits ?? 6;
  const period = options.period ?? 30;
  const label = encodeURIComponent(`${options.issuer}:${options.label}`);
  const query = new URLSearchParams({
    secret: options.secret,
    issuer: options.issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Generates the code for a specific counter (HOTP); exported for tests. */
export function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    ((digest[offset] ?? 0) & 0x7f) * 0x1000000 +
    ((digest[offset + 1] ?? 0) & 0xff) * 0x10000 +
    ((digest[offset + 2] ?? 0) & 0xff) * 0x100 +
    ((digest[offset + 3] ?? 0) & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function totp(
  secret: string,
  options: TotpOptions & { readonly epoch?: number } = {},
): string {
  const period = options.period ?? 30;
  const epoch = options.epoch ?? Math.floor(Date.now() / 1000);
  return hotp(secret, Math.floor(epoch / period), options.digits ?? 6);
}

/**
 * Constant-time comparison of the submitted token against the code for each
 * allowed time step.
 */
export function verifyTotp(
  secret: string,
  token: string,
  options: TotpVerifyOptions = {},
): boolean {
  const period = options.period ?? 30;
  const window = options.window ?? 1;
  const digits = options.digits ?? 6;
  const normalized = token.trim();
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) {
    return false;
  }

  const epoch = options.epoch ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / period);
  const submitted = Buffer.from(normalized);

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = Buffer.from(hotp(secret, counter + offset, digits));
    if (candidate.length === submitted.length && timingSafeEqual(candidate, submitted)) {
      return true;
    }
  }
  return false;
}

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/u, '').replace(/\s+/gu, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const decoded = BASE32_LOOKUP.get(char);
    if (decoded === undefined) {
      throw new Error('Invalid base32 secret.');
    }
    value = (value << 5) | decoded;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
