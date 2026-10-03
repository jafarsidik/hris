import { defineConfig } from 'eslint/config';
import { reactConfig } from '@hris/eslint-config';

export default defineConfig([
  reactConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // Server Components may legitimately be async; this rule assumes client-only code.
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
]);