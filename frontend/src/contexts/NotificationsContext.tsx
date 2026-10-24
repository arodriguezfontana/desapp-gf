import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationsService } from '../service/notificationsService';
import type { NotificationResponseDto } from '../types/notifications.types';
import { NotificationsContext } from './notifications-context';

interface NotificationsProviderProps {
  readonly children: ReactNode;
}

/**
 * Carga el listado inicial de notificaciones y se suscribe al stream SSE
 * mientras el usuario está autenticado (025-player-price-alerts, spec
 * FR-017, FR-018). Se desmonta la conexión SSE al cerrar sesión.
 */
export function NotificationsProvider({ children }: NotificationsProviderProps) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      streamRef.current?.close();
      streamRef.current = null;
      void Promise.resolve().then(() => { setNotifications([]); });
      return;
    }

    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const result = await notificationsService.listOwn();
        if (isMounted) {
          setNotifications(result);
        }
      } catch {
        /* la bandeja queda vacía; el usuario puede reintentar recargando */
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    void load();

    const stream = notificationsService.openStream();
    streamRef.current = stream;
    if (stream) {
      stream.onmessage = (event: MessageEvent) => {
        const notification = JSON.parse(event.data) as NotificationResponseDto;
        setNotifications((prev) => [notification, ...prev]);
      };
    }

    return () => {
      isMounted = false;
      stream?.close();
      streamRef.current = null;
    };
  }, [isAuthenticated]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await notificationsService.markAsRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationsService.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, isLoading, markAsRead, markAllAsRead }),
    [notifications, unreadCount, isLoading, markAsRead, markAllAsRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
