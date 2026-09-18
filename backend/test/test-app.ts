import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserEntity } from '../src/repositories/entities/user.entity';
import { runPlayerCatalogMigrations } from '../src/database/run-player-catalog-migrations';
import { createGlobalValidationPipe } from '../src/shared/validation/global-validation-pipe';

export interface TestContext {
  app: INestApplication;
  dataSource: DataSource;
  close: () => Promise<void>;
  clearUsers: () => Promise<void>;
}

/** Levanta la app real (misma config que producción) para los tests e2e. */
export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(createGlobalValidationPipe());
  await app.init();

  // El esquema (incluida `players`) ya está sincronizado por TypeOrmModule al
  // inicializar la app; recién ahí corre la migration de seed del catálogo,
  // igual que en `main.ts` (research.md §2 de 004-player-catalog).
  await runPlayerCatalogMigrations();

  const dataSource = app.get<DataSource>(DataSource);
  const clearUsers = () => dataSource.getRepository(UserEntity).clear();

  return {
    app,
    dataSource,
    clearUsers,
    close: () => app.close(),
  };
}
