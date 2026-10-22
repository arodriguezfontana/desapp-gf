import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PortfolioDistributionChart } from './PortfolioDistributionChart';
import type { Holding } from '../types/portfolio';

const makeHolding = (overrides: Partial<Holding> = {}): Holding => ({
  playerId: 'p-1',
  playerName: 'Jugador Uno',
  tokenQuantity: 10,
  averageBuyPrice: 5,
  currentPrice: 10,
  totalProfitLoss: 50,
  ...overrides,
});

describe('PortfolioDistributionChart', () => {
  it('renderiza el estado vacío cuando no hay posiciones', () => {
    render(<PortfolioDistributionChart holdings={[]} />);

    expect(screen.getByText('Aún no tenés posiciones en tu portfolio.')).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renderiza una porción por cada holding', () => {
    const holdings: Holding[] = [
      makeHolding({ playerId: 'p-1', playerName: 'Jugador Uno', tokenQuantity: 10, currentPrice: 10 }),
      makeHolding({ playerId: 'p-2', playerName: 'Jugador Dos', tokenQuantity: 5, currentPrice: 20 }),
    ];

    render(<PortfolioDistributionChart holdings={holdings} />);

    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(document.querySelectorAll('.recharts-pie-sector')).toHaveLength(2);
    expect(screen.getByText('Jugador Uno')).toBeInTheDocument();
    expect(screen.getByText('Jugador Dos')).toBeInTheDocument();
  });

  it('renderiza una única porción representando el 100% cuando hay una sola posición', () => {
    render(<PortfolioDistributionChart holdings={[makeHolding()]} />);

    expect(document.querySelectorAll('.recharts-pie-sector')).toHaveLength(1);
  });
});
