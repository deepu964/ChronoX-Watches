import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: ['node_modules/**', 'public/**', 'dist/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node, // 👈 add Node.js globals like `process`, `__dirname`
        ...globals.browser, // optional: add browser globals too
      },
    },
    rules: {
      // Optional: Add common useful rules
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': 'off',
    },
  },
]);
