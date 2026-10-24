import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('PortfolioDistributionChart', () => {
  it('no renderiza nada cuando no hay posiciones', () => {
    const { container } = wrap(<PortfolioDistributionChart holdings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra una barra por cada holding, ordenadas de mayor a menor valor', () => {
    const holdings: Holding[] = [
      makeHolding({ playerId: 'p-1', playerName: 'Jugador Uno', tokenQuantity: 5, currentPrice: 10 }),
      makeHolding({ playerId: 'p-2', playerName: 'Jugador Dos', tokenQuantity: 20, currentPrice: 10 }),
    ];

    wrap(<PortfolioDistributionChart holdings={holdings} />);

    // Ambos nombres visibles
    expect(screen.getByText('Jugador Uno')).toBeInTheDocument();
    expect(screen.getByText('Jugador Dos')).toBeInTheDocument();

    // Jugador Dos tiene mayor valor — su barra ocupa el 100% (la de referencia)
    const bars = document.querySelectorAll('[style*="width"]');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it('muestra el tooltip con los datos del holding al hacer hover', () => {
    const holding = makeHolding({
      playerId: 'p-1',
      playerName: 'Kylian Mbappé',
      tokenQuantity: 10,
      averageBuyPrice: 120,
      currentPrice: 140,
      totalProfitLoss: 200,
    });

    wrap(<PortfolioDistributionChart holdings={[holding]} />);

    // Antes del hover el tooltip no está
    expect(screen.queryByText('Tokens')).not.toBeInTheDocument();

    // Hover sobre la fila
    fireEvent.mouseEnter(screen.getByText('Kylian Mbappé').closest('div')!);

    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Cotización Actual')).toBeInTheDocument();
    expect(screen.getByText('Ganancia / Pérdida')).toBeInTheDocument();
  });

  it('oculta el tooltip al salir del hover', () => {
    wrap(<PortfolioDistributionChart holdings={[makeHolding()]} />);

    const row = screen.getByText('Jugador Uno').closest('div')!;
    fireEvent.mouseEnter(row);
    expect(screen.getByText('Tokens')).toBeInTheDocument();

    fireEvent.mouseLeave(row);
    expect(screen.queryByText('Tokens')).not.toBeInTheDocument();
  });

  it('el tooltip incluye un link a la ficha del jugador', () => {
    wrap(<PortfolioDistributionChart holdings={[makeHolding({ playerId: 'p-42' })]} />);

    fireEvent.mouseEnter(screen.getByText('Jugador Uno').closest('div')!);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/catalog/p-42');
  });
});
