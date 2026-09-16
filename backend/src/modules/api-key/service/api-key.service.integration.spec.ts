import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { Sha256TokenHasher } from '../adapters/sha256-token-hasher';
import { API_KEY_REPOSITORY, TOKEN_HASHER } from '../api-key.constants';
import { ApiKeyEntity } from '../repository/entities/api-key.entity';
import { ApiKeyMapper } from '../repository/mappers/api-key.mapper';
import { TypeOrmApiKeyRepository } from '../repository/typeorm-api-key.repository';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService.issueApiKey (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: ApiKeyService;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ApiKeyEntity]),
      ],
      providers: [
        ApiKeyService,
        ApiKeyMapper,
        { provide: API_KEY_REPOSITORY, useClass: TypeOrmApiKeyRepository },
        { provide: TOKEN_HASHER, useClass: Sha256TokenHasher },
      ],
    }).compile();

    service = moduleRef.get(ApiKeyService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(ApiKeyEntity).clear();
  });

  it('persiste solo el hash de la clave en la base real; el texto plano nunca se escribe', async () => {
    const userId = randomUUID();
    const { apiKey, rawApiKey } = await service.issueApiKey(userId);

    const row = await dataSource
      .getRepository(ApiKeyEntity)
      .findOneByOrFail({ id: apiKey.id });

    expect(row.keyHash).toHaveLength(64);
    expect(row.keyHash).not.toBe(rawApiKey.toPlainText());
    expect(row.revokedAt).toBeNull();
  });

  it('rota la clave activa: invalida la anterior y deja solo la nueva activa', async () => {
    const userId = randomUUID();
    const first = await service.issueApiKey(userId);
    const second = await service.issueApiKey(userId);

    const rows = await dataSource
      .getRepository(ApiKeyEntity)
      .find({ where: { userId } });

    const previousRow = rows.find((r) => r.id === first.apiKey.id);
    const newRow = rows.find((r) => r.id === second.apiKey.id);

    expect(previousRow?.revokedAt).not.toBeNull();
    expect(newRow?.revokedAt).toBeNull();
  });

  it('ante emisiones concurrentes del mismo usuario, el índice parcial único evita más de una clave activa', async () => {
    const userId = randomUUID();
    const results = await Promise.allSettled([
      service.issueApiKey(userId),
      service.issueApiKey(userId),
      service.issueApiKey(userId),
    ]);

    const activeCount = await dataSource
      .getRepository(ApiKeyEntity)
      .countBy({ userId, revokedAt: IsNull() });

    expect(activeCount).toBe(1);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  });
});
