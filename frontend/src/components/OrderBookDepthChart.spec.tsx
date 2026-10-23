import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderBookDepthChart } from './OrderBookDepthChart';

describe('OrderBookDepthChart', () => {
  it('no renderiza nada cuando no hay bids ni asks', () => {
    const { container } = render(<OrderBookDepthChart bids={[]} asks={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra una fila por nivel de precio con precio, volumen y barras', () => {
    render(
      <OrderBookDepthChart
        bids={[
          { price: '24.50', totalQuantity: 15 },
          { price: '23.00', totalQuantity: 30 },
        ]}
        asks={[
          { price: '25.00', totalQuantity: 10 },
          { price: '26.50', totalQuantity: 25 },
        ]}
      />,
    );

    expect(screen.getByText('$24.50')).toBeInTheDocument();
    expect(screen.getByText('$23.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$26.50')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getAllByTestId('bid-depth-bar')).toHaveLength(4);
    expect(screen.getAllByTestId('ask-depth-bar')).toHaveLength(4);
  });

  it('renderiza cuando solo hay órdenes de compra', () => {
    render(<OrderBookDepthChart bids={[{ price: '20.00', totalQuantity: 10 }]} asks={[]} />);
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getAllByTestId('bid-depth-bar')).toHaveLength(1);
  });

  it('renderiza cuando solo hay órdenes de venta', () => {
    render(<OrderBookDepthChart bids={[]} asks={[{ price: '30.00', totalQuantity: 7 }]} />);
    expect(screen.getByText('$30.00')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getAllByTestId('ask-depth-bar')).toHaveLength(1);
  });
});
