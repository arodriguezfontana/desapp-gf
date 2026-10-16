import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
  var __BACKEND_PROCESS__: ChildProcess | undefined;
}

const BACKEND_DIST = join(__dirname, '../../../backend/dist/src/main.js');
const HEALTH_URL_BASE = 'http://localhost';
const BACKEND_PORT = 3001; // puerto alternativo para no chocar con el dev server

async function waitForBackend(url: string, maxMs = 30000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // todavía no levantó
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Backend no levantó en ${maxMs}ms — URL: ${url}`);
}

export async function setup(): Promise<void> {
  console.log('[global-setup] Levantando PostgreSQL efímero con Testcontainers...');
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  globalThis.__PG_CONTAINER__ = container;

  const databaseUrl = container.getConnectionUri();
  console.log('[global-setup] PostgreSQL listo:', databaseUrl);
  // `globalThis.__PG_CONTAINER__` NO cruza el proceso separado donde corren
  // los archivos de test (Vitest ejecuta `globalSetup` en su propio proceso);
  // una env var sí se propaga (igual que VITE_TEST_API_URL mas abajo), así
  // que es la via que usan los tests que necesitan una conexión Postgres
  // directa (020-order-matching-engine, fixtures que no tienen endpoint propio).
  process.env.TEST_DATABASE_URL = databaseUrl;

  console.log('[global-setup] Arrancando backend NestJS...');
  const backend = spawn('node', [BACKEND_DIST], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
      PORT: String(BACKEND_PORT),
      JWT_SECRET: 'test-secret-for-integration',
    },
    stdio: 'inherit',
  });
  globalThis.__BACKEND_PROCESS__ = backend;

  const healthUrl = `${HEALTH_URL_BASE}:${BACKEND_PORT}/health`;
  await waitForBackend(healthUrl);
  console.log('[global-setup] Backend listo en', healthUrl);

  process.env.VITE_TEST_API_URL = `${HEALTH_URL_BASE}:${BACKEND_PORT}`;
  // 020-order-matching-engine: a diferencia de los specs existentes (que
  // llaman a `fetch` crudo), un test que renderiza un componente real usa
  // `ordersService`/`httpClient`, que leen `import.meta.env.VITE_API_BASE_URL`
  // (no `VITE_TEST_API_URL`). Vite expone cualquier var de entorno con
  // prefijo VITE_ ya presente en `process.env` dentro de `import.meta.env`.
  process.env.VITE_API_BASE_URL = `${HEALTH_URL_BASE}:${BACKEND_PORT}`;
}

