import { createHmac } from 'node:crypto';

import { generateTotpSecret, hotp, totp, totpUri, verifyTotp } from './totp';

// RFC 6238 appendix B test vectors. The shared secret is the ASCII string
// "12345678901234567890" encoded as base32, whose digest is reproduced below.
const RFC_SECRET_ASCII = '12345678901234567890';
const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function referenceHotp(secret: Buffer, counter: number, digits = 8): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    ((digest[offset] ?? 0) & 0x7f) * 0x1000000 +
    ((digest[offset + 1] ?? 0) & 0xff) * 0x10000 +
    ((digest[offset + 2] ?? 0) & 0xff) * 0x100 +
    ((digest[offset + 3] ?? 0) & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

describe('totp', () => {
  it('matches the RFC 4226 HOTP vectors for SHA-1', () => {
    const secret = Buffer.from(RFC_SECRET_ASCII);
    expect(hotp(RFC_SECRET_BASE32, 0, 8)).toBe(referenceHotp(secret, 0));
    expect(hotp(RFC_SECRET_BASE32, 1, 8)).toBe(referenceHotp(secret, 1));
    // RFC 4226 published value for counter 0 is 755224 (6 digits).
    expect(hotp(RFC_SECRET_BASE32, 0, 6)).toBe('755224');
  });

  it('matches the RFC 6238 TOTP vectors at fixed epochs', () => {
    // 59s -> counter 1, 1111111109 -> counter 37037036 (SHA-1 8-digit).
    expect(totp(RFC_SECRET_BASE32, { epoch: 59, digits: 8 })).toBe(
      referenceHotp(Buffer.from(RFC_SECRET_ASCII), Math.floor(59 / 30), 8),
    );
    expect(totp(RFC_SECRET_BASE32, { epoch: 1111111109, digits: 8 })).toBe(
      referenceHotp(Buffer.from(RFC_SECRET_ASCII), Math.floor(1111111109 / 30), 8),
    );
  });

  it('generates distinct base32 secrets of the requested size', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]+$/u);
    expect(generateTotpSecret(10)).toHaveLength(16);
  });

  it('builds an otpauth URI that a standard authenticator accepts', () => {
    const uri = totpUri({ issuer: 'HRIS', label: 'user@example.com', secret: RFC_SECRET_BASE32 });
    expect(uri).toContain('otpauth://totp/HRIS%3Auser%40example.com');
    expect(uri).toContain(`secret=${RFC_SECRET_BASE32}`);
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('accepts the current code and rejects neighbours beyond the window', () => {
    const epoch = 1_700_000_000;
    const code = totp(RFC_SECRET_BASE32, { epoch });
    expect(verifyTotp(RFC_SECRET_BASE32, code, { epoch })).toBe(true);
    expect(verifyTotp(RFC_SECRET_BASE32, code, { epoch: epoch + 90 })).toBe(false);
    expect(verifyTotp(RFC_SECRET_BASE32, code, { epoch: epoch + 30 })).toBe(true);
  });

  it('rejects malformed tokens', () => {
    expect(verifyTotp(RFC_SECRET_BASE32, 'abcdef')).toBe(false);
    expect(verifyTotp(RFC_SECRET_BASE32, '12345')).toBe(false);
  });
});
