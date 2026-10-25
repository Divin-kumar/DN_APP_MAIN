import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.verification/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  { files: ['**/*.{js,jsx,mjs}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node } },
    // JSX identifiers are validated by Vite; legacy files contain unused helpers.
    // Keep the recommended correctness rules (including undefined identifiers).
    rules: { 'no-unused-vars': 'off' } },
];
