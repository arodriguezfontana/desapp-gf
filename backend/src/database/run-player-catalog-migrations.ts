import { DataSource } from 'typeorm';
import { playerCatalogDataSource } from './player-catalog-data-source';

/**
 * Corre (una única vez por entorno) la migration de seed del catálogo de
 * jugadores contra `DATABASE_URL`. Usa un `DataSource` standalone
 * (`player-catalog-data-source.ts`), separado del que gestiona
 * `TypeOrmModule.forRootAsync` en `database.module.ts` — ese no se toca.
 *
 * Idempotente: TypeORM lleva su propia tabla de migrations corridas y no
 * reaplica lo ya ejecutado (research.md §2 de 004-player-catalog).
 *
 * Se invoca desde `main.ts` (después de `NestFactory.create`) y desde
 * `test/test-app.ts` (después de `app.init()`), ambos una vez que el esquema ya
 * fue sincronizado por la conexión real de la app.
 */
export async function runPlayerCatalogMigrations(
  dataSource: DataSource = playerCatalogDataSource,
): Promise<void> {
  const wasInitialized = dataSource.isInitialized;
  if (!wasInitialized) {
    await dataSource.initialize();
  }
  try {
    await dataSource.runMigrations();
  } finally {
    if (!wasInitialized) {
      await dataSource.destroy();
    }
  }
}
