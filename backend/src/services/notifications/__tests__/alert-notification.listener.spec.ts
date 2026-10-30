import { randomUUID } from 'node:crypto';
import { SequentialIdGenerator } from '../../../adapters/runtime/fake-runtime';
import { AlertCondition } from '../../../domain/alerts/alert-condition';
import { AlertTriggeredEvent } from '../../../domain/alerts/events/alert-triggered.event';
import { Notification } from '../../../domain/notifications/notification';
import { NotificationsService } from '../notifications.service';
import { AlertNotificationListener } from '../alert-notification.listener';

describe('AlertNotificationListener (unit, con dobles, sin Nest ni DB)', () => {
  let notifications: jest.Mocked<Pick<NotificationsService, 'persist' | 'pushToStream'>>;
  let listener: AlertNotificationListener;

  beforeEach(() => {
    notifications = {
      persist: jest.fn(async (n: Notification) => n),
      pushToStream: jest.fn(),
    };
    listener = new AlertNotificationListener(
      notifications as unknown as NotificationsService,
      new SequentialIdGenerator('notification'),
    );
  });

  it('persiste una Notification construida a partir del AlertTriggeredEvent', async () => {
    const event = new AlertTriggeredEvent(
      randomUUID(),
      randomUUID(),
      randomUUID(),
      AlertCondition.PRICE_BELOW,
      8.5,
      new Date('2026-01-01T00:00:00.000Z'),
    );

    await listener.handle(event);

    expect(notifications.persist).toHaveBeenCalledTimes(1);
    const [persisted] = notifications.persist.mock.calls[0] as [Notification];
    expect(persisted.alertId).toBe(event.alertId);
    expect(persisted.userId).toBe(event.userId);
    expect(persisted.playerId).toBe(event.playerId);
    expect(persisted.condition).toBe(event.condition);
    expect(persisted.triggeredValue).toBe(event.triggeredValue);
    expect(persisted.read).toBe(false);
  });

  it('empuja la notificación persistida al stream SSE del usuario', async () => {
    const event = new AlertTriggeredEvent(
      randomUUID(),
      randomUUID(),
      randomUUID(),
      AlertCondition.PRICE_ABOVE,
      30,
      new Date(),
    );

    await listener.handle(event);

    expect(notifications.pushToStream).toHaveBeenCalledTimes(1);
    const [pushed] = notifications.pushToStream.mock.calls[0] as [Notification];
    expect(pushed.userId).toBe(event.userId);
  });
});
