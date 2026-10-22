import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateAlertForm } from './CreateAlertForm';

describe('CreateAlertForm', () => {
  it('rechaza un umbral no positivo sin llamar a onCreate', async () => {
    const onCreate = vi.fn();
    render(<CreateAlertForm playerId="player-1" onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/Valor umbral/i), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear alerta/i }));

    await waitFor(() => expect(screen.getByText(/número positivo/i)).toBeInTheDocument());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('llama a onCreate con playerId, condición y umbral numérico', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateAlertForm playerId="player-1" onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('radio', { name: /Sube de/i }));
    fireEvent.change(screen.getByLabelText(/Valor umbral/i), { target: { value: '15.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear alerta/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('player-1', 'PRICE_ABOVE', 15.5));
  });

  it('usa "Baja de" (PRICE_BELOW) como condición por defecto', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateAlertForm playerId="player-1" onCreate={onCreate} />);

    expect(screen.getByRole('radio', { name: /Baja de/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText(/Valor umbral/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear alerta/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('player-1', 'PRICE_BELOW', 10));
  });

  it('muestra el mensaje de error que devuelve onCreate (p. ej. 404)', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('No se encontró el jugador solicitado.'));
    render(<CreateAlertForm playerId="player-1" onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/Valor umbral/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear alerta/i }));

    await waitFor(() => expect(screen.getByText('No se encontró el jugador solicitado.')).toBeInTheDocument());
  });
});
