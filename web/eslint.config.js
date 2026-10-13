import js from '@eslint/js'
import react from 'eslint-plugin-react'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: true,
      },
    },
    rules: {
      // ── TypeScript ────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-use-before-define': ['error'],
      'no-unused-vars': 'off', // use @typescript-eslint version instead
      'no-use-before-define': 'off', // use @typescript-eslint version instead

      // ── Imports ───────────────────────────────────────────────────
      'import/no-unresolved': 'off',
      'import/no-named-as-default-member': 'off',
      // Disallow deep relative imports like ../../
      'import/no-relative-parent-imports': 'off', // handled by no-restricted-imports below
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Relative parent imports (../) are not allowed. Use @src/* path alias instead.',
            },
          ],
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',    // node built-ins
            'external',   // npm packages
            'internal',   // @src/* aliases
            'sibling',    // ./ imports
            'unknown',    // css/scss (caught by pathGroups below)
          ],
          pathGroups: [
            {
              pattern: '{react,react-dom,react-dom/client,react-router,react-router-dom}',
              group: 'internal',
              position: 'before',
            },
            {
              pattern: '{@src/**,@/**}',
              group: 'internal',
            },
            {
              pattern: '**/*.{css,scss}',
              group: 'unknown',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['react', 'react-dom', 'react-router', 'react-router-dom'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-sort-props': [
        'error',
        {
          // Sort all props alphabetically
          // Shorthand boolean props (isOpen) come before callbacks (onClick)
          // Callbacks (on*) come last
          // Reserved props (key, ref) come first
          ignoreCase: true,
          callbacksLast: true,
          shorthandFirst: true,
          shorthandLast: false,
          reservedFirst: true,
          noSortAlphabetically: false,
        },
      ],

      'react/require-default-props': 'off',
      'react-hooks/exhaustive-deps': ['warn'],

      'arrow-body-style': 'off',
      'key-spacing': ['error', { align: 'value' }],
      'no-param-reassign': ['error', { props: false }],
      'object-curly-newline': ['error', { consistent: true }],
      'operator-linebreak': ['error', 'before', { overrides: { '=': 'after' } }],
      'prefer-destructuring': ['error', { array: false }],
      'no-restricted-exports': 'off',
      'quote-props': ['error', 'consistent-as-needed'],

      'linebreak-style': ['error', 'unix'],
      indent: ['error', 2],
    },
  },
])
