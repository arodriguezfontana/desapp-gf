import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlayerAlertsList } from './PlayerAlertsList';
import type { PriceAlertResponseDto } from '../types/alerts.types';

describe('PlayerAlertsList', () => {
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

  it('muestra un estado de carga', () => {
    render(<PlayerAlertsList alerts={[]} isLoading={true} error={null} onCancel={vi.fn()} />);
    expect(screen.getByText(/Cargando alertas/i)).toBeInTheDocument();
  });

  it('muestra un mensaje de error', () => {
    render(<PlayerAlertsList alerts={[]} isLoading={false} error="Error de red." onCancel={vi.fn()} />);
    expect(screen.getByText('Error de red.')).toBeInTheDocument();
  });

  it('muestra un mensaje de vacío sin alertas', () => {
    render(<PlayerAlertsList alerts={[]} isLoading={false} error={null} onCancel={vi.fn()} />);
    expect(screen.getByText(/Todavía no tenés alertas/i)).toBeInTheDocument();
  });

  it('muestra un mensaje de vacío cuando todas las alertas están CANCELLED', () => {
    render(
      <PlayerAlertsList
        alerts={[mockAlerts[1]]}
        isLoading={false}
        error={null}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/Todavía no tenés alertas/i)).toBeInTheDocument();
  });

  it('solo muestra las alertas ACTIVE como chips, con botón de cancelar', () => {
    render(<PlayerAlertsList alerts={mockAlerts} isLoading={false} error={null} onCancel={vi.fn()} />);

    expect(screen.getByText(/baja de 10/i)).toBeInTheDocument();
    expect(screen.queryByText(/sube de 20/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('llama a onCancel con el id de la alerta al tocar la X', async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(<PlayerAlertsList alerts={mockAlerts} isLoading={false} error={null} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(onCancel).toHaveBeenCalledWith('alert-1'));
  });
});
