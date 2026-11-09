// ESLint flat config. The rules it enforces are described in web/CLAUDE.md (Tooling).
// This file is the source of truth for linting.
//
// Dev dependencies (tested together; pinned in package.json):
//   eslint 9.39.5, @eslint/js 9.39.5, typescript-eslint 8.72.1,
//   eslint-plugin-react 7.37.5, eslint-plugin-react-hooks 7.1.1,
//   eslint-plugin-import 2.32.0, @stylistic/eslint-plugin 5.10.0, globals 17.14.0
// ESLint stays on 9 until every plugin's peer range supports 10.
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // src-tauri holds the Rust shell and its generated files, not frontend code.
  { ignores: ['dist', 'coverage', 'node_modules', 'src-tauri'] },
  {
    files:   ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals:     globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      '@stylistic':  stylistic,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── TypeScript ────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars':       ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-use-before-define': ['error'],
      '@typescript-eslint/no-explicit-any':      'error',
      // Enforce explicit types (useState<T> generics have no lint rule; code review covers them)
      '@typescript-eslint/explicit-function-return-type':  'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/typedef':                        ['error', { variableDeclaration: true, arrowParameter: true, parameter: true }],
      'no-unused-vars':                                    'off',
      'no-use-before-define':                              'off',

      // ── Imports ───────────────────────────────────────────────────
      'import/no-unresolved':              'off',
      'import/no-named-as-default-member': 'off',
      'import/no-relative-parent-imports': 'off', // handled by no-restricted-imports below
      'no-restricted-imports':             [
        'error',
        {
          patterns: [
            {
              group:   ['../*'],
              message: 'Relative parent imports (../) are not allowed. Use the @src/* path alias instead.',
            },
          ],
        },
      ],
      'import/order': [
        'error',
        {
          groups:     ['builtin', 'external', 'internal', 'sibling', 'unknown'],
          pathGroups: [
            {
              pattern:  '{react,react/**,react-dom,react-dom/**,react-router,react-router/**,react-router-dom}',
              group:    'external',
              position: 'before',
            },
            { pattern: '@src/**', group: 'internal' },
            { pattern: '**/*.{css,scss}', group: 'unknown', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between':            'always',
          alphabetize:                   { order: 'asc', caseInsensitive: true },
        },
      ],

      // ── React ─────────────────────────────────────────────────────
      'react/jsx-boolean-value': ['error', 'never'],
      'react/jsx-sort-props':    [
        'error',
        {
          ignoreCase:           true,
          callbacksLast:        true,
          shorthandFirst:       true,
          shorthandLast:        false,
          reservedFirst:        true,
          noSortAlphabetically: false,
        },
      ],
      'react/require-default-props': 'off',
      'react-hooks/rules-of-hooks':  'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── General ───────────────────────────────────────────────────
      'arrow-body-style':      'off',
      'no-param-reassign':     ['error', { props: false }],
      'prefer-destructuring':  ['error', { array: false }],
      'no-restricted-exports': 'off',
      'no-console':            ['warn', { allow: ['error'] }],

      // ── Formatting (@stylistic) ───────────────────────────────────
      '@stylistic/indent':               ['error', 2],
      '@stylistic/key-spacing':          ['error', { align: 'value' }],
      '@stylistic/object-curly-newline': ['error', { consistent: true }],
      '@stylistic/operator-linebreak':   ['error', 'before', { overrides: { '=': 'after' } }],
      '@stylistic/quote-props':          ['error', 'consistent-as-needed'],
      '@stylistic/linebreak-style':      ['error', 'unix'],
    },
  },
)
