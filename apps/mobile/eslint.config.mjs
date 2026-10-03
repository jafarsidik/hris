import { defineConfig } from 'eslint/config';
import { reactConfig } from '@hris/eslint-config';

export default defineConfig([
  reactConfig,
  {
    ignores: ['.expo/**', 'node_modules/**', 'dist/**', 'coverage/**', 'android/**', 'ios/**'],
  },
]);