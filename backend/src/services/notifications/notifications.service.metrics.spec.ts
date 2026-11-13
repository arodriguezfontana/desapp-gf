import { randomUUID } from 'node:crypto';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { Notification } from '../../domain/notifications/notification';
import { NotificationRepository } from '../../repositories/notifications/notification.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { NotificationsService } from './notifications.service';

/** 031-US4: conexiones SSE abiertas sin desfase y distinción entre "en vivo" y "sólo guardada". */
describe('NotificationsService — conexiones SSE y métricas de negocio', () => {
  let metrics: BusinessMetricsDouble;
  let service: NotificationsService;

  const newNotification = (userId: string): Notification =>
    Notification.create({
      id: randomUUID(),
      userId,
      alertId: randomUUID(),
      playerId: randomUUID(),
      condition: AlertCondition.PRICE_BELOW,
      triggeredValue: 9.5,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

  beforeEach(() => {
    metrics = createBusinessMetricsDouble();
    service = new NotificationsService(
      {} as unknown as NotificationRepository,
      { findById: jest.fn().mockResolvedValue({ name: 'Lionel Messi' }) } as unknown as PlayerRepository,
      metrics,
    );
  });

  const opened = () => metrics.sseConnectionOpened.mock.calls.length;
  const closed = () => metrics.sseConnectionClosed.mock.calls.length;

  it('cuenta la conexión al suscribirse y la descuenta al cancelar la suscripción', () => {
    const subscription = service.subscribe(randomUUID()).subscribe();
    expect(opened()).toBe(1);
    expect(closed()).toBe(0);

    subscription.unsubscribe();

    expect(closed()).toBe(1);
  });

  it('no cuenta nada hasta que alguien se suscribe (la conexión es la suscripción)', () => {
    service.subscribe(randomUUID());

    expect(opened()).toBe(0);
  });

  it('descuenta la conexión también cuando el stream falla', async () => {
    const userId = randomUUID();
    const errors: unknown[] = [];
    service.subscribe(userId).subscribe({ error: (error) => errors.push(error) });
    // Hace fallar el Subject del usuario (cierre abrupto del stream).
    (service as unknown as { streams: Map<string, { error: (e: unknown) => void }> }).streams.get(userId)!.error(new Error('stream roto'));

    expect(errors).toHaveLength(1);
    expect(closed()).toBe(1);
    expect(opened() - closed()).toBe(0);
  });

  it('descuenta la conexión cuando el stream se completa', () => {
    const userId = randomUUID();
    service.subscribe(userId).subscribe();
    (service as unknown as { streams: Map<string, { complete: () => void }> }).streams.get(userId)!.complete();

    expect(closed()).toBe(1);
  });

  it('varias conexiones del mismo usuario cuentan por separado', () => {
    const userId = randomUUID();
    const tabA = service.subscribe(userId).subscribe();
    const tabB = service.subscribe(userId).subscribe();
    expect(opened()).toBe(2);

    tabA.unsubscribe();
    expect(closed()).toBe(1);
    tabB.unsubscribe();
    expect(closed()).toBe(2);
  });

  it('pushToStream devuelve true con una conexión abierta (llegó en vivo)', async () => {
    const userId = randomUUID();
    service.subscribe(userId).subscribe();

    await expect(service.pushToStream(newNotification(userId))).resolves.toBe(true);
  });

  it('pushToStream devuelve false sin conexión (quedó sólo guardada)', async () => {
    await expect(service.pushToStream(newNotification(randomUUID()))).resolves.toBe(false);
  });

  it('tras desconectarse el único cliente, el usuario ya no está conectado aunque el Subject existió', async () => {
    const userId = randomUUID();
    const subscription = service.subscribe(userId).subscribe();
    subscription.unsubscribe();

    await expect(service.pushToStream(newNotification(userId))).resolves.toBe(false);
  });

  it('si queda otra pestaña abierta, sigue conectado', async () => {
    const userId = randomUUID();
    const tabA = service.subscribe(userId).subscribe();
    service.subscribe(userId).subscribe();
    tabA.unsubscribe();

    await expect(service.pushToStream(newNotification(userId))).resolves.toBe(true);
  });

  it('un BusinessMetrics que lanza no impide conectar, desconectar ni entregar', async () => {
    makeBusinessMetricsDoubleThrow(metrics);
    const userId = randomUUID();
    const received: unknown[] = [];

    const subscription = service.subscribe(userId).subscribe((n) => received.push(n));
    await expect(service.pushToStream(newNotification(userId))).resolves.toBe(true);
    expect(() => subscription.unsubscribe()).not.toThrow();

    expect(received).toHaveLength(1);
  });
});
