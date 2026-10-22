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

  it('lista las alertas y solo muestra "Cancelar" para las ACTIVE', () => {
    render(<PlayerAlertsList alerts={mockAlerts} isLoading={false} error={null} onCancel={vi.fn()} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Cancelar/i })).toHaveLength(1);
  });

  it('llama a onCancel con el id de la alerta al tocar Cancelar', async () => {
    const onCancel = vi.fn().mockResolvedValue(undefined);
    render(<PlayerAlertsList alerts={mockAlerts} isLoading={false} error={null} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));

    await waitFor(() => expect(onCancel).toHaveBeenCalledWith('alert-1'));
  });
});
