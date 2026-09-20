import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogPage } from './CatalogPage';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { catalogService } from '../service/catalogService';
import { httpEvents } from '../service/httpClient';

describe('CatalogPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('muestra el aviso y el enlace a /account si no hay ApiKey guardada', () => {
    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Necesitás generar una ApiKey para ver el catálogo.'),
    ).toBeInTheDocument();

    const link = screen.getByRole('link', {
      name: /Ir a Mi Cuenta para generar ApiKey/i,
    });
    expect(link).toHaveAttribute('href', '/account');
  });

  it('renderiza la lista de jugadores cuando existe una ApiKey guardada', async () => {
    apiKeyStorage.setApiKey('test-key-123');

    vi.spyOn(catalogService, 'getPlayers').mockResolvedValueOnce({
      data: [
        {
          id: 'p-10',
          name: 'Lionel Messi',
          league: 'Ligue 1',
          team: 'PSG',
          position: 'FW',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Lionel Messi')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Ligue 1').length).toBeGreaterThan(0);
    expect(screen.getByText('PSG')).toBeInTheDocument();
  });

  it('muestra "No se encontraron jugadores con estos filtros." cuando el backend responde 200 con lista vacia', async () => {
    apiKeyStorage.setApiKey('test-key-123');

    vi.spyOn(catalogService, 'getPlayers').mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 0 },
    });

    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No se encontraron jugadores con estos filtros.'),
      ).toBeInTheDocument();
    });
  });

  it('ante el evento apiKeyUnauthorized muestra el aviso de generar ApiKey', async () => {
    apiKeyStorage.setApiKey('key-caducada');

    vi.spyOn(catalogService, 'getPlayers').mockResolvedValueOnce({
      data: [
        {
          id: 'p-1',
          name: 'Jugador 1',
          league: 'La Liga',
          team: 'Real Madrid',
          position: 'MF',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Jugador 1')).toBeInTheDocument();
    });

    // Simular recepción de evento 401 en ApiKey
    act(() => {
      httpEvents.dispatchEvent(new Event('apiKeyUnauthorized'));
    });

    await waitFor(() => {
      expect(
        screen.getByText('Necesitás generar una ApiKey para ver el catálogo.'),
      ).toBeInTheDocument();
    });
  });
});

