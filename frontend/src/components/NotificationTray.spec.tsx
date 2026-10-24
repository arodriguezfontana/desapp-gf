import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotificationTray } from './NotificationTray';
import type { NotificationResponseDto } from '../types/notifications.types';

const notification: NotificationResponseDto = {
  id: 'notif-1',
  alertId: 'alert-1',
  playerId: 'player-1',
  playerName: 'Lionel Messi',
  condition: 'PRICE_BELOW',
  triggeredValue: 9.5,
  createdAt: '2026-10-22T00:00:00.000Z',
  read: false,
};

function renderTray(props: Partial<ComponentProps<typeof NotificationTray>> = {}) {
  return render(
    <MemoryRouter>
      <NotificationTray
        notifications={[notification]}
        onMarkAsRead={vi.fn()}
        onMarkAllAsRead={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('NotificationTray', () => {
  it('muestra un mensaje vacío sin notificaciones', () => {
    render(
      <MemoryRouter>
        <NotificationTray notifications={[]} onMarkAsRead={vi.fn()} onMarkAllAsRead={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('No tenés notificaciones todavía.')).toBeInTheDocument();
  });

  it('lista las notificaciones con el nombre del jugador, más recientes primero (orden provisto por el caller)', () => {
    renderTray();
    expect(screen.getByText('Lionel Messi', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/bajó de/)).toBeInTheDocument();
    expect(screen.getByText('9.5')).toBeInTheDocument();
  });

  it('es un link a la ficha del jugador', () => {
    renderTray();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/catalog/player-1');
  });

  it('llama a onMarkAsRead con el id al tocar una notificación no leída', () => {
    const onMarkAsRead = vi.fn();
    renderTray({ onMarkAsRead });
    fireEvent.click(screen.getByRole('link'));
    expect(onMarkAsRead).toHaveBeenCalledWith('notif-1');
  });

  it('no llama a onMarkAsRead al tocar una notificación ya leída', () => {
    const onMarkAsRead = vi.fn();
    renderTray({ notifications: [{ ...notification, read: true }], onMarkAsRead });
    fireEvent.click(screen.getByRole('link'));
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it('llama a onMarkAllAsRead al tocar "Marcar todas como leídas"', () => {
    const onMarkAllAsRead = vi.fn();
    renderTray({ onMarkAllAsRead });
    fireEvent.click(screen.getByText('Marcar todas como leídas'));
    expect(onMarkAllAsRead).toHaveBeenCalled();
  });
});
