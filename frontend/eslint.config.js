import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  // T014 (R-007): Prohibir axios y fetch global en capas que no son service/
  {
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/pages/**/*.{ts,tsx}',
      'src/layout/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'No importar axios directamente desde componentes/páginas/layout. Usá httpClient de service/.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'No llamar a fetch directamente desde componentes/páginas/layout. Usá httpClient de service/.',
        },
      ],
    },
  },
]);
