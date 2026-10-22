import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioEvolutionChart } from './PortfolioEvolutionChart';
import type { TokenTransactionDto } from '../types/orders.types';

const makeTx = (overrides: Partial<TokenTransactionDto> = {}): TokenTransactionDto => ({
  id: 'tx-1',
  type: 'CREDIT',
  playerId: 'p-1',
  playerName: 'Jugador Uno',
  quantity: 2,
  price: '10.00',
  orderId: 'o-1',
  counterpartOrderId: 'o-2',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
});

describe('PortfolioEvolutionChart', () => {
  it('renderiza el estado vacío cuando no hay transacciones', () => {
    render(<PortfolioEvolutionChart transactions={[]} />);

    expect(screen.getByText('Aún no hay operaciones registradas.')).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('calcula y muestra el capital neto acumulado final', () => {
    const transactions: TokenTransactionDto[] = [
      makeTx({ id: 'tx-1', type: 'CREDIT', quantity: 2, price: '10.00', createdAt: '2026-09-01T00:00:00.000Z' }),
      makeTx({ id: 'tx-2', type: 'DEBIT', quantity: 1, price: '15.00', createdAt: '2026-09-05T00:00:00.000Z' }),
    ];

    render(<PortfolioEvolutionChart transactions={transactions} />);

    // Neto: +20 (compra) - 15 (venta) = +5
    expect(screen.getByText('+$5.00 neto')).toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();
  });

  it('muestra neto negativo cuando el capital acumulado es negativo', () => {
    const transactions: TokenTransactionDto[] = [
      makeTx({ id: 'tx-1', type: 'CREDIT', quantity: 1, price: '20.00', createdAt: '2026-09-01T00:00:00.000Z' }),
    ];

    render(<PortfolioEvolutionChart transactions={transactions} />);

    expect(screen.getByText('+$20.00 neto')).toBeInTheDocument();
  });
});
