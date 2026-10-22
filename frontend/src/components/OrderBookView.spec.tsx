import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderBookView } from './OrderBookView';
import type { OrderBookResponseDto } from '../types/orders.types';

describe('OrderBookView', () => {
  const mockOrderBook: OrderBookResponseDto = {
    playerId: 'player-1',
    bids: [
      { price: '24.50', totalQuantity: 15 },
      { price: '23.00', totalQuantity: 30 },
    ],
    asks: [
      { price: '25.00', totalQuantity: 10 },
      { price: '26.50', totalQuantity: 25 },
    ],
  };

  it('renderiza el spinner de carga cuando isLoading es true', () => {
    render(<OrderBookView orderBook={null} isLoading={true} error={null} />);

    expect(screen.getByText('Cargando libro de órdenes...')).toBeInTheDocument();
  });

  it('renderiza el mensaje de error cuando error está presente', () => {
    render(<OrderBookView orderBook={null} isLoading={false} error="Fallo de conexión" />);

    expect(screen.getByText('Fallo de conexión')).toBeInTheDocument();
  });

  it('renderiza el estado vacío cuando no hay órdenes en bids ni en asks', () => {
    const emptyBook: OrderBookResponseDto = { playerId: 'player-empty', bids: [], asks: [] };

    render(<OrderBookView orderBook={emptyBook} isLoading={false} error={null} />);

    expect(
      screen.getByText('No hay órdenes activas en el mercado para este jugador'),
    ).toBeInTheDocument();
  });

  it('renderiza el gráfico de profundidad con todos los niveles de precio', () => {
    render(<OrderBookView orderBook={mockOrderBook} isLoading={false} error={null} />);

    expect(screen.getByText('Profundidad de mercado')).toBeInTheDocument();
    expect(screen.getByText('$24.50')).toBeInTheDocument();
    expect(screen.getByText('$23.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$26.50')).toBeInTheDocument();
    expect(screen.getAllByTestId('bid-depth-bar').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('ask-depth-bar').length).toBeGreaterThan(0);
  });

  it('renderiza el gráfico cuando solo hay órdenes de un lado', () => {
    const onlyBidsBook: OrderBookResponseDto = {
      playerId: 'player-bids-only',
      bids: [{ price: '20.00', totalQuantity: 10 }],
      asks: [],
    };

    render(<OrderBookView orderBook={onlyBidsBook} isLoading={false} error={null} />);

    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('ejecuta el callback onReload cuando se hace clic en el botón Actualizar', () => {
    const handleReload = vi.fn();
    render(
      <OrderBookView
        orderBook={mockOrderBook}
        isLoading={false}
        error={null}
        onReload={handleReload}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(handleReload).toHaveBeenCalledTimes(1);
  });
});
