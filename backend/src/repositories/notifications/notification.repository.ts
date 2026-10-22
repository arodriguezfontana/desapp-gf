import { Notification } from '../../domain/notifications/notification';

/**
 * Puerto de dominio para la persistencia de Notification
 * (025-player-price-alerts). Token: NOTIFICATION_REPOSITORY.
 */
export interface NotificationRepository {
  save(notification: Notification): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;

  /** Notificaciones propias del usuario, más recientes primero (spec FR-014). */
  findAllByUserId(userId: string, unreadOnly?: boolean): Promise<Notification[]>;

  markAllAsReadByUserId(userId: string): Promise<void>;
}
