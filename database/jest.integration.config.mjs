/**
 * Jest configuration for the suite that needs live PostgreSQL and Redis.
 *
 * Kept separate from `jest.config.mjs` so `npm run verify` stays hermetic. These tests
 * prove behaviour that only exists against a real server: row-level security, the
 * append-only trigger, and the seed converging on repeated runs. None of it can be
 * verified with a mock, because the thing under test *is* the database's enforcement.
 *
 * `maxWorkers: 1` because the tests share one schema and create companies in it.
 *
 * @type {import('jest').Config}
 */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.integration.ts'],
  // Applying migrations is idempotent but concurrent workers would race on the
  // `_prisma_migrations` table.
  maxWorkers: 1,
  testTimeout: 60_000,
  clearMocks: true,
};

export default config;
