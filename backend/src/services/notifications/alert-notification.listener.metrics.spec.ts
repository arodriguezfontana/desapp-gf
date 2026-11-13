import { randomUUID } from 'node:crypto';
import { SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { AlertTriggeredEvent } from '../../domain/alerts/events/alert-triggered.event';
import { Notification } from '../../domain/notifications/notification';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { AlertNotificationListener } from './alert-notification.listener';
import { NotificationsService } from './notifications.service';

/** 031-US4: `notifications_created_total{delivery}` se cuenta después de persistir. */
describe('AlertNotificationListener — métricas de negocio', () => {
  let notifications: { persist: jest.Mock; pushToStream: jest.Mock };
  let metrics: BusinessMetricsDouble;
  let listener: AlertNotificationListener;

  const event = () =>
    new AlertTriggeredEvent(randomUUID(), randomUUID(), randomUUID(), AlertCondition.PRICE_BELOW, 8.5, new Date('2026-01-01T00:00:00.000Z'));

  beforeEach(() => {
    notifications = {
      persist: jest.fn(async (n: Notification) => n),
      pushToStream: jest.fn().mockResolvedValue(false),
    };
    metrics = createBusinessMetricsDouble();
    listener = new AlertNotificationListener(
      notifications as unknown as NotificationsService,
      new SequentialIdGenerator('notification'),
      metrics,
    );
  });

  it('usuario conectado: cuenta live', async () => {
    notifications.pushToStream.mockResolvedValue(true);

    await listener.handle(event());

    expect(metrics.recordNotificationCreated).toHaveBeenCalledTimes(1);
    expect(metrics.recordNotificationCreated).toHaveBeenCalledWith('live');
  });

  it('usuario sin conexión: cuenta stored_only', async () => {
    await listener.handle(event());

    expect(metrics.recordNotificationCreated).toHaveBeenCalledWith('stored_only');
  });

  it('si persist falla no cuenta nada y el error se propaga', async () => {
    notifications.persist.mockRejectedValue(new Error('base caída'));

    await expect(listener.handle(event())).rejects.toThrow('base caída');

    expect(metrics.recordNotificationCreated).not.toHaveBeenCalled();
  });

  it('un BusinessMetrics que lanza no altera la entrega', async () => {
    makeBusinessMetricsDoubleThrow(metrics);
    notifications.pushToStream.mockResolvedValue(true);

    await expect(listener.handle(event())).resolves.toBeUndefined();

    expect(notifications.persist).toHaveBeenCalledTimes(1);
    expect(notifications.pushToStream).toHaveBeenCalledTimes(1);
  });
});
