import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { CONTAINER_GLOBAL_KEY, PG_URI_FILE } from './testcontainers';

/**
 * Levanta UN único Postgres efímero con Testcontainers para toda la corrida de
 * tests (integración + e2e). Si Docker no está corriendo, realiza fallback a
 * la base de datos local definida en DATABASE_URL.
 *
 * Ryuk (el reaper que Testcontainers usa para garantizar la limpieza de
 * contenedores huérfanos) queda deshabilitado: en Docker Desktop + Windows su
 * socket de control se cuelga de forma intermitente entre corridas sucesivas
 * (sesiones de Ryuk huérfanas que nunca liberan la conexión), dejando el
 * `.start()` de abajo colgado para siempre sin levantar ningún contenedor.
 * El costo es que, si el proceso de test muere a mitad de corrida, el
 * contenedor Postgres puede quedar huérfano (hay que limpiarlo a mano con
 * `docker rm -f`); en CI cada job corre en una VM descartable, así que ese
 * caso no aplica.
 */
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

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
