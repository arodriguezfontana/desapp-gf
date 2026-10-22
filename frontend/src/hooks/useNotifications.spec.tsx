import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useNotifications } from './useNotifications';
import { NotificationsProvider } from '../contexts/NotificationsContext';
import { AuthProvider } from '../contexts/AuthContext';
import { notificationsService } from '../service/notificationsService';
import { authStorage } from '../service/authStorage';
import type { NotificationResponseDto } from '../types/notifications.types';

const mockNotification: NotificationResponseDto = {
  id: 'notif-1',
  alertId: 'alert-1',
  playerId: 'player-1',
  condition: 'PRICE_BELOW',
  triggeredValue: 9.5,
  createdAt: '2026-10-22T00:00:00.000Z',
  read: false,
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    authStorage.setToken('token-1');
    vi.spyOn(notificationsService, 'openStream').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lanza un error claro si se usa fuera de <NotificationsProvider>', () => {
    expect(() => renderHook(() => useNotifications())).toThrow(
      'useNotifications debe usarse dentro de <NotificationsProvider>.',
    );
  });

  it('carga el listado inicial de notificaciones al montar', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([mockNotification]);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toEqual([mockNotification]);
    expect(result.current.unreadCount).toBe(1);
  });

  it('markAsRead marca la notificación como leída y baja el contador', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([mockNotification]);
    const markSpy = vi.spyOn(notificationsService, 'markAsRead').mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAsRead('notif-1');
    });

    expect(markSpy).toHaveBeenCalledWith('notif-1');
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].read).toBe(true);
  });

  it('markAllAsRead marca todas como leídas', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([
      mockNotification,
      { ...mockNotification, id: 'notif-2' },
    ]);
    vi.spyOn(notificationsService, 'markAllAsRead').mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('abre el stream SSE y antepone las notificaciones que llegan por push', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([]);
    const fakeStream = { onmessage: null as ((e: MessageEvent) => void) | null, close: vi.fn() };
    vi.spyOn(notificationsService, 'openStream').mockReturnValueOnce(
      fakeStream as unknown as EventSource,
    );

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const pushed: NotificationResponseDto = { ...mockNotification, id: 'notif-push' };
    act(() => {
      fakeStream.onmessage?.({ data: JSON.stringify(pushed) } as MessageEvent);
    });

    expect(result.current.notifications[0]).toEqual(pushed);
  });
});
