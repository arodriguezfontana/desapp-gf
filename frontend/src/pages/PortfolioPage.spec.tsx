import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortfolioPage } from './PortfolioPage';
import * as usePortfolioModule from '../hooks/usePortfolio';

vi.mock('../hooks/usePortfolio');

describe('PortfolioPage', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRefetch.mockReset();
  });

  it('muestra spinner durante el estado de carga', () => {
    vi.spyOn(usePortfolioModule, 'usePortfolio').mockReturnValue({
      data: null,
      holdings: [],
      summary: { totalInvested: 0, totalCurrentValue: 0, netProfitLoss: 0 },
      isEmpty: true,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Cargando datos de tu portfolio...')).toBeInTheDocument();
  });

  it('muestra banner de error y botón de reintento ante fallas', () => {
    vi.spyOn(usePortfolioModule, 'usePortfolio').mockReturnValue({
      data: null,
      holdings: [],
      summary: { totalInvested: 0, totalCurrentValue: 0, netProfitLoss: 0 },
      isEmpty: false,
      isLoading: false,
      error: 'Error de conexión con el servidor',
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Error de conexión con el servidor')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /reintentar consulta/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('muestra estado vacío amigable y botón CTA a /catalog cuando no hay tokens', () => {
    vi.spyOn(usePortfolioModule, 'usePortfolio').mockReturnValue({
      data: { holdings: [] },
      holdings: [],
      summary: { totalInvested: 0, totalCurrentValue: 0, netProfitLoss: 0 },
      isEmpty: true,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Aún no tienes tokens en tu portfolio')).toBeInTheDocument();
    const ctaLink = screen.getByRole('link', { name: /explorar catálogo de jugadores/i });
    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute('href', '/catalog');
  });

  it('renderiza resumen y detalle de holdings cuando el usuario posee posiciones', () => {
    vi.spyOn(usePortfolioModule, 'usePortfolio').mockReturnValue({
      data: {
        holdings: [
          {
            playerId: 'p1',
            playerName: 'Vinicius Jr',
            tokenQuantity: 10,
            averageBuyPrice: 100,
            currentPrice: 130,
            totalProfitLoss: 300,
          },
        ],
      },
      holdings: [
        {
          playerId: 'p1',
          playerName: 'Vinicius Jr',
          tokenQuantity: 10,
          averageBuyPrice: 100,
          currentPrice: 130,
          totalProfitLoss: 300,
        },
      ],
      summary: {
        totalInvested: 1000,
        totalCurrentValue: 1300,
        netProfitLoss: 300,
      },
      isEmpty: false,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Capital Total Invertido')).toBeInTheDocument();
    expect(screen.getByText('Valor Actual de Cartera')).toBeInTheDocument();
    expect(screen.getByText('Mis Posiciones (1)')).toBeInTheDocument();
    expect(screen.getAllByText('Vinicius Jr').length).toBeGreaterThan(0);
  });
});

