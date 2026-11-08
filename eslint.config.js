import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores: ['dist/', 'node_modules/']},
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {ecmaVersion: 2022, sourceType: 'module', globals: globals.browser},
    rules: {
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      'no-var': 'error',
      'prefer-const': 'error',
      curly: ['error', 'multi-line'],
    },
  },
  {
    files: ['sw.js'],
    languageOptions: {ecmaVersion: 2022, sourceType: 'script', globals: globals.serviceworker},
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: {ecmaVersion: 2022, sourceType: 'module', globals: globals.node},
  },
];
