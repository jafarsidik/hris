import { describe, expect, it } from 'vitest';

import { describeStatus, formatHireDate, initialsFor } from './employee-presentation';

describe('describeStatus', () => {
  it.each([
    ['ACTIVE', 'Active'],
    ['ON_LEAVE', 'On leave'],
    ['PROBATION', 'Probation'],
    ['INACTIVE', 'Inactive'],
  ])('labels %s as %s', (code, label) => {
    expect(describeStatus(code).label).toBe(label);
  });

  it('does not render a status as an error', () => {
    // INACTIVE and ON_LEAVE are ordinary employment states. Rendering them with the
    // destructive variant would report a healthy organisation as having a problem.
    expect(describeStatus('INACTIVE').variant).not.toBe('destructive');
    expect(describeStatus('ON_LEAVE').variant).not.toBe('destructive');
  });

  it('distinguishes active from inactive', () => {
    expect(describeStatus('ACTIVE').variant).not.toBe(describeStatus('INACTIVE').variant);
  });

  it('shows the raw code for a status it was not taught', () => {
    // A new status from the API is a fact about the data. Rendering "Unknown" hides it
    // and makes the row look blank.
    expect(describeStatus('ON_PARENTAL_LEAVE').label).toBe('ON_PARENTAL_LEAVE');
  });

  it('falls back to a neutral variant for an unknown status', () => {
    expect(describeStatus('SOMETHING_NEW').variant).toBe('outline');
  });

  it('handles an empty status without throwing', () => {
    expect(describeStatus('').label).toBe('');
  });
});

describe('formatHireDate', () => {
  it('formats an ISO date for reading', () => {
    expect(formatHireDate('2020-03-07')).toBe('07 Mar 2020');
  });

  it('formats a leap day', () => {
    expect(formatHireDate('2020-02-29')).toBe('29 Feb 2020');
  });

  it('is independent of the host time zone', () => {
    // A date-only string has no time, so any zone offset can shift it a day. Pinning to
    // UTC is what keeps the server and the browser in agreement; without it this
    // assertion fails somewhere in the world rather than everywhere, which is worse.
    expect(formatHireDate('2021-01-01')).toBe('01 Jan 2021');
    expect(formatHireDate('2021-12-31')).toBe('31 Dec 2021');
  });

  it.each([
    ['an empty string', ''],
    ['nonsense', 'not-a-date'],
    ['an impossible day', '2020-02-31'],
    ['an impossible month', '2020-13-01'],
    ['a bare year', '2020'],
  ])('returns %s unchanged rather than "Invalid Date"', (_label, value) => {
    // Showing the raw value makes a bad record identifiable; "Invalid Date" looks
    // identical to a formatting bug.
    expect(formatHireDate(value)).toBe(value);
  });

  it('never emits an Invalid Date for any input', () => {
    for (const value of ['', 'x', '2020-99-99', '2020-02-31', '0000-00-00', '2020-1-1']) {
      expect(formatHireDate(value)).not.toContain('Invalid');
    }
  });
});

describe('initialsFor', () => {
  it('takes the first letter of the first and last word', () => {
    expect(initialsFor('Amara Osei')).toBe('AO');
    expect(initialsFor('Lars Petersen')).toBe('LP');
  });

  it('gives one letter for a single-word name', () => {
    // "Prince" is "P". Two letters would read as a different word.
    expect(initialsFor('Prince')).toBe('P');
  });

  it('ignores middle names and titles', () => {
    expect(initialsFor('Maria del Carmen Alvarez')).toBe('MA');
  });

  it('collapses runs of whitespace', () => {
    expect(initialsFor('  Amara   Osei  ')).toBe('AO');
  });

  it('drops punctuation but keeps the name intact', () => {
    expect(initialsFor("D'Angelo O'Brien")).toBe('DO');
    // Not "JA": folding the accent to a plain letter would be mangling someone's name to
    // save one glyph.
    expect(initialsFor('José Álvarez')).toBe('JÁ');
  });

  it('takes the first and last word, whatever is between them', () => {
    // "Team 7 Support" is T-S. Reading it as T-7 would mean the last word is a number,
    // which is not what "last name" means.
    expect(initialsFor('Team 7 Support')).toBe('TS');
    expect(initialsFor('Agent 7')).toBe('A7');
  });

  it('returns an empty string when there is nothing to show', () => {
    // The caller renders nothing rather than a stray glyph, so this must not throw and
    // must not fall back to a placeholder character.
    expect(initialsFor('')).toBe('');
    expect(initialsFor('   ')).toBe('');
    expect(initialsFor('---')).toBe('');
  });

  it('is at most two characters', () => {
    for (const name of ['A B C D E', 'Alexander Bartholomew Winchester', 'X']) {
      expect(initialsFor(name).length, name).toBeLessThanOrEqual(2);
    }
  });
});
