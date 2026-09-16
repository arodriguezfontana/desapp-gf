export async function teardown(): Promise<void> {
  console.log('[global-teardown] Deteniendo backend NestJS...');
  if (globalThis.__BACKEND_PROCESS__) {
    globalThis.__BACKEND_PROCESS__.kill('SIGTERM');
    globalThis.__BACKEND_PROCESS__ = undefined;
  }

  console.log('[global-teardown] Destruyendo contenedor PostgreSQL...');
  if (globalThis.__PG_CONTAINER__) {
    await globalThis.__PG_CONTAINER__.stop();
    globalThis.__PG_CONTAINER__ = undefined;
  }

  console.log('[global-teardown] Limpieza completa.');
}

