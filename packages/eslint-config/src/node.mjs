import globals from 'globals';
import { base } from './base.mjs';

/**
 * Node.js rules for the API and any server-side package.
 */
export const node = [
  ...base,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // The API must not write to stdout directly; it uses the structured logger.
      'no-console': ['error', { allow: ['error', 'warn'] }],
    },
  },
];

export default node;
