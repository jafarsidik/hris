import { describe, expect, it } from 'vitest';

import { GENERATED_PASSWORD_LENGTH, generatePassword } from './password-generator';

/** The API's rule, copied from `apps/api/src/modules/auth/auth.dto.ts`. */
const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

/** Characters a person cannot reliably tell apart when retyping a shared password. */
const AMBIGUOUS = /[lIO01]/;

describe('generatePassword', () => {
  it('satisfies the API password policy every time', () => {
    // The point of the button is that the administrator never has to think about the rule,
    // so the rule has to hold for every draw, not most of them.
    for (let attempt = 0; attempt < 500; attempt += 1) {
      expect(generatePassword(), `attempt ${attempt}`).toMatch(POLICY);
    }
  });

  it('contains each required character class', () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const password = generatePassword();

      expect(password, `attempt ${attempt}`).toMatch(/[a-z]/);
      expect(password, `attempt ${attempt}`).toMatch(/[A-Z]/);
      expect(password, `attempt ${attempt}`).toMatch(/\d/);
    }
  });

  it('is the documented length by default', () => {
    expect(generatePassword()).toHaveLength(GENERATED_PASSWORD_LENGTH);
  });

  it('honours a requested length', () => {
    expect(generatePassword(24)).toHaveLength(24);
    expect(generatePassword(8)).toHaveLength(8);
  });

  it('clamps a length the policy would reject', () => {
    // A caller asking for 4 gets something the API accepts rather than a 400 later.
    expect(generatePassword(4)).toHaveLength(8);
    expect(generatePassword(500)).toHaveLength(128);
  });

  it('avoids characters that are misread when retyped', () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(generatePassword(), `attempt ${attempt}`).not.toMatch(AMBIGUOUS);
    }
  });

  it('does not repeat itself', () => {
    // Two draws of the same length from the same alphabet: a deterministic generator would
    // hand every new account the same password.
    const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));

    expect(seen.size).toBe(50);
  });

  it('does not put the required classes in a fixed position', () => {
    // The first three characters are drawn from one class each and then shuffled; if the
    // shuffle were dropped, every password would start lowercase-uppercase-digit.
    const openings = new Set(Array.from({ length: 200 }, () => generatePassword().slice(0, 1)));

    expect(openings.size).toBeGreaterThan(10);
  });
});
