import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { UserEntity } from '../../modules/auth/repository/entities/user.entity';

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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const dataSource = app.get<DataSource>(DataSource);
  const clearUsers = () => dataSource.getRepository(UserEntity).clear();

  return {
    app,
    dataSource,
    clearUsers,
    close: () => app.close(),
  };
}
