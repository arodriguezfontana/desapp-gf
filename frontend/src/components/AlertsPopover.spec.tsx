import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertsPopover } from './AlertsPopover';
import type { PriceAlertResponseDto } from '../types/alerts.types';

const mockAlerts: PriceAlertResponseDto[] = [
  {
    id: 'alert-1',
    playerId: 'player-1',
    condition: 'PRICE_BELOW',
    targetValue: 10,
    status: 'ACTIVE',
    createdAt: '2026-10-22T00:00:00.000Z',
  },
  {
    id: 'alert-2',
    playerId: 'player-1',
    condition: 'PRICE_ABOVE',
    targetValue: 20,
    status: 'CANCELLED',
    createdAt: '2026-10-21T00:00:00.000Z',
  },
];

function renderPopover(alerts: PriceAlertResponseDto[] = mockAlerts) {
  return render(
    <AlertsPopover
      playerId="player-1"
      alerts={alerts}
      isLoadingAlerts={false}
      alertsError={null}
      onCreate={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

describe('AlertsPopover', () => {
  it('no muestra el formulario ni la lista hasta que se abre', () => {
    renderPopover();
    expect(screen.queryByLabelText(/Crear alerta de precio/i)).not.toBeInTheDocument();
  });

  it('muestra la cantidad de alertas activas como badge', () => {
    renderPopover();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('no muestra badge cuando no hay alertas activas', () => {
    renderPopover([]);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('abre el panel con el formulario y las alertas al tocar el botón', () => {
    renderPopover();

    fireEvent.click(screen.getByRole('button', { name: /Alertas de precio/i }));

    expect(screen.getByLabelText(/Crear alerta de precio/i)).toBeInTheDocument();
    expect(screen.getByText(/baja de 10/i)).toBeInTheDocument();
  });

  it('cierra el panel al tocar "Cerrar"', () => {
    renderPopover();
    fireEvent.click(screen.getByRole('button', { name: /Alertas de precio/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByLabelText(/Crear alerta de precio/i)).not.toBeInTheDocument();
  });
});
