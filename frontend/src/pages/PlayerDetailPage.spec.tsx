import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PlayerDetailPage } from './PlayerDetailPage';
import { apiKeyStorage } from '../service/apiKeyStorage';
import { catalogService } from '../service/catalogService';
import { ApiError, httpEvents } from '../service/httpClient';

describe('PlayerDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(catalogService, 'getMyValuationByPlayerId').mockResolvedValue(null);
    vi.spyOn(catalogService, 'getQuoteHistoryByPlayerId').mockResolvedValue([]);
    vi.spyOn(catalogService, 'getOrderBook').mockResolvedValue({ playerId: 'p-1', bids: [], asks: [] });
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

  it('renderiza todas las métricas de temporada cuando están disponibles', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
      rating: 8.12,
      passesCompleted: 30.5,
      shots: 4.2,
      interceptions: 0.1,
      goals: 27,
      assists: 7,
      keyPasses: 45,
      dribbles: 52,
      totalTackles: 10,
      yellowCards: 4,
      redCards: 1,
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

    expect(screen.getByText('27')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('52')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Goles')).toBeInTheDocument();
    expect(screen.getByText('Asistencias')).toBeInTheDocument();
  });

  it('muestra el valor del token redondeado como número principal cuando hay cotización', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
      rating: 8.12,
    });
    vi.spyOn(catalogService, 'getMyValuationByPlayerId').mockResolvedValueOnce({
      playerId: 'p-1',
      strategyId: 's-1',
      score: 0.712,
      value: 71.52,
      appliedPosition: null,
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

    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('renderiza el gráfico de evolución cuando el jugador tiene historial de cotizaciones (015-player-quote-history, US2)', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });
    vi.spyOn(catalogService, 'getQuoteHistoryByPlayerId').mockResolvedValueOnce([
      { id: 'q-1', playerId: 'p-1', strategyId: 's-1', score: 0.5, value: 50, calculatedAt: '2026-09-01T00:00:00.000Z', appliedPosition: null },
      { id: 'q-2', playerId: 'p-1', strategyId: 's-1', score: 0.7, value: 71, calculatedAt: '2026-09-08T00:00:00.000Z', appliedPosition: null },
    ]);

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

    expect(document.querySelector('svg[aria-label="Tu valuación de este jugador en el tiempo"]')).toBeInTheDocument();
    expect(
      screen.queryByText('Todavía no hay historial de cotizaciones para este jugador.'),
    ).not.toBeInTheDocument();
  });

  it('muestra el estado vacío del historial cuando el jugador no tiene cotizaciones (015-player-quote-history, US2)', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });
    // getQuoteHistoryByPlayerId ya está mockeado a [] por el beforeEach global.

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

    expect(
      screen.getByText('Todavía no hay historial de cotizaciones para este jugador.'),
    ).toBeInTheDocument();
  });

  it('indica que la cotización se calculó con el perfil de posición cuando appliedPosition no es null (014-position-weight-profiles, US4)', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });
    vi.spyOn(catalogService, 'getMyValuationByPlayerId').mockResolvedValueOnce({
      playerId: 'p-1',
      strategyId: 's-1',
      score: 0.712,
      value: 71.52,
      appliedPosition: 'FW',
    });

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Perfil de posición (Delantero)')).toBeInTheDocument();
    });
  });

  it('indica que la cotización se calculó con los pesos generales cuando appliedPosition es null (014-position-weight-profiles, US4)', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });
    vi.spyOn(catalogService, 'getMyValuationByPlayerId').mockResolvedValueOnce({
      playerId: 'p-1',
      strategyId: 's-1',
      score: 0.712,
      value: 71.52,
      appliedPosition: null,
    });

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Pesos generales de la estrategia')).toBeInTheDocument();
    });
  });

  it('no muestra ningún indicador de origen de pesos cuando el jugador no tiene cotización', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });
    // getMyValuationByPlayerId ya está mockeado a null por el beforeEach global.

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

    expect(screen.queryByText('Pesos generales de la estrategia')).not.toBeInTheDocument();
    expect(screen.queryByText(/Perfil de posición/)).not.toBeInTheDocument();
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

  it('muestra el mensaje de un Error genérico devuelto por el servicio', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockRejectedValueOnce(
      new Error('Fallo de red inesperado'),
    );

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Fallo de red inesperado')).toBeInTheDocument();
    });
  });

  it('muestra un mensaje genérico si el error rechazado no es una instancia de Error', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockRejectedValueOnce('fallo desconocido');

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('Error al cargar la información del jugador.'),
      ).toBeInTheDocument();
    });
  });

  it('ante el evento apiKeyUnauthorized muestra el aviso de generar ApiKey', async () => {
    apiKeyStorage.setApiKey('key-caducada');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Jugador 1',
      league: 'La Liga',
      team: 'Real Madrid',
      position: 'MF',
    });

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Jugador 1')).toBeInTheDocument();
    });

    act(() => {
      httpEvents.dispatchEvent(new Event('apiKeyUnauthorized'));
    });

    await waitFor(() => {
      expect(
        screen.getByText('Necesitás generar una ApiKey para ver el catálogo.'),
      ).toBeInTheDocument();
    });
  });

  it('renderiza la sección de profundidad de mercado con el libro de órdenes (024-player-order-book)', async () => {
    apiKeyStorage.setApiKey('valid-key');
    vi.spyOn(catalogService, 'getPlayerById').mockResolvedValueOnce({
      id: 'p-1',
      name: 'Kylian Mbappé',
      league: 'Ligue 1',
      team: 'PSG',
      position: 'FW',
    });
    vi.spyOn(catalogService, 'getOrderBook').mockResolvedValueOnce({
      playerId: 'p-1',
      bids: [{ price: '24.50', totalQuantity: 10 }],
      asks: [{ price: '25.00', totalQuantity: 15 }],
    });

    render(
      <MemoryRouter initialEntries={['/catalog/p-1']}>
        <Routes>
          <Route path="/catalog/:id" element={<PlayerDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Profundidad de Mercado')).toBeInTheDocument();
      expect(screen.getByText('$24.50')).toBeInTheDocument();
      expect(screen.getByText('$25.00')).toBeInTheDocument();
    });
  });
});
