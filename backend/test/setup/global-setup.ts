import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { CONTAINER_GLOBAL_KEY, PG_URI_FILE } from './testcontainers';

/**
 * Levanta UN único Postgres efímero con Testcontainers para toda la corrida de
 * tests (integración + e2e). Si Docker no está corriendo, realiza fallback a
 * la base de datos local definida en DATABASE_URL.
 */
export default async function globalSetup(): Promise<void> {
  let uri: string | undefined;

  try {
    const container = await new PostgreSqlContainer('postgres:16-alpine').start();
    uri = container.getConnectionUri();
    (globalThis as Record<string, unknown>)[CONTAINER_GLOBAL_KEY] = container;
  } catch {
    let fallbackUrl = process.env.DATABASE_URL;
    if (!fallbackUrl) {
      try {
        const envContent = readFileSync(resolve(__dirname, '../../.env'), 'utf8');
        const match = envContent.match(/DATABASE_URL="?([^"\n]+)"?/);
        if (match) {
          fallbackUrl = match[1];
        }
      } catch {
        /* ignore */
      }
    }
    uri = fallbackUrl ?? 'postgresql://postgres:root@localhost:5432/desapp?schema=public';
  }

  writeFileSync(PG_URI_FILE, JSON.stringify({ uri }), 'utf8');

  // Para el proceso que corre --runInBand (los tests comparten este process).
  process.env.DATABASE_URL = uri;
  process.env.NODE_ENV = 'test';
}
