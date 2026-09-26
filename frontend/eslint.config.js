import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src/routeTree.gen.ts', '.codex/**', '.playwright-cli/**', 'test-results*/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'import-x': importPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            { target: './src/features', from: ['./src/app', './src/routes'] },
            {
              target: ['./src/components', './src/hooks', './src/lib', './src/stores', './src/types'],
              from: ['./src/features', './src/app', './src/routes'],
            },
            { target: './src/features/auth', from: './src/features', except: ['./auth'] },
            { target: './src/features/workspace', from: './src/features', except: ['./workspace'] },
            { target: './src/features/brand', from: './src/features', except: ['./brand'] },
          ],
        },
      ],
    },
  },
  {
    files: ['src/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
);
