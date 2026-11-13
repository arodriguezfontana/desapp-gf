import { randomUUID } from 'node:crypto';
import { AlertCondition } from '../../domain/alerts/alert-condition';
import { Notification } from '../../domain/notifications/notification';
import { NotificationRepository } from '../../repositories/notifications/notification.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { NotificationWithPlayerName, NotificationsService } from './notifications.service';

describe('NotificationsService — push en vivo (unit, con dobles, sin Nest ni DB)', () => {
  let players: { findById: jest.Mock };
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
    players = { findById: jest.fn().mockResolvedValue({ name: 'Lionel Messi' }) };
    service = new NotificationsService(
      {} as unknown as NotificationRepository,
      players as unknown as PlayerRepository,
    );
  });

  it('entrega al usuario conectado la notificación apenas se empuja, con el nombre del jugador', async () => {
    const userId = randomUUID();
    const received: NotificationWithPlayerName[] = [];
    service.subscribe(userId).subscribe((n) => received.push(n));
    const notification = newNotification(userId);

    await service.pushToStream(notification);

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(notification.id);
    expect(received[0].playerName).toBe('Lionel Messi');
  });

  it('no entrega la notificación a la conexión de otro usuario', async () => {
    const userId = randomUUID();
    const otherReceived: NotificationWithPlayerName[] = [];
    service.subscribe(randomUUID()).subscribe((n) => otherReceived.push(n));

    await service.pushToStream(newNotification(userId));

    expect(otherReceived).toHaveLength(0);
  });

  it('la entrega a todas las conexiones abiertas del mismo usuario (por ejemplo, varias pestañas)', async () => {
    const userId = randomUUID();
    const tabA: NotificationWithPlayerName[] = [];
    const tabB: NotificationWithPlayerName[] = [];
    service.subscribe(userId).subscribe((n) => tabA.push(n));
    service.subscribe(userId).subscribe((n) => tabB.push(n));

    await service.pushToStream(newNotification(userId));

    expect(tabA).toHaveLength(1);
    expect(tabB).toHaveLength(1);
  });

  it('si el usuario no tiene ninguna conexión abierta no hace nada (la bandeja ya la guardó)', async () => {
    await expect(service.pushToStream(newNotification(randomUUID()))).resolves.toBe(false);

    expect(players.findById).not.toHaveBeenCalled();
  });
});
