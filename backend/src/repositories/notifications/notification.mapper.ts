import { Injectable } from '@nestjs/common';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { Notification } from '../../domain/notifications/notification';
import { NotificationEntity } from './entities/notification.entity';

/** Conversión dominio ↔ persistencia. Sin lógica de negocio. */
@Injectable()
export class NotificationMapper {
  toDomain(entity: NotificationEntity): Notification {
    return Notification.restore({
      id: entity.id,
      userId: entity.userId,
      alertId: entity.alertId,
      playerId: entity.playerId,
      condition: entity.condition as AlertCondition,
      triggeredValue: Number.parseFloat(entity.triggeredValue),
      createdAt: entity.createdAt,
      read: entity.read,
    });
  }

  toPersistence(domain: Notification): NotificationEntity {
    const entity = new NotificationEntity();
    entity.id = domain.id;
    entity.userId = domain.userId;
    entity.alertId = domain.alertId;
    entity.playerId = domain.playerId;
    entity.condition = domain.condition;
    entity.triggeredValue = domain.triggeredValue.toString();
    entity.createdAt = domain.createdAt;
    entity.read = domain.read;
    return entity;
  }
}
