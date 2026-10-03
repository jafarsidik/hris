/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  // Components are asserted through server-side rendering, so no DOM shim is
  // required. This keeps the design-system test setup dependency-free.
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
  clearMocks: true,
};

export default config;