import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlayerDetailPage } from './PlayerDetailPage';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { catalogService } from '../service/catalogService';
import { ApiError } from '../service/httpClient';

describe('PlayerDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('muestra aviso si no existe ApiKey guardada', () => {
    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Necesitás generar una ApiKey para ver el catálogo.'),
    ).toBeInTheDocument();
  });

  it('renderiza la informacion del jugador al encontrarlo exitosamente', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Kylian Mbappé')).toBeInTheDocument();
    });

    expect(screen.getAllByText('PSG').length).toBeGreaterThan(0);
  });

  it('muestra textualmente el mensaje 404 devuelto por el backend sin alterarlo', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockRejectedValueOnce(
      new ApiError(404, 'Jugador con ID p-999 no encontrado en la base de datos.'),
    );

    render(
      <MemoryRouter initialEntries={['/catalog/p-999']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Jugador con ID p-999 no encontrado en la base de datos.'),
      ).toBeInTheDocument();
    });
  });
});

