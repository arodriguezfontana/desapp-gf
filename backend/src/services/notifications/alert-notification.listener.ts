import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Notification } from '../../domain/notifications/notification';
import { ALERT_TRIGGERED_EVENT, AlertTriggeredEvent } from '../../domain/alerts/events/alert-triggered.event';
import { NotificationsService } from './notifications.service';

/**
 * Escucha alert.triggered, persiste la Notification correspondiente y la
 * empuja al stream SSE del usuario si está conectado (025-player-price-alerts,
 * spec FR-013, FR-018, FR-021). Independiente de AlertMailListener: no lo
 * conoce ni depende de él.
 */
@Injectable()
export class AlertNotificationListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(ALERT_TRIGGERED_EVENT)
  async handle(event: AlertTriggeredEvent): Promise<void> {
    const notification = Notification.create({
      id: randomUUID(),
      userId: event.userId,
      alertId: event.alertId,
      playerId: event.playerId,
      condition: event.condition,
      triggeredValue: event.triggeredValue,
      createdAt: event.occurredAt,
    });

    const persisted = await this.notifications.persist(notification);
    this.notifications.pushToStream(persisted);
  }
}
