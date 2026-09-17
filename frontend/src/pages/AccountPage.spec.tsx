import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountPage } from './AccountPage';
import * as authServiceModule from '../service/authService';

describe('AccountPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('despliega el modal con la ApiKey directamente si no hay clave previa', async () => {
    vi.spyOn(authServiceModule.authService, 'generateApiKey').mockResolvedValueOnce({
      id: 'key-1',
      apiKey: 'pmk_abcdef1234567890abcdef1234567890',
      createdAt: '2026-09-16T12:00:00Z',
    });

    render(<AccountPage />);

    fireEvent.click(screen.getByRole('button', { name: /generar apikey/i }));

    await waitFor(() => {
      expect(screen.getByText(/tu apikey/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('pmk_abcdef1234567890abcdef1234567890')).toBeInTheDocument();
    });

    // Cerrar modal
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByText(/tu apikey/i)).not.toBeInTheDocument();
  });

  it('pide confirmación si ya hay una clave activa y respeta cancelar/confirmar', async () => {
    const generateSpy = vi
      .spyOn(authServiceModule.authService, 'generateApiKey')
      .mockResolvedValue({
        id: 'key-2',
        apiKey: 'pmk_99999999999999999999999999999999',
        createdAt: '2026-09-16T12:00:00Z',
      });

    render(<AccountPage />);

    // Primera generación (sin confirmación)
    fireEvent.click(screen.getByRole('button', { name: /generar apikey/i }));
    await waitFor(() => expect(screen.getByText(/tu apikey/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));

    // Segunda generación (debe pedir confirmación)
    fireEvent.click(screen.getByRole('button', { name: /generar apikey/i }));
    expect(screen.getByText(/¿generar nueva apikey\?/i)).toBeInTheDocument();

    // Cancelar
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByText(/¿generar nueva apikey\?/i)).not.toBeInTheDocument();
    expect(generateSpy).toHaveBeenCalledTimes(1); // solo la primera llamada

    // Clic de nuevo y confirmar
    fireEvent.click(screen.getByRole('button', { name: /generar apikey/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByDisplayValue('pmk_99999999999999999999999999999999')).toBeInTheDocument();
    });
  });

  it('muestra el mensaje de error si generateApiKey falla con un Error', async () => {
    vi.spyOn(authServiceModule.authService, 'generateApiKey').mockRejectedValueOnce(
      new Error('Backend caído'),
    );

    render(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: /generar apikey/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Backend caído');
    });
  });

  it('muestra un mensaje genérico si el error no es una instancia de Error', async () => {
    vi.spyOn(authServiceModule.authService, 'generateApiKey').mockRejectedValueOnce('boom');

    render(<AccountPage />);
    fireEvent.click(screen.getByRole('button', { name: /generar apikey/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error al generar la ApiKey.');
    });
  });
});

