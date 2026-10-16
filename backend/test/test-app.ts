import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { runPlayerCatalogMigrations } from '../src/database/run-player-catalog-migrations';
import { createGlobalValidationPipe } from '../src/shared/validation/global-validation-pipe';

export interface ProviderOverride {
  token: string | symbol | Type<unknown>;
  useValue: unknown;
}

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  close: () => Promise<void>;
  clearUsers: () => Promise<void>;
}

/** Levanta la app real (misma config que producción) para los tests e2e. */
export async function createTestApp(overrides?: ProviderOverride[]): Promise<TestContext> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  for (const { token, useValue } of overrides ?? []) {
    builder = builder.overrideProvider(token).useValue(useValue);
  }

  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.init();

  // El esquema (incluida `players`) ya está sincronizado por TypeOrmModule al
  // inicializar la app; recién ahí corre la migration de seed del catálogo,
  // igual que en `main.ts` (research.md §2 de 004-player-catalog).
  await runPlayerCatalogMigrations();

  const dataSource = app.get<DataSource>(DataSource);
  // DELETE, no .clear() (TRUNCATE): valuation_strategies y player_quotes
  // tienen FK hacia users (019-per-user-valuation-strategies, cada alta
  // provisiona dos estrategias propias). TRUNCATE rechaza CUALQUIER tabla
  // referenciada por una FK aunque esa tabla ya esté vacía — no alcanza con
  // vaciar las tablas hijas antes, también hay que usar DELETE (no .clear())
  // sobre "users" mismo.
  const clearUsers = async () => {
    await dataSource.query('DELETE FROM "player_quotes"');
    await dataSource.query('DELETE FROM "valuation_strategies"');
    await dataSource.query('DELETE FROM "users"');
  };

  return {
    app,
    dataSource,
    clearUsers,
    close: () => app.close(),
  };
}
