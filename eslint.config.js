import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      // core must stay pure: no clocks, no randomness, no platform globals.
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'process',
        'localStorage',
        'navigator',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Pass time in instead.' },
        { object: 'Math', property: 'random', message: 'Pass randomness in instead.' },
      ],
      'no-restricted-imports': ['error', { patterns: ['node:*', 'react', 'socket.io*'] }],
    },
  },
  {
    files: ['packages/server/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
);
