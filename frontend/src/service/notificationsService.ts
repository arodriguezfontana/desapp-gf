import { httpClient } from './httpClient';
import { authStorage } from './authStorage';
import type { NotificationResponseDto } from '../types/notifications.types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

/**
 * Cliente de API para notificaciones (025-player-price-alerts,
 * contracts/notifications-api.md). El stream SSE es la única excepción al
 * JWT por header: EventSource no soporta headers custom, así que el token
 * viaja como query param (research.md §2).
 */
export const notificationsService = {
  async listOwn(unreadOnly = false): Promise<NotificationResponseDto[]> {
    const query = unreadOnly ? '?unreadOnly=true' : '';
    return httpClient.get<NotificationResponseDto[]>(`/notifications${query}`);
  },

  async markAsRead(notificationId: string): Promise<void> {
    await httpClient.patch<void>(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await httpClient.patch<void>('/notifications/read-all');
  },

  /** Abre la conexión SSE del usuario autenticado; null si no hay JWT. */
  openStream(): EventSource | null {
    const token = authStorage.getToken();
    if (!token) {
      return null;
    }
    return new EventSource(`${BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`);
  },
};
