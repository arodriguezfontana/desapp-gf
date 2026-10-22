import { useContext } from 'react';
import { NotificationsContext, type NotificationsContextValue } from '../contexts/notifications-context';

/** Hook de acceso al contexto de notificaciones (025-player-price-alerts). */
export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications debe usarse dentro de <NotificationsProvider>.');
  }
  return ctx;
}
