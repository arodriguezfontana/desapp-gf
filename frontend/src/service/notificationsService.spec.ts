import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notificationsService } from './notificationsService';
import { httpClient } from './httpClient';
import { authStorage } from './authStorage';
import type { NotificationResponseDto } from '../types/notifications.types';

describe('notificationsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    authStorage.clearToken();
  });

  const mockNotification: NotificationResponseDto = {
    id: 'notif-1',
    alertId: 'alert-1',
    playerId: 'player-1',
    playerName: 'Lionel Messi',
    condition: 'PRICE_BELOW',
    triggeredValue: 9.5,
    createdAt: '2026-10-22T00:00:00.000Z',
    read: false,
  };

  it('listOwn llama a GET /notifications sin query cuando unreadOnly no se pasa', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce([mockNotification]);

    const result = await notificationsService.listOwn();

    expect(getSpy).toHaveBeenCalledWith('/notifications');
    expect(result).toEqual([mockNotification]);
  });

  it('listOwn(true) llama a GET /notifications?unreadOnly=true', async () => {
    const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce([]);

    await notificationsService.listOwn(true);

    expect(getSpy).toHaveBeenCalledWith('/notifications?unreadOnly=true');
  });

  it('markAsRead llama a PATCH /notifications/:id/read', async () => {
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce(undefined);

    await notificationsService.markAsRead('notif-1');

    expect(patchSpy).toHaveBeenCalledWith('/notifications/notif-1/read');
  });

  it('markAllAsRead llama a PATCH /notifications/read-all', async () => {
    const patchSpy = vi.spyOn(httpClient, 'patch').mockResolvedValueOnce(undefined);

    await notificationsService.markAllAsRead();

    expect(patchSpy).toHaveBeenCalledWith('/notifications/read-all');
  });

  describe('openStream', () => {
    it('devuelve null si no hay JWT', () => {
      authStorage.clearToken();
      expect(notificationsService.openStream()).toBeNull();
    });

    it('abre un EventSource con el token como query param', () => {
      authStorage.setToken('fake-jwt');
      const EventSourceMock = vi.fn();
      vi.stubGlobal('EventSource', EventSourceMock);

      const stream = notificationsService.openStream();

      expect(EventSourceMock).toHaveBeenCalledWith(
        expect.stringContaining('/notifications/stream?token=fake-jwt'),
      );
      expect(stream).toBeInstanceOf(EventSourceMock);
    });
  });
});
