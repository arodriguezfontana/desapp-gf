import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
  var __BACKEND_PROCESS__: ChildProcess | undefined;
}

const BACKEND_DIST = join(__dirname, '../../../backend/dist/main.js');
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
}

