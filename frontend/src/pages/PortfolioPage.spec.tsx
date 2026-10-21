import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PortfolioPage } from './PortfolioPage';
import * as usePortfolioModule from '../hooks/usePortfolio';
import * as useUserOrdersModule from '../hooks/useUserOrders';
import * as useOrderHistoryModule from '../hooks/useOrderHistory';

vi.mock('../hooks/usePortfolio');
vi.mock('../hooks/useUserOrders');
vi.mock('../hooks/useOrderHistory');

describe('PortfolioPage', () => {
  const mockRefetch = vi.fn();
  const mockCancelOrder = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRefetch.mockReset();
    mockCancelOrder.mockReset();

    vi.spyOn(useOrderHistoryModule, 'useOrderHistory').mockReturnValue({
      transactions: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.spyOn(useUserOrdersModule, 'useUserOrders').mockReturnValue({
      orders: [],
      isLoading: false,
      cancellingOrderId: null,
      error: null,
      refetch: vi.fn(),
      cancelOrder: mockCancelOrder,
    });
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
    expect(screen.getByRole('region', { name: 'Mis órdenes' })).toBeInTheDocument();
  });

  it('renderiza resumen, holdings y sección de mis órdenes cuando el usuario posee posiciones', () => {
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

    vi.spyOn(useUserOrdersModule, 'useUserOrders').mockReturnValue({
      orders: [
        {
          id: 'order-1',
          side: 'SELL',
          playerId: 'p1',
          quantity: 5,
          remainingQuantity: 5,
          price: '135.00',
          status: 'PENDING',
          createdAt: '2026-10-21T10:00:00.000Z',
          fills: [],
        },
      ],
      isLoading: false,
      cancellingOrderId: null,
      error: null,
      refetch: vi.fn(),
      cancelOrder: mockCancelOrder,
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
    expect(screen.getByRole('region', { name: 'Mis órdenes' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Cancelar orden order-1').length).toBeGreaterThan(0);
  });

  it('cancela una orden y refresca el portfolio', async () => {
    mockCancelOrder.mockResolvedValue(true);

    vi.spyOn(usePortfolioModule, 'usePortfolio').mockReturnValue({
      data: { holdings: [] },
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
      summary: { totalInvested: 1000, totalCurrentValue: 1300, netProfitLoss: 300 },
      isEmpty: false,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    vi.spyOn(useUserOrdersModule, 'useUserOrders').mockReturnValue({
      orders: [
        {
          id: 'order-1',
          side: 'SELL',
          playerId: 'p1',
          quantity: 5,
          remainingQuantity: 5,
          price: '135.00',
          status: 'PENDING',
          createdAt: '2026-10-21T10:00:00.000Z',
          fills: [],
        },
      ],
      isLoading: false,
      cancellingOrderId: null,
      error: null,
      refetch: vi.fn(),
      cancelOrder: mockCancelOrder,
    });

    render(
      <MemoryRouter>
        <PortfolioPage />
      </MemoryRouter>,
    );

    const cancelButtons = screen.getAllByLabelText('Cancelar orden order-1');
    fireEvent.click(cancelButtons[0]);

    expect(mockCancelOrder).toHaveBeenCalledWith('order-1');
  });
});
