/**
 * Reference data that the seed writes.
 *
 * The codes come from `@hris/shared-types` because the API validates country codes
 * against that list; seeding from a local copy would let the two disagree. The names
 * and the currency metadata live here because they are presentation and storage
 * details the API never asserts on.
 *
 * `database/tests/seed-contract.test.ts` asserts that every code in `COUNTRY_CODES` has
 * an entry below, so adding a country to the shared vocabulary fails the build until
 * the seed is updated rather than silently producing an unnamed country row.
 */

/** Display names for the supported countries. */
export const COUNTRY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  MY: 'Malaysia',
  ID: 'Indonesia',
  SG: 'Singapore',
  TH: 'Thailand',
  VN: 'Vietnam',
});

/**
 * The currency of each supported country.
 *
 * `minorUnit` is the number of decimal places the currency is actually used with.
 * It is stored rather than assumed to be 2 because VND is quoted without decimals, and
 * rounding an Indonesian or Vietnamese amount to a hundredth of the smallest unit
 * invents precision that does not exist.
 */
export const COUNTRY_CURRENCIES: readonly {
  readonly code: string;
  readonly name: string;
  readonly minorUnit: number;
}[] = Object.freeze([
  { code: 'MYR', name: 'Malaysian Ringgit', minorUnit: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', minorUnit: 2 },
  { code: 'SGD', name: 'Singapore Dollar', minorUnit: 2 },
  { code: 'THB', name: 'Thai Baht', minorUnit: 2 },
  { code: 'VND', name: 'Vietnamese Dong', minorUnit: 0 },
]);
