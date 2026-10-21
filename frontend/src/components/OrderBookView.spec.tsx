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

  it('renderiza el estado vacío cuando no hay órdenes en bids ni en asks (US3)', () => {
    const emptyBook: OrderBookResponseDto = {
      playerId: 'player-empty',
      bids: [],
      asks: [],
    };

    render(<OrderBookView orderBook={emptyBook} isLoading={false} error={null} />);

    expect(
      screen.getByText('No hay órdenes activas en el mercado para este jugador'),
    ).toBeInTheDocument();
  });

  it('renderiza correctamente las columnas de compras (bids) y ventas (asks) con sus cantidades y barras', () => {
    render(<OrderBookView orderBook={mockOrderBook} isLoading={false} error={null} />);

    expect(screen.getByText('Compras (Bids)')).toBeInTheDocument();
    expect(screen.getByText('Ventas (Asks)')).toBeInTheDocument();

    // Compras: $24.50 y $23.00
    expect(screen.getByText('$24.50')).toBeInTheDocument();
    expect(screen.getByText('$23.00')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    // Ventas: $25.00 y $26.50
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$26.50')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    // Barras de profundidad
    const bidBars = screen.getAllByTestId('bid-depth-bar');
    expect(bidBars).toHaveLength(2);

    const askBars = screen.getAllByTestId('ask-depth-bar');
    expect(askBars).toHaveLength(2);

    // Totales de volumen
    expect(screen.getByText('Total: 45 tokens')).toBeInTheDocument();
    expect(screen.getByText('Total: 35 tokens')).toBeInTheDocument();
  });

  it('muestra mensaje informativo cuando un lado está vacío pero el otro tiene órdenes', () => {
    const onlyBidsBook: OrderBookResponseDto = {
      playerId: 'player-bids-only',
      bids: [{ price: '20.00', totalQuantity: 10 }],
      asks: [],
    };

    render(<OrderBookView orderBook={onlyBidsBook} isLoading={false} error={null} />);

    expect(screen.getByText('Sin posturas de venta activas')).toBeInTheDocument();
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

    const reloadButton = screen.getByRole('button', { name: /actualizar/i });
    fireEvent.click(reloadButton);

    expect(handleReload).toHaveBeenCalledTimes(1);
  });
});

