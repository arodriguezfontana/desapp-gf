import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationsProvider } from '../contexts/NotificationsContext';
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

function renderBell() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <NotificationsProvider>
          <NotificationBell />
        </NotificationsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.clear();
    authStorage.setToken('token-1');
    vi.spyOn(notificationsService, 'openStream').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el contador de no leídas', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([mockNotification]);
    renderBell();

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('no muestra contador si no hay notificaciones no leídas', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([]);
    renderBell();

    await waitFor(() => expect(screen.getByLabelText('Notificaciones')).toBeInTheDocument());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('abre la bandeja al tocar la campanita', async () => {
    vi.spyOn(notificationsService, 'listOwn').mockResolvedValueOnce([mockNotification]);
    renderBell();

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Notificaciones'));

    expect(screen.getByText(/bajó de/)).toBeInTheDocument();
  });
});
