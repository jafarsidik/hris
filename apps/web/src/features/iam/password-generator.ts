/**
 * A password an administrator does not have to invent.
 *
 * The policy is the API's own, in `apps/api/src/modules/auth/auth.dto.ts`: 8–128 characters
 * with at least one lowercase letter, one uppercase letter and one digit. A generated value
 * satisfies it by construction rather than by luck — one character from each required class
 * is drawn first, the rest come from the union of all classes, and the result is shuffled,
 * so the required characters are not sitting in predictable positions.
 *
 * The alphabet leaves out the characters a person has to read out loud or retype: `l`, `I`,
 * `O`, `0` and `1`. The value exists to be shared with the person being onboarded, and a
 * password that is only unambiguous in a monospaced font is a support ticket.
 *
 * `crypto.getRandomValues` rather than `Math.random`: this is a credential, and
 * `Math.random` is not a source of unpredictability. Draws are rejection-sampled rather than
 * taken modulo the alphabet length, because `byte % n` over a 256-value byte skews towards
 * the first `256 % n` characters of the alphabet.
 */

/** The API's bounds, restated here because the web tier cannot import the DTO. */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/** Long enough to be strong, short enough that nobody needs a password manager to retype it. */
export const GENERATED_PASSWORD_LENGTH = 16;

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/** A uniformly distributed index in `[0, bound)`. */
function randomBelow(bound: number): number {
  const limit = Math.floor(256 / bound) * bound;
  const buffer = new Uint8Array(1);

  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) {
      return value % bound;
    }
  }
}

const drawFrom = (alphabet: string): string => alphabet[randomBelow(alphabet.length)] ?? '';

function shuffled(values: readonly string[]): string[] {
  const out = [...values];

  // Fisher–Yates, so every permutation of the required characters is equally likely.
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = randomBelow(index + 1);
    [out[index], out[swap]] = [out[swap] ?? '', out[index] ?? ''];
  }

  return out;
}

/**
 * A generated password that satisfies the platform policy.
 *
 * A length outside the policy is clamped rather than rejected: the caller is a button, not a
 * person, so the useful behaviour is to return something that works.
 */
export function generatePassword(length: number = GENERATED_PASSWORD_LENGTH): string {
  const total = Math.min(Math.max(Math.trunc(length), PASSWORD_MIN_LENGTH), PASSWORD_MAX_LENGTH);

  const required = [drawFrom(LOWER), drawFrom(UPPER), drawFrom(DIGITS)];
  const filler = Array.from({ length: total - required.length }, () => drawFrom(ALL));

  return shuffled([...required, ...filler]).join('');
}
