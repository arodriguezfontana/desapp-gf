import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { PRICE_ALERT_REPOSITORY } from '../../../modules/alerts/alerts.constants';
import { PLAYER_REPOSITORY } from '../../../modules/player/player.constants';

import { PriceAlertEntity } from '../../../repositories/alerts/entities/price-alert.entity';
import { PlayerEntity } from '../../../repositories/player/entities/player.entity';
import { UserEntity } from '../../../repositories/auth/entities/user.entity';

import { PriceAlertMapper } from '../../../repositories/alerts/price-alert.mapper';
import { PlayerMapper } from '../../../repositories/player/mappers/player.mapper';

import { TypeOrmPriceAlertRepository } from '../../../repositories/alerts/typeorm-price-alert.repository';
import { TypeOrmPlayerRepository } from '../../../repositories/player/typeorm-player.repository';

import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { AlertStatus } from '../../../domain/alerts/price-alert';
import { InvalidAlertThresholdError } from '../../../domain/alerts/errors/invalid-alert-threshold.error';
import { InvalidAlertConditionError } from '../../../domain/alerts/errors/invalid-alert-condition.error';
import { AlertNotFoundError } from '../../../domain/alerts/errors/alert-not-found.error';
import { DuplicateAlertError } from '../../../domain/alerts/errors/duplicate-alert.error';
import { PlayerNotFoundError } from '../../../domain/player/errors/player-not-found.error';

import { AlertsService } from '../alerts.service';

describe('AlertsService (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: AlertsService;
  let dataSource: DataSource;
  let userIdA: string;
  let userIdB: string;
  let playerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([PriceAlertEntity, PlayerEntity, UserEntity]),
      ],
      providers: [
        AlertsService,
        PriceAlertMapper,
        PlayerMapper,
        { provide: PRICE_ALERT_REPOSITORY, useClass: TypeOrmPriceAlertRepository },
        { provide: PLAYER_REPOSITORY, useClass: TypeOrmPlayerRepository },
      ],
    }).compile();

    service = moduleRef.get(AlertsService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  const insertUser = async (): Promise<string> => {
    const id = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id,
      email: `${id}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });
    return id;
  };

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "price_alerts"');
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.query('DELETE FROM "users"');

    userIdA = await insertUser();
    userIdB = await insertUser();

    playerId = randomUUID();
    await dataSource.getRepository(PlayerEntity).save({
      id: playerId,
      name: 'Jugador Test',
      league: 'Premier League',
      team: 'Test FC',
      position: 'FW',
    });
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "price_alerts"');
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.query('DELETE FROM "users"');
  });

  describe('create()', () => {
    it('crea la alerta en estado ACTIVE si el jugador existe y los datos son válidos', async () => {
      const alert = await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);

      expect(alert.status).toBe(AlertStatus.ACTIVE);
      expect(alert.userId).toBe(userIdA);
      expect(alert.playerId).toBe(playerId);
    });

    it('lanza PlayerNotFoundError si el jugador no existe', async () => {
      await expect(
        service.create(userIdA, randomUUID(), AlertCondition.PRICE_BELOW, 10),
      ).rejects.toBeInstanceOf(PlayerNotFoundError);
    });

    it('propaga InvalidAlertThresholdError del dominio si el umbral no es positivo', async () => {
      await expect(
        service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, -5),
      ).rejects.toBeInstanceOf(InvalidAlertThresholdError);
    });

    it('propaga InvalidAlertConditionError del dominio si la condición no es válida', async () => {
      await expect(
        service.create(userIdA, playerId, 'NOT_A_CONDITION' as AlertCondition, 10),
      ).rejects.toBeInstanceOf(InvalidAlertConditionError);
    });

    it('permite múltiples alertas activas del mismo usuario sobre el mismo jugador con condición o umbral distintos (spec FR-003)', async () => {
      await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);
      await service.create(userIdA, playerId, AlertCondition.PRICE_ABOVE, 20);

      const alerts = await service.listOwn(userIdA);
      expect(alerts).toHaveLength(2);
    });

    it('lanza DuplicateAlertError si ya existe una alerta activa idéntica (mismo jugador, condición y umbral)', async () => {
      await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);

      await expect(
        service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10),
      ).rejects.toBeInstanceOf(DuplicateAlertError);
    });

    it('permite recrear la misma alerta si la anterior ya fue cancelada', async () => {
      const first = await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);
      await service.cancel(userIdA, first.id);

      const second = await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);

      expect(second.status).toBe(AlertStatus.ACTIVE);
    });

    it('permite que dos usuarios distintos tengan la misma alerta sobre el mismo jugador', async () => {
      await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);

      await expect(
        service.create(userIdB, playerId, AlertCondition.PRICE_BELOW, 10),
      ).resolves.toBeDefined();
    });
  });

  describe('listOwn()', () => {
    it('devuelve únicamente las alertas propias, nunca las de otro usuario', async () => {
      await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);
      await service.create(userIdB, playerId, AlertCondition.PRICE_ABOVE, 20);

      const resultA = await service.listOwn(userIdA);
      const resultB = await service.listOwn(userIdB);

      expect(resultA).toHaveLength(1);
      expect(resultB).toHaveLength(1);
      expect(resultA[0].userId).toBe(userIdA);
      expect(resultB[0].userId).toBe(userIdB);
    });
  });

  describe('cancel()', () => {
    it('cancela una alerta propia', async () => {
      const alert = await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);

      const cancelled = await service.cancel(userIdA, alert.id);

      expect(cancelled.status).toBe(AlertStatus.CANCELLED);
    });

    it('lanza AlertNotFoundError al intentar cancelar una alerta de otro usuario', async () => {
      const alert = await service.create(userIdB, playerId, AlertCondition.PRICE_BELOW, 10);

      await expect(service.cancel(userIdA, alert.id)).rejects.toBeInstanceOf(AlertNotFoundError);
    });

    it('lanza AlertNotFoundError para un id inexistente', async () => {
      await expect(service.cancel(userIdA, randomUUID())).rejects.toBeInstanceOf(AlertNotFoundError);
    });

    it('cancelar una alerta ya cancelada es idempotente, no lanza error', async () => {
      const alert = await service.create(userIdA, playerId, AlertCondition.PRICE_BELOW, 10);
      await service.cancel(userIdA, alert.id);

      const cancelledAgain = await service.cancel(userIdA, alert.id);

      expect(cancelledAgain.status).toBe(AlertStatus.CANCELLED);
    });
  });
});
