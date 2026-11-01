import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/node_modules/', 'app/src/api/schema.d.ts', 'landing/public/'] },
  {
    // Build scripts (Node).
    files: ['scripts/**/*.mjs', 'landing/scripts/**/*.mjs', 'landing/vite.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    // The landing page's own script: the designed page as delivered, with the
    // scene code kept as it was written. Only real mistakes are errors here.
    files: ['landing/src/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.browser, THREE: 'readonly', MathJax: 'readonly' } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': 'off', 'no-redeclare': 'off' },
  },
  {
    // The app.
    files: ['app/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
);
