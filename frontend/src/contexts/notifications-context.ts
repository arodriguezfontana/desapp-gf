import { createContext } from 'react';
import type { NotificationResponseDto } from '../types/notifications.types';

export interface NotificationsContextValue {
  notifications: NotificationResponseDto[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);
