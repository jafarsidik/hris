import { defineConfig } from 'eslint/config';
import { node } from '@hris/eslint-config';

export default defineConfig([
  node,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
]);
