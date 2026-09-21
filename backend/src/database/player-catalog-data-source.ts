import { DataSource } from 'typeorm';

/**
 * `DataSource` standalone, exclusivamente para correr la migration de seed del
 * catálogo de jugadores (CLI de TypeORM y `run-player-catalog-migrations.ts`).
 *
 * NO es la conexión de la app: `database.module.ts` sigue intacto, con su propio
 * `TypeOrmModule.forRootAsync` y `synchronize` para crear el esquema (incluida la
 * tabla `players`). Este `DataSource` sólo sabe correr migrations — no registra
 * entidades, la migration usa SQL crudo vía `queryRunner.query(...)`.
 *
 * Ver research.md §2 de la feature 004-player-catalog para el porqué de este
 * `DataSource` separado en vez de agregar `migrations`/`migrationsRun` al de la app.
 */
export const playerCatalogDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [],
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
});

export default playerCatalogDataSource;
