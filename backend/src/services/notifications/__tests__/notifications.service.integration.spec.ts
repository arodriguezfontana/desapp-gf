import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { NOTIFICATION_REPOSITORY } from '../../../modules/notifications/notifications.constants';
import { PRICE_ALERT_REPOSITORY } from '../../../modules/alerts/alerts.constants';
import { PLAYER_REPOSITORY } from '../../../modules/player/player.constants';

import { NotificationEntity } from '../../../repositories/notifications/entities/notification.entity';
import { PriceAlertEntity } from '../../../repositories/alerts/entities/price-alert.entity';
import { PlayerEntity } from '../../../repositories/player/entities/player.entity';
import { UserEntity } from '../../../repositories/auth/entities/user.entity';

import { NotificationMapper } from '../../../repositories/notifications/notification.mapper';
import { PriceAlertMapper } from '../../../repositories/alerts/price-alert.mapper';

import { TypeOrmNotificationRepository } from '../../../repositories/notifications/typeorm-notification.repository';
import { TypeOrmPriceAlertRepository } from '../../../repositories/alerts/typeorm-price-alert.repository';

import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { PriceAlert } from '../../../domain/alerts/price-alert';
import { Notification } from '../../../domain/notifications/notification';
import { NotificationNotFoundError } from '../../../domain/notifications/errors/notification-not-found.error';

import { NotificationsService } from '../notifications.service';

describe('NotificationsService (integración contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let service: NotificationsService;
  let dataSource: DataSource;
  let userIdA: string;
  let userIdB: string;
  let alertId: string;
  let playerId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        TypeOrmModule.forFeature([NotificationEntity, PriceAlertEntity, PlayerEntity, UserEntity]),
      ],
      providers: [
        NotificationsService,
        NotificationMapper,
        PriceAlertMapper,
        { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
        { provide: PRICE_ALERT_REPOSITORY, useClass: TypeOrmPriceAlertRepository },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
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
    await dataSource.query('DELETE FROM "notifications"');
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

    const alertsRepo = moduleRef.get<TypeOrmPriceAlertRepository>(PRICE_ALERT_REPOSITORY);
    const alert = await alertsRepo.save(
      PriceAlert.create({
        id: randomUUID(),
        userId: userIdA,
        playerId,
        condition: AlertCondition.PRICE_BELOW,
        targetValue: 10,
        createdAt: new Date(),
      }),
    );
    alertId = alert.id;
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "notifications"');
    await dataSource.query('DELETE FROM "price_alerts"');
    await dataSource.getRepository(PlayerEntity).clear();
    await dataSource.query('DELETE FROM "users"');
  });

  const makeNotification = (overrides: Partial<Parameters<typeof Notification.create>[0]> = {}) =>
    Notification.create({
      id: randomUUID(),
      userId: userIdA,
      alertId,
      playerId,
      condition: AlertCondition.PRICE_BELOW,
      triggeredValue: 8.5,
      createdAt: new Date(),
      ...overrides,
    });

  describe('persist() + listOwn()', () => {
    it('persiste y devuelve únicamente las notificaciones propias del usuario', async () => {
      await service.persist(makeNotification());
      await service.persist(makeNotification({ userId: userIdB }));

      const ownNotifications = await service.listOwn(userIdA);

      expect(ownNotifications).toHaveLength(1);
      expect(ownNotifications[0].userId).toBe(userIdA);
    });

    it('devuelve las notificaciones ordenadas por createdAt descendente (más reciente primero)', async () => {
      const older = await service.persist(makeNotification({ createdAt: new Date('2026-01-01T00:00:00.000Z') }));
      const newer = await service.persist(makeNotification({ createdAt: new Date('2026-01-02T00:00:00.000Z') }));

      const result = await service.listOwn(userIdA);

      expect(result.map((n) => n.id)).toEqual([newer.id, older.id]);
    });

    it('unreadOnly=true devuelve solo las no leídas', async () => {
      const unread = await service.persist(makeNotification());
      const readOne = await service.persist(makeNotification());
      await service.markAsRead(userIdA, readOne.id);

      const result = await service.listOwn(userIdA, true);

      expect(result.map((n) => n.id)).toEqual([unread.id]);
    });
  });

  describe('markAsRead()', () => {
    it('marca una notificación propia como leída', async () => {
      const notification = await service.persist(makeNotification());

      const updated = await service.markAsRead(userIdA, notification.id);

      expect(updated.read).toBe(true);
    });

    it('lanza NotificationNotFoundError al intentar marcar una notificación de otro usuario', async () => {
      const notification = await service.persist(makeNotification({ userId: userIdB }));

      await expect(service.markAsRead(userIdA, notification.id)).rejects.toBeInstanceOf(
        NotificationNotFoundError,
      );
    });
  });

  describe('markAllAsRead()', () => {
    it('marca todas las no leídas del usuario y no afecta las de otro usuario', async () => {
      await service.persist(makeNotification());
      await service.persist(makeNotification());
      const otherUserNotification = await service.persist(makeNotification({ userId: userIdB }));

      await service.markAllAsRead(userIdA);

      const ownAfter = await service.listOwn(userIdA);
      expect(ownAfter.every((n) => n.read)).toBe(true);

      const otherAfter = await service.listOwn(userIdB);
      expect(otherAfter.find((n) => n.id === otherUserNotification.id)!.read).toBe(false);
    });
  });
});
