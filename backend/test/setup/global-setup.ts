import { writeFileSync } from 'node:fs';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { CONTAINER_GLOBAL_KEY, PG_URI_FILE } from './testcontainers';

/**
 * Levanta UN único Postgres efímero con Testcontainers para toda la corrida de
 * tests (integración + e2e). Se destruye en global-teardown. La connection
 * string es dinámica y se deja en un archivo temporal que leen los workers.
 */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const uri = container.getConnectionUri();

  (globalThis as Record<string, unknown>)[CONTAINER_GLOBAL_KEY] = container;
  writeFileSync(PG_URI_FILE, JSON.stringify({ uri }), 'utf8');

  // Para el proceso que corre --runInBand (los tests comparten este process).
  process.env.DATABASE_URL = uri;
  process.env.NODE_ENV = 'test';
}
