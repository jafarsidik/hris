import {
  COUNTRY_DEFAULTS,
  COUNTRY_CODES,
  DEFAULT_COUNTRY,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIME_ZONES,
  getCountryDefaults,
  isCountryCode,
} from '../src';

describe('country defaults', () => {
  it('defines defaults for every supported country', () => {
    for (const code of COUNTRY_CODES) {
      const defaults = getCountryDefaults(code);
      expect(defaults.countryCode).toBe(code);
      expect(defaults.defaultCurrency).toMatch(/^[A-Z]{3}$/);
      expect(defaults.defaultLocale).toContain('-');
      expect(() => new Intl.DateTimeFormat(defaults.defaultLocale)).not.toThrow();
      expect(() => new Intl.DateTimeFormat('en', { timeZone: defaults.defaultTimeZone })).not.toThrow();
    }
  });

  it('rejects an unsupported country instead of returning a fallback', () => {
    expect(() => getCountryDefaults('JP' as never)).toThrow(RangeError);
  });

  it('guards against untrusted country input', () => {
    expect(isCountryCode('MY')).toBe(true);
    expect(isCountryCode('my')).toBe(false);
    expect(isCountryCode(undefined)).toBe(false);
  });

  it('exposes a supported default country', () => {
    expect(isCountryCode(DEFAULT_COUNTRY)).toBe(true);
  });

  it('keeps derived lists unique', () => {
    expect(new Set(SUPPORTED_TIME_ZONES).size).toBe(SUPPORTED_TIME_ZONES.length);
    expect(new Set(SUPPORTED_CURRENCIES).size).toBe(SUPPORTED_CURRENCIES.length);
  });

  it('is frozen to prevent cross-workspace mutation', () => {
    expect(Object.isFrozen(COUNTRY_DEFAULTS)).toBe(true);
  });
});