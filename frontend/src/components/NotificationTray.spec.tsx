import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationTray } from './NotificationTray';
import type { NotificationResponseDto } from '../types/notifications.types';

const notification: NotificationResponseDto = {
  id: 'notif-1',
  alertId: 'alert-1',
  playerId: 'player-1',
  condition: 'PRICE_BELOW',
  triggeredValue: 9.5,
  createdAt: '2026-10-22T00:00:00.000Z',
  read: false,
};

describe('NotificationTray', () => {
  it('muestra un mensaje vacío sin notificaciones', () => {
    render(<NotificationTray notifications={[]} onMarkAsRead={vi.fn()} onMarkAllAsRead={vi.fn()} />);
    expect(screen.getByText('No tenés notificaciones todavía.')).toBeInTheDocument();
  });

  it('lista las notificaciones, más recientes primero (orden provisto por el caller)', () => {
    render(
      <NotificationTray
        notifications={[notification]}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={vi.fn()}
      />,
    );
    expect(screen.getByText(/bajó de/)).toBeInTheDocument();
    expect(screen.getByText('9.5')).toBeInTheDocument();
  });

  it('llama a onMarkAsRead con el id al tocar una notificación no leída', () => {
    const onMarkAsRead = vi.fn();
    render(
      <NotificationTray notifications={[notification]} onMarkAsRead={onMarkAsRead} onMarkAllAsRead={vi.fn()} />,
    );
    fireEvent.click(screen.getByText(/bajó de/));
    expect(onMarkAsRead).toHaveBeenCalledWith('notif-1');
  });

  it('llama a onMarkAllAsRead al tocar "Marcar todas como leídas"', () => {
    const onMarkAllAsRead = vi.fn();
    render(
      <NotificationTray
        notifications={[notification]}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={onMarkAllAsRead}
      />,
    );
    fireEvent.click(screen.getByText('Marcar todas como leídas'));
    expect(onMarkAllAsRead).toHaveBeenCalled();
  });
});
