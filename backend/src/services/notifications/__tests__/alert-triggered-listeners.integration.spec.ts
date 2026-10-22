import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DatabaseModule } from '../../../database/database.module';
import { NOTIFICATION_REPOSITORY } from '../../../modules/notifications/notifications.constants';
import { MAIL_ADAPTER } from '../../../modules/mail/mail.constants';
import { USER_REPOSITORY } from '../../../modules/auth/auth.constants';

import { NotificationEntity } from '../../../repositories/notifications/entities/notification.entity';
import { UserEntity } from '../../../repositories/auth/entities/user.entity';

import { NotificationMapper } from '../../../repositories/notifications/notification.mapper';
import { TypeOrmNotificationRepository } from '../../../repositories/notifications/typeorm-notification.repository';
import { UserMapper } from '../../../repositories/auth/mappers/user.mapper';
import { TypeOrmUserRepository } from '../../../repositories/auth/typeorm-user.repository';

import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { ALERT_TRIGGERED_EVENT, AlertTriggeredEvent } from '../../../domain/alerts/events/alert-triggered.event';

import { NotificationsService } from '../notifications.service';
import { AlertNotificationListener } from '../alert-notification.listener';
import { AlertMailListener } from '../alert-mail.listener';

describe('AlertNotificationListener + AlertMailListener (integración: independencia entre listeners)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let eventEmitter: EventEmitter2;
  let notificationsService: NotificationsService;
  let app: { close: () => Promise<void> };
  let userId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventEmitterModule.forRoot(),
        DatabaseModule,
        TypeOrmModule.forFeature([NotificationEntity, UserEntity]),
      ],
      providers: [
        NotificationsService,
        NotificationMapper,
        UserMapper,
        AlertNotificationListener,
        AlertMailListener,
        { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
        { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
        {
          provide: MAIL_ADAPTER,
          useValue: { sendAlertTriggeredMail: jest.fn().mockRejectedValue(new Error('SMTP caído')) },
        },
      ],
    }).compile();

    // EventEmitterModule registra los @OnEvent en onApplicationBootstrap, que
    // solo corre si se inicializa la app (no alcanza con moduleRef.compile()).
    const nestApp = moduleRef.createNestApplication();
    await nestApp.init();
    app = nestApp;

    eventEmitter = moduleRef.get(EventEmitter2);
    notificationsService = moduleRef.get(NotificationsService);
    dataSource = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    await moduleRef.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "notifications"');
    userId = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id: userId,
      email: `${userId}@test.local`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1',
      username: 'test-user',
    });
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "notifications"');
    await dataSource.query('DELETE FROM "users" WHERE id = $1', [userId]);
  });

  it('un AlertMailListener que falla no impide que AlertNotificationListener persista la Notification (spec FR-020, FR-021)', async () => {
    const alertId = randomUUID();
    const playerId = randomUUID();
    const event = new AlertTriggeredEvent(alertId, userId, playerId, AlertCondition.PRICE_BELOW, 7.5, new Date());

    // emit() (no emitAsync): fire-and-forget, igual que en producción — ningún
    // emisor espera a los listeners de alert.triggered (spec FR-021). Se
    // espera un tick para que ambos listeners async terminen su propio ciclo.
    eventEmitter.emit(ALERT_TRIGGERED_EVENT, event);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const notifications = await notificationsService.listOwn(userId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].alertId).toBe(alertId);
  });
});
