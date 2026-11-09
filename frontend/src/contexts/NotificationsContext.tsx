import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { notificationsService } from '../service/notificationsService';
import type { NotificationResponseDto } from '../types/notifications.types';
import { NotificationsContext } from './notifications-context';

interface NotificationsProviderProps {
  readonly children: ReactNode;
}

/**
 * Combina el listado del servidor con lo que ya está en pantalla sin repetir
 * ids: el listado manda (incluye el estado de lectura) y se conservan, al
 * principio, las que llegaron por push y todavía no figuran en él.
 */
function mergeById(
  fromServer: NotificationResponseDto[],
  current: NotificationResponseDto[],
): NotificationResponseDto[] {
  const knownIds = new Set(fromServer.map((n) => n.id));
  return [...current.filter((n) => !knownIds.has(n.id)), ...fromServer];
}

/**
 * Carga el listado inicial de notificaciones y se suscribe al stream SSE
 * mientras el usuario está autenticado (025-player-price-alerts, spec
 * FR-017, FR-018). Se desmonta la conexión SSE al cerrar sesión.
 *
 * Las notificaciones llegan por push, sin polling ni recarga. Como el stream
 * no reenvía lo que pasó mientras estuvo desconectado, cada vez que se
 * (re)establece la conexión se vuelve a pedir el listado y se fusiona.
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
    const sync = async () => {
      try {
        const result = await notificationsService.listOwn();
        if (isMounted) {
          setNotifications((prev) => mergeById(result, prev));
        }
      } catch {
        /* se conserva lo que ya hay en pantalla; el próximo (re)connect del stream reintenta */
      }
    };
    const load = async () => {
      setIsLoading(true);
      try {
        await sync();
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
      stream.onopen = () => {
        void sync();
      };
      stream.onmessage = (event: MessageEvent) => {
        const notification = JSON.parse(event.data) as NotificationResponseDto;
        setNotifications((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
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
