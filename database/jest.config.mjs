/**
 * Jest configuration for the DB-free suite.
 *
 * `*.test.ts` runs here and therefore in `npm run verify`, so it must never need a
 * database. Tests that do need one are named `*.integration.ts` and run through
 * `test:integration`, which is only executed where PostgreSQL and Redis are actually
 * available.
 *
 * Keeping that split is what lets the unit gate stay fast and hermetic. A suite that
 * quietly requires a database is a suite that fails on a contributor's laptop for
 * reasons unrelated to their change, and people learn to ignore it.
 *
 * @type {import('jest').Config}
 */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/src/generated/'],
  coverageDirectory: 'coverage',
  clearMocks: true,
};

export default config;
