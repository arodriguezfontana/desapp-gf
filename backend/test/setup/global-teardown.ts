import { rmSync } from 'node:fs';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { CONTAINER_GLOBAL_KEY, PG_URI_FILE } from './testcontainers';

/** Destruye el Postgres efímero levantado en global-setup. */
export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as Record<string, unknown>)[
    CONTAINER_GLOBAL_KEY
  ] as StartedPostgreSqlContainer | undefined;

  if (container) {
    await container.stop();
  }

  try {
    rmSync(PG_URI_FILE);
  } catch {
    /* el archivo puede no existir si el setup falló antes de escribirlo */
  }
}
