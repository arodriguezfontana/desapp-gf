import { Inject, Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { Notification } from '../../domain/notifications/notification';
import { NotificationNotFoundError } from '../../domain/notifications/errors/notification-not-found.error';
import { NotificationRepository } from '../../repositories/notifications/notification.repository';
import { NOTIFICATION_REPOSITORY } from '../../modules/notifications/notifications.constants';

/**
 * Orquesta la consulta, el marcado de lectura y el push en vivo de
 * notificaciones (025-player-price-alerts, Historia 3). El stream por
 * usuario conectado vive en memoria: no persiste entre instancias del
 * proceso (aceptado en research.md §2 — la bandeja ya cubre el caso de uso
 * cuando el usuario no está conectado).
 */
@Injectable()
export class NotificationsService {
  private readonly streams = new Map<string, Subject<Notification>>();

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
  ) {}

  async listOwn(userId: string, unreadOnly = false): Promise<Notification[]> {
    return this.notifications.findAllByUserId(userId, unreadOnly);
  }

  async markAsRead(userId: string, notificationId: string): Promise<Notification> {
    const notification = await this.notifications.findById(notificationId);
    if (!notification || !notification.isOwnedBy(userId)) {
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
  subscribe(userId: string): Subject<Notification> {
    let stream = this.streams.get(userId);
    if (!stream) {
      stream = new Subject<Notification>();
      this.streams.set(userId, stream);
    }
    return stream;
  }

  /** Empuja `notification` al stream de su usuario si hay una conexión SSE abierta (spec FR-018). */
  pushToStream(notification: Notification): void {
    this.streams.get(notification.userId)?.next(notification);
  }
}
