import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull } from 'typeorm';

import { DatabaseModule } from '../../database/database.module';
import { Sha256TokenHasher } from '../../adapters/api-key/sha256-token-hasher';
import { API_KEY_REPOSITORY, TOKEN_HASHER } from '../../modules/api-key/api-key.constants';
import { ApiKeyEntity } from '../../repositories/api-key/entities/api-key.entity';
import { UserEntity } from '../../repositories/auth/entities/user.entity';
import { ApiKeyMapper } from '../../repositories/api-key/mappers/api-key.mapper';
import { TypeOrmApiKeyRepository } from '../../repositories/api-key/typeorm-api-key.repository';
import { Email } from '../../domain/auth/email';
import { User } from '../../domain/auth/user';
import { UserRole } from '../../domain/auth/user-role';
import { ApiKeyService } from './api-key.service';

const asUser = (userId: string, role: UserRole = UserRole.USER): User =>
  User.register(userId, Email.create(`${userId}@mail.com`), 'hash-usuario', new Date(), role);

describe('ApiKeyService.issueApiKey (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: ApiKeyService;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([ApiKeyEntity, UserEntity]),
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
    const { apiKey, rawApiKey } = await service.issueApiKey(asUser(userId));

    const row = await dataSource
      .getRepository(ApiKeyEntity)
      .findOneByOrFail({ id: apiKey.id });

    expect(row.keyHash).toHaveLength(64);
    expect(row.keyHash).not.toBe(rawApiKey);
    expect(row.revokedAt).toBeNull();
  });

  it('rota la clave activa: invalida la anterior y deja solo la nueva activa', async () => {
    const userId = randomUUID();
    const first = await service.issueApiKey(asUser(userId));
    const second = await service.issueApiKey(asUser(userId));

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
      service.issueApiKey(asUser(userId)),
      service.issueApiKey(asUser(userId)),
      service.issueApiKey(asUser(userId)),
    ]);

    const activeCount = await dataSource
      .getRepository(ApiKeyEntity)
      .countBy({ userId, revokedAt: IsNull() });

    expect(activeCount).toBe(1);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  });

  describe('rol copiado (spec 008, US3)', () => {
    it('persiste en la fila el rol del emisor en el momento de emitir', async () => {
      const adminId = randomUUID();
      const { apiKey } = await service.issueApiKey(asUser(adminId, UserRole.ADMIN));

      const row = await dataSource.getRepository(ApiKeyEntity).findOneByOrFail({ id: apiKey.id });

      expect(row.role).toBe('admin');
    });

    it('cambiar el rol del usuario después de emitir no modifica la fila de la clave previa', async () => {
      const userId = randomUUID();
      // Fila real en `users`, para que el cambio de rol sea un UPDATE efectivo.
      await dataSource.getRepository(UserEntity).insert({
        id: userId,
        email: `${userId}@mail.com`,
        passwordHash: 'hash-usuario',
        role: 'user',
      });
      const first = await service.issueApiKey(asUser(userId, UserRole.USER));

      // Cambio de rol directo en base: única vía en esta feature.
      await dataSource.getRepository(UserEntity).update({ id: userId }, { role: 'admin' });

      const usersRow = await dataSource.getRepository(UserEntity).findOneByOrFail({ id: userId });
      const previousRow = await dataSource
        .getRepository(ApiKeyEntity)
        .findOneByOrFail({ id: first.apiKey.id });

      expect(usersRow.role).toBe('admin');
      // La clave emitida conserva el rol de la emisión (riesgo aceptado, spec 008).
      expect(previousRow.role).toBe('user');
    });

    it('una rotación posterior a un cambio de rol toma el rol vigente', async () => {
      const userId = randomUUID();
      await service.issueApiKey(asUser(userId, UserRole.USER));
      const rotated = await service.issueApiKey(asUser(userId, UserRole.ADMIN));

      const row = await dataSource.getRepository(ApiKeyEntity).findOneByOrFail({ id: rotated.apiKey.id });
      expect(row.role).toBe('admin');
    });
  });
});
