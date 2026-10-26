import { Inject, Injectable } from '@nestjs/common';
import { IdGenerator } from '../../adapters/runtime/id-generator';
import { ID_GENERATOR } from '../../modules/runtime/runtime.constants';
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
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  @OnEvent(ALERT_TRIGGERED_EVENT)
  async handle(event: AlertTriggeredEvent): Promise<void> {
    const notification = Notification.create({
      id: this.ids.generate(),
      userId: event.userId,
      alertId: event.alertId,
      playerId: event.playerId,
      condition: event.condition,
      triggeredValue: event.triggeredValue,
      createdAt: event.occurredAt,
    });

    const persisted = await this.notifications.persist(notification);
    await this.notifications.pushToStream(persisted);
  }
}
