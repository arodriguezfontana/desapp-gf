import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:crypto',
              allowImportNames: ['randomUUID'],
              message:
                'El Service no debe hashear directamente: usá el Adapter correspondiente (TokenHasher, PasswordHasher). Solo se permite randomUUID para generar identificadores.',
            },
            {
              name: 'crypto',
              allowImportNames: ['randomUUID'],
              message:
                'El Service no debe hashear directamente: usá el Adapter correspondiente (TokenHasher, PasswordHasher). Solo se permite randomUUID para generar identificadores.',
            },
            {
              name: 'bcrypt',
              message:
                'El Service no debe hashear directamente: usá el Adapter correspondiente (PasswordHasher).',
            },
            {
              name: 'axios',
              message:
                'El Service no debe scrapear directamente: usá el Adapter correspondiente (WhoScoredAdapter).',
            },
            {
              name: 'cheerio',
              message:
                'El Service no debe parsear HTML directamente: usá el Adapter correspondiente (WhoScoredAdapter).',
            },
          ],
        },
      ],
    },
  },
);
