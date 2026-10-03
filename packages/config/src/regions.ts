import { COUNTRY_CODES, type CountryCode } from '@hris/shared-types';

export { COUNTRY_CODES, type CountryCode } from '@hris/shared-types';

/**
 * Country defaults.
 *
 * These are *presentation and formatting* defaults only. Statutory rules
 * (EPF, SOCSO, EIS, PCB, ...) are never encoded here; they live in the
 * versioned statutory configuration module inside the payroll domain
 * (MASTER_PRD section 12, ARCHITECTURE section 21).
 */

export interface CountryDefaults {
  readonly countryCode: CountryCode;
  readonly countryName: string;
  readonly defaultTimeZone: string;
  readonly defaultCurrency: string;
  readonly defaultLocale: string;
}

export const COUNTRY_DEFAULTS: Readonly<Record<CountryCode, CountryDefaults>> = Object.freeze({
  MY: {
    countryCode: 'MY',
    countryName: 'Malaysia',
    defaultTimeZone: 'Asia/Kuala_Lumpur',
    defaultCurrency: 'MYR',
    defaultLocale: 'en-MY',
  },
  ID: {
    countryCode: 'ID',
    countryName: 'Indonesia',
    defaultTimeZone: 'Asia/Jakarta',
    defaultCurrency: 'IDR',
    defaultLocale: 'id-ID',
  },
  SG: {
    countryCode: 'SG',
    countryName: 'Singapore',
    defaultTimeZone: 'Asia/Singapore',
    defaultCurrency: 'SGD',
    defaultLocale: 'en-SG',
  },
  TH: {
    countryCode: 'TH',
    countryName: 'Thailand',
    defaultTimeZone: 'Asia/Bangkok',
    defaultCurrency: 'THB',
    defaultLocale: 'th-TH',
  },
  VN: {
    countryCode: 'VN',
    countryName: 'Vietnam',
    defaultTimeZone: 'Asia/Ho_Chi_Minh',
    defaultCurrency: 'VND',
    defaultLocale: 'vi-VN',
  },
});

/**
 * Country targeted by the initial statutory configuration.
 * Deployments operating in several countries configure this per entity rather
 * than changing code.
 */
export const DEFAULT_COUNTRY: CountryCode = 'MY';

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && (COUNTRY_CODES as readonly string[]).includes(value);
}

export function getCountryDefaults(countryCode: CountryCode): CountryDefaults {
  const defaults = COUNTRY_DEFAULTS[countryCode];
  if (!defaults) {
    throw new RangeError(`Unsupported country code: ${String(countryCode)}`);
  }
  return defaults;
}

/** Every supported IANA time zone, used to validate geofence and shift configuration. */
export const SUPPORTED_TIME_ZONES: readonly string[] = Object.freeze([
  ...new Set(Object.values(COUNTRY_DEFAULTS).map((entry) => entry.defaultTimeZone)),
]);

export const SUPPORTED_CURRENCIES: readonly string[] = Object.freeze([
  ...new Set(Object.values(COUNTRY_DEFAULTS).map((entry) => entry.defaultCurrency)),
]);
