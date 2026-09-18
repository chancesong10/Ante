// Flat config (ESLint 9). eslint-config-expo carries the React, React Native
// and import rules that match this project's setup; the block below is only
// what this repo needs on top.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'brag-output/**',
      'docs/**',
      'playstore-assets/**',
      'store-assets/**',
      'scripts/**',
      '.claude/**',
      '.agents/**',
      '.codex/**',
      '.impeccable/**',
    ],
  },
  {
    files: ['**/*.js'],
    rules: {
      // The dependency rule this repo already had a suppression for. A warning
      // rather than an error: several effects here intentionally run once on
      // mount, and each of those is commented where it happens.
      'react-hooks/exhaustive-deps': 'warn',

      // An HTML rule: it wants apostrophes written as &apos; so they can't be
      // mistaken for JSX delimiters. React Native's <Text> does no entity
      // parsing, so following it would turn readable copy into escape
      // sequences for no benefit.
      'react/no-unescaped-entities': 'off',

      // The four rules below ship with the React Compiler lint suite and flag
      // patterns that are legal today but block compiler optimisation —
      // reading a ref during render, setting state from an effect, and so on.
      // This codebase predates them and has ~190 hits, almost all in animation
      // and focus handling. They stay visible as warnings rather than being
      // switched off, but clearing them is its own piece of work and should
      // not gate CI on unrelated changes.
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/globals': 'warn',

      // Money formatting belongs in utils/format.js. This is the rule that
      // stops issue #15 from happening again — 70 inline call sites had grown
      // up beside a helper that claimed to be the single source of truth, and
      // the privacy mask lived only in the helper, so every inline site
      // silently opted out of it.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='toLocaleString'] > ObjectExpression Property[key.name='minimumFractionDigits']",
          message:
            'Use formatMoney / formatNumber / formatAmount from utils/format.js instead of inline toLocaleString. The privacy mask lives in formatMoney, so inline formatting silently ignores it.',
        },
      ],
    },
  },
  {
    // Tests and the format helpers themselves are allowed the raw call.
    files: ['utils/format.js', '**/__tests__/**/*.js', 'test/**/*.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Jest injects these; the runner is configured in jest.config.js rather
    // than through an ESLint env, so they have to be declared here.
    files: ['**/__tests__/**/*.js', 'test/**/*.js', '**/*.test.js'],
    rules: {
      // jest.mock calls are hoisted above imports by design, so the mocks a
      // test sets up have to be written before the module under test is
      // imported. That is the required order, not a mistake.
      'import/first': 'off',
      // Inline render helpers in tests don't need display names.
      'react/display-name': 'off',
    },
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        globalThis: 'readonly',
      },
    },
  },
];
