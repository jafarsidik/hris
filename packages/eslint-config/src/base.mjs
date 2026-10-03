import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Baseline rules applied to every workspace in the monorepo.
 *
 * Formatting concerns are intentionally delegated to Prettier
 * (`eslint-config-prettier` is appended last), so this config only carries
 * correctness and type-safety rules.
 */
export const base = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // TypeScript already reports undefined variables and unused values with
      // full type information; the base JS rules produce duplicate/noisy errors.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // Correctness guards that matter in an enterprise codebase.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'error',
      'no-throw-literal': 'error',
      'no-implicit-coercion': ['error', { boolean: false }],

      // A non-null assertion silently suppresses a real possibility of `undefined`,
      // which is unacceptable in code that gates access to employee data.
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Keeps type-only imports explicit so `isolatedModules` builds stay valid
      // and runtime imports are never erased by mistake.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  {
    // Shared packages must stay environment agnostic: they are consumed by the
    // browser, the API and the mobile runtime, so they cannot read process state.
    files: ['packages/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'Shared packages must not read process state. Accept configuration explicitly as an argument instead.',
        },
      ],
    },
  },
  prettier,
);

export default base;