import globals from 'globals';
import jsx from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { base } from './base.mjs';

/**
 * React rules for the web and mobile applications.
 *
 * Accessibility rules are errors, not warnings: the platform must meet
 * WCAG 2.1 AA (MASTER_PRD section 21, IMPLEMENTATION_PLAN phase 10).
 */
export const react = [
  ...base,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsx,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsx.configs.recommended.rules,

      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];

export default react;