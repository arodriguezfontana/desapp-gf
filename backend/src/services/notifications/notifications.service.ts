import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Notification } from '../../domain/notifications/notification';
import { NotificationNotFoundError } from '../../domain/notifications/errors/notification-not-found.error';
import { NotificationRepository } from '../../repositories/notifications/notification.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { WithPlayerName, withPlayerName } from '../../shared/with-player-name';

/** Notificación enriquecida con el nombre del jugador, resuelto al vuelo (no se denormaliza en la tabla). */
export type NotificationWithPlayerName = WithPlayerName<Notification>;

/**
 * Orquesta la consulta, el marcado de lectura y el push en vivo de
 * notificaciones (025-player-price-alerts, Historia 3). El stream por
 * usuario conectado vive en memoria: no persiste entre instancias del
 * proceso (aceptado en research.md §2 — la bandeja ya cubre el caso de uso
 * cuando el usuario no está conectado).
 */
@Injectable()
export class NotificationsService {
  private readonly streams = new Map<string, Subject<NotificationWithPlayerName>>();

  constructor(
    private readonly notifications: NotificationRepository,
    private readonly players: PlayerRepository,
  ) {}

  /**
   * Resuelve el nombre del jugador al vuelo (sin denormalizarlo en la
   * tabla): la bandeja de notificaciones es para que el usuario sepa de qué
   * jugador se trata y pueda ir a su ficha, no un registro histórico que
   * necesite sobrevivir a un jugador dado de baja del catálogo.
   */
  private async resolvePlayerName(playerId: string): Promise<string> {
    const player = await this.players.findById(playerId);
    return player?.name ?? playerId;
  }

  async listOwn(userId: string, unreadOnly = false): Promise<NotificationWithPlayerName[]> {
    const notifications = await this.notifications.findAllByUserId(userId, unreadOnly);
    const playerIds = [...new Set(notifications.map((notification) => notification.playerId))];
    const names = new Map(
      await Promise.all(
        playerIds.map(async (playerId): Promise<[string, string]> => [playerId, await this.resolvePlayerName(playerId)]),
      ),
    );
    return notifications.map((notification) => withPlayerName(notification, names.get(notification.playerId)!));
  }

  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notifications.findById(notificationId);
    if (!notification?.isOwnedBy(userId)) {
      throw new NotificationNotFoundError();
    }
    return this.notifications.save(notification.markAsRead());
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notifications.markAllAsReadByUserId(userId);
  }

  /** Persiste y es consumido por AlertNotificationListener; no por el controller (spec FR-013). */
  async persist(notification: Notification): Promise<Notification> {
    return this.notifications.save(notification);
  }

  /** Suscribe la conexión SSE de `userId`; se usa desde NotificationsSseController. */
  subscribe(userId: string): Subject<NotificationWithPlayerName> {
    let stream = this.streams.get(userId);
    if (!stream) {
      stream = new Subject<NotificationWithPlayerName>();
      this.streams.set(userId, stream);
    }
    return stream;
  }

  /** Empuja `notification` al stream de su usuario si hay una conexión SSE abierta (spec FR-018). */
  async pushToStream(notification: Notification): Promise<void> {
    const stream = this.streams.get(notification.userId);
    if (!stream) {
      return;
    }
    const playerName = await this.resolvePlayerName(notification.playerId);
    stream.next(withPlayerName(notification, playerName));
  }
}
