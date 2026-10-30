import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { AlertStatus, PriceAlert } from '../../../domain/alerts/price-alert';
import { UserEntity } from '../../auth/entities/user.entity';
import { PlayerEntity } from '../../player/entities/player.entity';
import { PriceAlertEntity } from '../entities/price-alert.entity';
import { PriceAlertMapper } from '../price-alert.mapper';
import { PriceAlertRepository } from '../price-alert.repository';

describe('PriceAlertRepository (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let repository: PriceAlertRepository;
  let dataSource: DataSource;
  let userId: string;
  let playerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PriceAlertEntity, PlayerEntity, UserEntity]),
      ],
      providers: [PriceAlertMapper, PriceAlertRepository],
    }).compile();

    repository = moduleRef.get(PriceAlertRepository);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM "price_alerts"');
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.query('DELETE FROM "users"');
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "price_alerts"');

    userId = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id: userId,
      email: `${userId}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });

    playerId = randomUUID();
    await dataSource.getRepository(PlayerEntity).save({
      id: playerId,
      name: 'Jugador Test',
      league: 'LA_LIGA',
      team: 'Equipo Test',
      position: 'MF',
      externalId: `ws-${playerId}`,
      removedAt: null,
    });
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "price_alerts"');
    await dataSource.query('DELETE FROM "users" WHERE id = $1', [userId]);
    await dataSource.getRepository(PlayerEntity).delete({ id: playerId });
  });

  const makeAlert = (overrides: Partial<Parameters<typeof PriceAlert.create>[0]> = {}) =>
    PriceAlert.create({
      id: randomUUID(),
      userId,
      playerId,
      condition: AlertCondition.PRICE_BELOW,
      targetValue: 12.5,
      createdAt: new Date(),
      ...overrides,
    });

  it('persiste y recupera una alerta, conservando el DECIMAL(10,2) del umbral', async () => {
    const alert = makeAlert({ targetValue: 12.34 });
    await repository.save(alert);

    const found = await repository.findById(alert.id);

    expect(found).not.toBeNull();
    expect(found!.targetValue).toBe(12.34);
    expect(found!.condition).toBe(AlertCondition.PRICE_BELOW);
    expect(found!.status).toBe(AlertStatus.ACTIVE);
  });

  it('findById devuelve null para un id inexistente', async () => {
    expect(await repository.findById(randomUUID())).toBeNull();
  });

  it('findActiveByUserIdAndPlayerId solo devuelve alertas ACTIVE de ese usuario+jugador', async () => {
    const active = makeAlert();
    const cancelled = await repository.save(makeAlert());
    await repository.save(cancelled.cancel());
    await repository.save(active);

    const otherPlayerId = randomUUID();
    await dataSource.getRepository(PlayerEntity).save({
      id: otherPlayerId,
      name: 'Otro jugador',
      league: 'LA_LIGA',
      team: 'Otro equipo',
      position: 'FW',
      externalId: `ws-${otherPlayerId}`,
      removedAt: null,
    });
    await repository.save(makeAlert({ playerId: otherPlayerId }));

    const result = await repository.findActiveByUserIdAndPlayerId(userId, playerId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(active.id);
  });

  it('findAllByUserId devuelve todas las alertas propias (activas y canceladas), más recientes primero', async () => {
    const first = await repository.save(makeAlert({ createdAt: new Date('2026-01-01T00:00:00.000Z') }));
    const second = await repository.save(
      makeAlert({ createdAt: new Date('2026-01-02T00:00:00.000Z') }).cancel(),
    );

    const result = await repository.findAllByUserId(userId);

    expect(result.map((a) => a.id)).toEqual([second.id, first.id]);
  });

  it('un mismo usuario puede tener múltiples alertas activas sobre el mismo jugador (spec FR-003)', async () => {
    await repository.save(makeAlert({ condition: AlertCondition.PRICE_BELOW, targetValue: 10 }));
    await repository.save(makeAlert({ condition: AlertCondition.PRICE_ABOVE, targetValue: 20 }));

    const result = await repository.findActiveByUserIdAndPlayerId(userId, playerId);

    expect(result).toHaveLength(2);
  });
});
