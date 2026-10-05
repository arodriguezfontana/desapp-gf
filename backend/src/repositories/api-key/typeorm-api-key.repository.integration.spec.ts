import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKeyEntity } from './entities/api-key.entity';
import { ApiKeyMapper } from './mappers/api-key.mapper';
import { TypeOrmApiKeyRepository } from './typeorm-api-key.repository';

describe('TypeOrmApiKeyRepository.findByHash (integración, spec 008 US4)', () => {
  let moduleRef: TestingModule;
  let repo: TypeOrmApiKeyRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ApiKeyEntity]),
      ],
      providers: [ApiKeyMapper, TypeOrmApiKeyRepository],
    }).compile();

    repo = moduleRef.get(TypeOrmApiKeyRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('una clave legacy (insertada sin columna role) se resuelve activa con rol user', async () => {
    // Insert sin `role`: la columna toma el default de la migration.
    const keyId = randomUUID();
    const keyHash = `legacy-${keyId}`.padEnd(64, '0');
    await dataSource.query(
      `INSERT INTO "api_keys" (id, user_id, key_hash) VALUES ($1, $2, $3)`,
      [keyId, randomUUID(), keyHash],
    );

    const apiKey = await repo.findByHash(keyHash);

    expect(apiKey).not.toBeNull();
    expect(apiKey!.isActive()).toBe(true);
    expect(apiKey!.role).toBe(UserRole.USER);
  });

  it('una clave emitida con rol admin se restaura con rol admin', async () => {
    const keyId = randomUUID();
    const keyHash = `admin-${keyId}`.padEnd(64, '1');
    await dataSource.getRepository(ApiKeyEntity).insert({
      id: keyId,
      userId: randomUUID(),
      keyHash,
      role: 'admin',
    });

    const apiKey = await repo.findByHash(keyHash);

    expect(apiKey!.role).toBe(UserRole.ADMIN);
  });
});
