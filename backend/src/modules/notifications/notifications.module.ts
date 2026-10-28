import { forwardRef, Module } from '@nestjs/common';
import { RuntimeModule } from '../runtime/runtime.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { NotificationsController } from '../../controllers/notifications/notifications.controller';
import { NotificationsSseController } from '../../controllers/notifications/notifications-sse.controller';
import { NotificationEntity } from '../../repositories/notifications/entities/notification.entity';
import { NotificationMapper } from '../../repositories/notifications/notification.mapper';
import { TypeOrmNotificationRepository } from '../../repositories/notifications/typeorm-notification.repository';
import { NotificationsService } from '../../services/notifications/notifications.service';
import { AlertNotificationListener } from '../../services/notifications/alert-notification.listener';
import { SseJwtAuthGuard } from '../../guards/auth/sse-jwt-auth.guard';
import { NOTIFICATION_REPOSITORY } from './notifications.constants';

/**
 * Módulo de notificaciones (025-player-price-alerts). Registra el listener de
 * alert.triggered: AlertNotificationListener (bandeja + push SSE).
 */
@Module({
  imports: [RuntimeModule, AuthModule, forwardRef(() => PlayerModule), TypeOrmModule.forFeature([NotificationEntity])],
  controllers: [NotificationsController, NotificationsSseController],
  providers: [
    NotificationsService,
    NotificationMapper,
    AlertNotificationListener,
    SseJwtAuthGuard,
    { provide: NOTIFICATION_REPOSITORY, useClass: TypeOrmNotificationRepository },
  ],
})
export class NotificationsModule {}
