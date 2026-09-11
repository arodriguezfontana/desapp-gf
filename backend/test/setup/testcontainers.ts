import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Archivo temporal donde el globalSetup deja la connection string del contenedor
 * Postgres efímero para que cada worker de Jest la lea. Las credenciales son
 * dinámicas (las expone Testcontainers al levantar el contenedor); nunca se
 * hardcodean ni se leen de `backend/.env`.
 */
export const PG_URI_FILE = join(tmpdir(), 'desapp-testcontainers-pg-uri.json');

/** Handle del contenedor, compartido entre globalSetup y globalTeardown. */
export const CONTAINER_GLOBAL_KEY = '__DESAPP_PG_CONTAINER__';
